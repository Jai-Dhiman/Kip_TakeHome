import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import appCss from "~/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
	{
		head: () => ({
			meta: [
				{ charSet: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ title: "Kip Takehome — Earnings Call Credibility Tracker" },
				{
					name: "description",
					content:
						"AI-powered analysis of earnings call credibility. Verify claims, detect misleading framing, and read Bull vs Bear debates.",
				},
			],
			links: [
				{ rel: "stylesheet", href: appCss },
				{
					rel: "icon",
					href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>KT</text></svg>",
				},
				{ rel: "preconnect", href: "https://fonts.googleapis.com" },
				{
					rel: "preconnect",
					href: "https://fonts.gstatic.com",
					crossOrigin: "anonymous",
				},
			],
		}),
		component: RootLayout,
	},
);

function RootLayout() {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen font-sans antialiased">
				<nav className="nav-bar sticky top-0 z-50">
					<div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
						<div className="flex h-12 items-center justify-between">
							<Link to="/" className="flex items-center gap-3 group">
								<span className="font-serif text-lg tracking-tight text-white">
									Kip Takehome
								</span>
							</Link>
							<span className="font-sans text-[11px] font-medium tracking-widest uppercase text-ink-300">
								Earnings Credibility Analysis
							</span>
						</div>
					</div>
				</nav>
				<main className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-8">
					<Outlet />
				</main>
				<footer className="border-t border-parchment-300 mt-16">
					<div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
						<span className="text-xs text-ink-400 font-sans">Kip Takehome</span>
						<span className="text-[10px] text-parchment-500 font-sans">
							Claims verified against SEC EDGAR filings
						</span>
					</div>
				</footer>
				<Scripts />
			</body>
		</html>
	);
}
