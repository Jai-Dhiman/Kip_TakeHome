import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type {
	CredibilityScore,
	Debate,
	ExtractedClaim,
	MisleadingAssessment,
	VerificationResult,
} from "~/lib/types";
import { AnthropicClient } from "../ai/anthropic-client";
import type { LLMClient } from "../ai/llm-client";
import {
	BEAR_SYSTEM_PROMPT,
	BULL_SYSTEM_PROMPT,
	JUDGE_JSON_INSTRUCTION,
	JUDGE_OUTPUT_SCHEMA,
	JUDGE_SYSTEM_PROMPT,
} from "../prompts/debate";

const DEFAULT_ROUNDS = 2;

// Store LLM clients outside LangGraph state (LangGraph annotations
// don't handle class instances well). Set before each graph invocation.
let _debateClient: LLMClient;
let _judgeClient: LLMClient;

const DebateState = Annotation.Root({
	ticker: Annotation<string>,
	quarter_id: Annotation<string>,
	claims_context: Annotation<string>,
	omissions_context: Annotation<string>,
	financial_context: Annotation<string>,
	bull_arguments: Annotation<string[]>({
		reducer: (a, b) => [...a, ...b],
		default: () => [],
	}),
	bear_arguments: Annotation<string[]>({
		reducer: (a, b) => [...a, ...b],
		default: () => [],
	}),
	current_round: Annotation<number>,
	max_rounds: Annotation<number>,
	judge_verdict: Annotation<string>,
	judge_scores: Annotation<Record<string, number>>,
});

type DebateStateType = typeof DebateState.State;

function formatClaimsForDebate(
	claims: ExtractedClaim[],
	verifications: VerificationResult[],
	assessments: MisleadingAssessment[],
): string {
	const verificationMap = new Map(verifications.map((v) => [v.claim_id, v]));
	const assessmentMap = new Map(assessments.map((a) => [a.claim_id, a]));

	const lines: string[] = [];
	for (const claim of claims) {
		const v = verificationMap.get(claim.id);
		const a = assessmentMap.get(claim.id);

		const status = v ? v.status : "unknown";
		const actual =
			v && v.actual_value !== null ? v.actual_value.toFixed(2) : "N/A";
		const deviation =
			v && v.deviation_percentage !== null
				? `${v.deviation_percentage.toFixed(1)}%`
				: "N/A";

		let line =
			`- Claim: "${claim.exact_quote}"\n` +
			`  Speaker: ${claim.speaker_name} (${claim.speaker_role})\n` +
			`  Metric: ${claim.metric_name} | Claimed: ${claim.claimed_value} ${claim.claimed_unit}\n` +
			`  GAAP Type: ${claim.gaap_type}\n` +
			`  Verification: ${status} | Actual: ${actual} | Deviation: ${deviation}\n`;

		if (a) {
			const tactics: string[] = JSON.parse(a.tactics);
			line += `  Misleading Tactics: ${tactics.join(", ")} (${a.severity})\n`;
			line += `  Explanation: ${a.explanation}\n`;
		}
		lines.push(line);
	}

	return lines.join("\n");
}

function formatFinancialSummary(
	metrics: Record<string, number | null>,
): string {
	const lines = ["Actual Financial Data (from SEC EDGAR):"];
	for (const [name, value] of Object.entries(metrics)) {
		if (value !== null) {
			if (Math.abs(value) > 1_000_000) {
				lines.push(`  ${name}: $${(value / 1_000_000).toFixed(1)}M`);
			} else if (Math.abs(value) > 1000) {
				lines.push(
					`  ${name}: $${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
				);
			} else {
				lines.push(`  ${name}: ${value.toFixed(2)}`);
			}
		}
	}
	return lines.join("\n");
}

async function bullAgent(
	state: DebateStateType,
): Promise<Partial<DebateStateType>> {
	const client = _debateClient;

	const roundNum = state.current_round;
	let context = `Company: ${state.ticker} | Quarter: ${state.quarter_id}\n\n`;
	context += `VERIFIED CLAIMS AND DATA:\n${state.claims_context}\n\n`;
	context += `${state.financial_context}\n\n`;

	if (roundNum > 1 && state.bear_arguments.length > 0) {
		context += `BEAR'S PREVIOUS ARGUMENT (respond to this):\n${state.bear_arguments[state.bear_arguments.length - 1]}\n\n`;
	}

	const prompt =
		roundNum === 1
			? `Present your initial defense of ${state.ticker} management's credibility based on the earnings call data above.`
			: `Rebut the Bear's argument above. Defend management where the evidence supports it. This is round ${roundNum} of ${state.max_rounds}.`;

	const text = await client.chat(
		[
			{ role: "system", content: BULL_SYSTEM_PROMPT },
			{ role: "user", content: context + prompt },
		],
		2048,
	);

	return { bull_arguments: [text] };
}

async function bearAgent(
	state: DebateStateType,
): Promise<Partial<DebateStateType>> {
	const client = _debateClient;

	const roundNum = state.current_round;
	let context = `Company: ${state.ticker} | Quarter: ${state.quarter_id}\n\n`;
	context += `VERIFIED CLAIMS AND DATA:\n${state.claims_context}\n\n`;
	context += `${state.financial_context}\n\n`;

	if (state.omissions_context) {
		context += "SIGNIFICANT OMISSIONS (metrics management did NOT discuss):\n";
		context += `${state.omissions_context}\n\n`;
	}

	if (state.bull_arguments.length > 0) {
		context += `BULL'S ARGUMENT (respond to this):\n${state.bull_arguments[state.bull_arguments.length - 1]}\n\n`;
	}

	const prompt =
		roundNum === 1
			? `Present your prosecution of ${state.ticker} management's credibility. Identify patterns of misleading behavior.`
			: `Rebut the Bull's defense. Strengthen your case against management. This is round ${roundNum} of ${state.max_rounds}.`;

	const text = await client.chat(
		[
			{ role: "system", content: BEAR_SYSTEM_PROMPT },
			{ role: "user", content: context + prompt },
		],
		2048,
	);

	return { bear_arguments: [text], current_round: roundNum + 1 };
}

async function judgeAgent(
	state: DebateStateType,
): Promise<Partial<DebateStateType>> {
	const client = _judgeClient;

	let debateTranscript = `Company: ${state.ticker} | Quarter: ${state.quarter_id}\n\n`;
	debateTranscript += `UNDERLYING DATA:\n${state.claims_context}\n\n`;
	debateTranscript += `${state.financial_context}\n\n`;
	debateTranscript += "=== DEBATE TRANSCRIPT ===\n\n";

	for (let i = 0; i < state.bull_arguments.length; i++) {
		debateTranscript += `--- BULL (Round ${i + 1}) ---\n${state.bull_arguments[i]}\n\n`;
		if (i < state.bear_arguments.length) {
			debateTranscript += `--- BEAR (Round ${i + 1}) ---\n${state.bear_arguments[i]}\n\n`;
		}
	}

	const prompt =
		"Based on the debate above and the underlying data, produce your credibility verdict. Return your assessment as JSON matching the required schema.";

	let scores: Record<string, number> = {};
	let verdict = "";

	try {
		let result: Record<string, unknown>;

		if (client instanceof AnthropicClient) {
			result = await client.chatJSON<Record<string, unknown>>(
				[
					{ role: "system", content: JUDGE_SYSTEM_PROMPT },
					{ role: "user", content: `${debateTranscript}\n\n${prompt}` },
				],
				4096,
				"submit_verdict",
				"Submit the judge's credibility verdict with scores.",
				JUDGE_OUTPUT_SCHEMA,
			);
		} else {
			result = await client.chatJSON<Record<string, unknown>>(
				[
					{
						role: "system",
						content: JUDGE_SYSTEM_PROMPT + JUDGE_JSON_INSTRUCTION,
					},
					{ role: "user", content: `${debateTranscript}\n\n${prompt}` },
				],
				4096,
			);
		}

		scores = {
			accuracy_score: (result.accuracy_score as number) ?? 50,
			framing_score: (result.framing_score as number) ?? 50,
			consistency_score: (result.consistency_score as number) ?? 50,
			transparency_score: (result.transparency_score as number) ?? 50,
			overall_score: (result.overall_score as number) ?? 50,
		};
		verdict = (result.verdict as string) ?? "";
	} catch (e) {
		console.warn(`Judge structured output failed, using defaults: ${e}`);
		verdict = "Unable to produce structured verdict.";
		scores = {
			accuracy_score: 50,
			framing_score: 50,
			consistency_score: 50,
			transparency_score: 50,
			overall_score: 50,
		};
	}

	return { judge_verdict: verdict, judge_scores: scores };
}

function shouldContinueOrJudge(state: DebateStateType): string {
	if (state.current_round >= state.max_rounds) {
		return "judge";
	}
	return "bull_researcher";
}

function buildDebateGraph() {
	const graph = new StateGraph(DebateState)
		.addNode("bull_researcher", bullAgent)
		.addNode("bear_researcher", bearAgent)
		.addNode("judge", judgeAgent)
		.addEdge(START, "bull_researcher")
		.addEdge("bull_researcher", "bear_researcher")
		.addConditionalEdges("bear_researcher", shouldContinueOrJudge, {
			bull_researcher: "bull_researcher",
			judge: "judge",
		})
		.addEdge("judge", END);

	return graph;
}

function countVerdicts(
	verifications: VerificationResult[],
): Record<string, number> {
	const counts: Record<string, number> = {
		verified: 0,
		inaccurate: 0,
		misleading: 0,
		unverifiable: 0,
	};
	for (const v of verifications) {
		counts[v.status] = (counts[v.status] ?? 0) + 1;
	}
	return counts;
}

export async function runDebate(
	ticker: string,
	quarterId: string,
	claims: ExtractedClaim[],
	verifications: VerificationResult[],
	assessments: MisleadingAssessment[],
	financialMetrics: Record<string, number | null>,
	omittedMetrics: string[],
	debateClient: LLMClient,
	judgeClient: LLMClient,
	maxRounds: number = DEFAULT_ROUNDS,
): Promise<[Debate, CredibilityScore]> {
	// Set the module-level clients for graph node functions
	_debateClient = debateClient;
	_judgeClient = judgeClient;

	const graph = buildDebateGraph();
	const compiled = graph.compile();

	const claimsCtx = formatClaimsForDebate(claims, verifications, assessments);
	const financialCtx = formatFinancialSummary(financialMetrics);
	const omissionsCtx =
		omittedMetrics.length > 0
			? omittedMetrics.map((m) => `- ${m}`).join("\n")
			: "";

	const result = await compiled.invoke({
		ticker,
		quarter_id: quarterId,
		claims_context: claimsCtx,
		omissions_context: omissionsCtx,
		financial_context: financialCtx,
		bull_arguments: [],
		bear_arguments: [],
		current_round: 1,
		max_rounds: maxRounds,
		judge_verdict: "",
		judge_scores: {},
	});

	const bullFull = result.bull_arguments.join("\n\n---\n\n");
	const bearFull = result.bear_arguments.join("\n\n---\n\n");

	const debateResult: Debate = {
		quarter_id: quarterId,
		bull_argument: bullFull,
		bear_argument: bearFull,
		judge_verdict: result.judge_verdict,
		rounds: maxRounds,
	};

	const debateScores = result.judge_scores;
	const vCounts = countVerdicts(verifications);

	const credibilityScore: CredibilityScore = {
		quarter_id: quarterId,
		overall_score: debateScores.overall_score ?? 50,
		accuracy_score: debateScores.accuracy_score ?? 50,
		framing_score: debateScores.framing_score ?? 50,
		consistency_score: debateScores.consistency_score ?? 50,
		transparency_score: debateScores.transparency_score ?? 50,
		total_claims: claims.length,
		verified_claims: vCounts.verified ?? 0,
		inaccurate_claims: vCounts.inaccurate ?? 0,
		misleading_claims: vCounts.misleading ?? 0,
		unverifiable_claims: vCounts.unverifiable ?? 0,
		summary: result.judge_verdict,
		omitted_metrics:
			omittedMetrics.length > 0 ? JSON.stringify(omittedMetrics) : null,
	};

	return [debateResult, credibilityScore];
}
