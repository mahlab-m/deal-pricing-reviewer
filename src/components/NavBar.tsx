import Link from "next/link";

export default function NavBar() {
  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-8">
          <span className="text-sm font-semibold text-white tracking-wide">
            Deal &amp; Pricing Governance
          </span>
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className="px-3 py-1.5 rounded text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Portfolio
            </Link>
            <Link
              href="/escalations"
              className="px-3 py-1.5 rounded text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Action Queue
            </Link>
            <Link
              href="/report"
              className="px-3 py-1.5 rounded text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Weekly Report
            </Link>
            <Link
              href="/guide"
              className="px-3 py-1.5 rounded text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Guide
            </Link>
          </div>
        </div>
        <span className="text-xs text-slate-600 font-mono">
          Trella · Synthetic data
        </span>
      </div>
    </nav>
  );
}
