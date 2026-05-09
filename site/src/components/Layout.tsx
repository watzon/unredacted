import { Outlet, Link, useLocation } from 'react-router-dom'

export function Layout() {
  const { pathname } = useLocation()
  const isActive = (path: string) => pathname === path

  return (
    <div className="min-h-screen flex flex-col flashlight">
      {/* Top classification bar */}
      <div className="bg-xf-red/20 border-b border-xf-red/30 px-4 py-1 text-center overflow-hidden">
        <span className="text-xs font-mono text-xf-red-light tracking-[3px] uppercase crt-flicker whitespace-nowrap">
          ◆ secure federal network ◆ fs-60372 ◆ level alpha ◆
        </span>
      </div>

      <header className="border-b border-xf-border bg-xf-surface/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Branding */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition shrink-0">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 border-2 border-xf-accent/50 rounded-full rotate-45" />
              <div className="absolute inset-1 border border-xf-accent/30 rounded-full rotate-45" />
              <span className="relative text-xf-accent text-[10px] font-bold tracking-tighter">UN</span>
            </div>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-xf-accent">UN</span><span className="hidden sm:inline">REDACTED</span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className={`px-3 py-1.5 text-sm font-mono tracking-wider transition-colors rounded
                ${isActive('/') ? 'text-xf-accent bg-xf-accent/10' : 'text-xf-muted hover:text-xf-text hover:bg-xf-surface'}`}
            >
              Files
            </Link>
            <Link
              to="/browse"
              className={`px-3 py-1.5 text-sm font-mono tracking-wider transition-colors rounded
                ${isActive('/browse') ? 'text-xf-accent bg-xf-accent/10' : 'text-xf-muted hover:text-xf-text hover:bg-xf-surface'}`}
            >
              Archive
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 animate-in">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-xf-border bg-xf-surface/50 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-8 mb-3">
            <div className="h-px flex-1 bg-xf-border" />
            <span className="text-xf-muted text-xs font-mono tracking-[4px] uppercase">
              Department of War • PURSUE Program
            </span>
            <div className="h-px flex-1 bg-xf-border" />
          </div>
          <div className="text-2xl ufo-glow mb-2">🛸</div>
          <p className="text-xf-muted text-xs font-mono tracking-widest uppercase">
            some things aren't meant to stay classified
          </p>
          <div className="flex items-center justify-center gap-6 mt-4">
            <a
              href="https://www.war.gov/UFO/"
              target="_blank"
              rel="noopener"
              className="text-xf-muted text-[10px] font-mono tracking-wider hover:text-xf-accent transition"
            >
              SOURCE: WAR.GOV/UFO ↗
            </a>
          </div>
          <p className="text-xf-muted text-[10px] mt-4 font-mono opacity-40">
            This system is monitored. Unauthorized access is a federal crime. • 18 U.S.C. § 1030
          </p>
        </div>
      </footer>
    </div>
  )
}
