import { NavLink, Outlet } from "react-router-dom";
import { API_URL, USE_FIXTURES, isBackendConnected } from "./api.ts";

export function Layout({ routes }: { routes: readonly { path: string; label: string }[] }) {
  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col">
      {/* Header section (NOT fixed to screen while scrolling) */}
      <header className="w-full bg-surface-container-lowest border-b border-outline-variant shadow-xs">
        {/* Top Disclaimer Banner */}
        <div className="bg-surface-container-high border-b border-outline-variant px-6 lg:px-8 py-1 text-on-surface-variant text-[11px] flex items-center justify-between">
          <div className="max-w-[1440px] mx-auto w-full flex items-center justify-between">
            <span className="font-mono flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-primary">info</span>
              Demo data · All rupee amounts are placeholders pending field calibration
            </span>
            <span className="font-mono text-on-surface-variant/80 shrink-0 text-[11px] flex items-center gap-1.5" data-testid="data-source">
              <span className={`w-1.5 h-1.5 rounded-full ${isBackendConnected ? "bg-emerald-500" : "bg-[#0F766E]"}`} />
              {isBackendConnected ? `Backend: Live (${API_URL})` : "Backend: Hybrid (Local Fallback Ready)"}
            </span>
          </div>
        </div>

        {/* Main Navbar (compact h-16) */}
        <div className="h-16 max-w-[1440px] mx-auto px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shadow-xs">
                <span className="material-symbols-outlined text-xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  local_fire_department
                </span>
              </div>
              <span
                className="font-bold tracking-tight text-on-surface"
                style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.05em", fontSize: "26px" }}
              >
                HeatGate
              </span>
            </div>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-1.5 pl-5 border-l border-outline-variant">
              {routes.map((r) => (
                <NavLink
                  key={r.path}
                  to={r.path}
                  className={({ isActive }) =>
                    `min-h-[38px] px-3.5 py-1.5 flex items-center rounded-lg transition-colors text-xs ${
                      isActive
                        ? "bg-primary text-on-primary font-bold shadow-xs"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-medium"
                    }`
                  }
                >
                  {r.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            <span className="hidden xl:inline-block font-mono text-[11px] text-on-surface-variant bg-surface-container px-2.5 py-1 rounded border border-outline-variant">
              P presenter · 1-6 scenes
            </span>
            <div className="inline-flex items-center border border-outline-variant rounded-lg bg-surface-container-lowest p-0.5 text-xs font-semibold gap-0.5">
              <button className="px-2.5 py-1 rounded bg-primary text-on-primary text-xs font-bold shadow-xs">EN</button>
              <button className="px-2.5 py-1 rounded hover:bg-surface-container hover:text-on-surface text-on-surface-variant text-xs font-semibold">
                हिं
              </button>
              <button className="px-2.5 py-1 rounded hover:bg-surface-container hover:text-on-surface text-on-surface-variant text-xs font-semibold">
                తె
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area (natural top margin since header is not fixed) */}
      <main className="w-full py-5 flex-1 bg-surface">
        <Outlet />
      </main>

      {/* Standardized Web Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-outline-variant py-4 mt-auto">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-xs text-on-surface-variant gap-2">
          <p className="text-center md:text-left">
            Heat thresholds are placeholders pending expert review. Heat index is a proxy for heat stress, not a medical measure.
          </p>
          <p className="font-mono text-[11px] shrink-0 text-on-surface-variant/80">
            Institutional Research Sandbox · v0.9.4
          </p>
        </div>
      </footer>
    </div>
  );
}
