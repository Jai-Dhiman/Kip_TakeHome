import type { Debate } from "~/lib/types";

export function DebateView({ debate }: { debate: Debate }) {
  // Split arguments by round separator
  const bullRounds = debate.bull_argument.split("\n\n---\n\n");
  const bearRounds = debate.bear_argument.split("\n\n---\n\n");
  const maxRounds = Math.max(bullRounds.length, bearRounds.length);

  return (
    <div className="space-y-6">
      {/* Debate rounds */}
      {Array.from({ length: maxRounds }).map((_, i) => (
        <div key={i} className="space-y-4">
          <div className="text-xs text-zinc-600 uppercase tracking-wider text-center">
            Round {i + 1}
          </div>

          {/* Bull */}
          {bullRounds[i] && (
            <div className="flex gap-3">
              <div className="shrink-0 mt-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-950 border border-emerald-800/50">
                  <span className="text-xs font-bold text-emerald-400">B</span>
                </div>
              </div>
              <div className="flex-1 rounded-lg bg-emerald-950/20 border border-emerald-900/30 p-4">
                <div className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider mb-2">
                  Bull Researcher
                </div>
                <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {bullRounds[i]}
                </div>
              </div>
            </div>
          )}

          {/* Bear */}
          {bearRounds[i] && (
            <div className="flex gap-3">
              <div className="shrink-0 mt-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-950 border border-red-800/50">
                  <span className="text-xs font-bold text-red-400">B</span>
                </div>
              </div>
              <div className="flex-1 rounded-lg bg-red-950/20 border border-red-900/30 p-4">
                <div className="text-[10px] font-medium text-red-500 uppercase tracking-wider mb-2">
                  Bear Researcher
                </div>
                <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {bearRounds[i]}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Judge Verdict */}
      <div className="mt-8">
        <div className="text-xs text-zinc-600 uppercase tracking-wider text-center mb-4">
          Verdict
        </div>
        <div className="flex gap-3">
          <div className="shrink-0 mt-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-950 border border-violet-800/50">
              <span className="text-xs font-bold text-violet-400">J</span>
            </div>
          </div>
          <div className="flex-1 rounded-lg bg-violet-950/20 border border-violet-900/30 p-4">
            <div className="text-[10px] font-medium text-violet-500 uppercase tracking-wider mb-2">
              Judge
            </div>
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {debate.judge_verdict}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
