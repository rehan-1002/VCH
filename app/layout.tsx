import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Activity, Tv, Monitor, ShieldCheck, UserCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "LiveQueue | Real-Time Institutional Queue & Crowd Platform",
  description:
    "Authoritative real-time virtual queue and crowd-management platform for physical institutions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased selection:bg-zinc-800 selection:text-white">
        {/* Global Operational Top Bar */}
        <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-100 group-hover:border-zinc-500 transition-colors">
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <span className="font-mono text-sm font-bold tracking-wider text-white">
                    LIVEQUEUE
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 ml-1.5 uppercase hidden sm:inline">
                    OS v2.4
                  </span>
                </div>
              </Link>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Check-in</span>
              </Link>

              <Link
                href="/counter"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Counter</span>
              </Link>

              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin</span>
              </Link>

              <Link
                href="/display"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-emerald-900/50 hover:border-emerald-700/80 transition-colors"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Display TV</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Global Footer Meta */}
        <footer className="border-t border-zinc-900 py-4 px-6 text-center text-xs font-mono text-zinc-600">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Authoritative Queue Engine • PostgreSQL + Prisma + SSE Stream</span>
            <span>Real-Time Institutional Synchronization</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
