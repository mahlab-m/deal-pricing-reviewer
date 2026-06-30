import Link from "next/link";

export default function NavBar() {
  return (
    <nav className="border-b border-gray-200 bg-white/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-8">
          <span className="text-sm font-semibold text-gray-900 tracking-wide">
            Deal &amp; Pricing Governance
          </span>
          <div className="flex items-center gap-1">
            <Link
              href="/guide"
              className="px-3 py-1.5 rounded text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/"
              className="px-3 py-1.5 rounded text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Portfolio
            </Link>
            <Link
              href="/escalations"
              className="px-3 py-1.5 rounded text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Action Queue
            </Link>
            <Link
              href="/report"
              className="px-3 py-1.5 rounded text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Weekly Report
            </Link>
          </div>
        </div>
        <span className="text-xs text-gray-400 font-mono">
          Synthetic data
        </span>
      </div>
    </nav>
  );
}
