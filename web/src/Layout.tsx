import { NavLink, Outlet } from "react-router-dom";
import { useDataSource, type DataSource } from "./hooks/index.ts";

const SOURCE_DOT: Record<DataSource, string> = {
  live: "bg-emerald-500",
  fixtures: "bg-amber-500",
  unreachable: "bg-red-600",
  checking: "bg-gray-400",
};

export function Layout({ routes }: { routes: readonly { path: string; label: string }[] }) {
  const { source, apiUrl, error } = useDataSource();
  const sourceLabel =
    source === "live"
      ? `Live API (${apiUrl})`
      : source === "fixtures"
        ? "Fixture data (not a live run)"
        : source === "unreachable"
          ? `API unreachable (${apiUrl})`
          : "Checking API…";
  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex flex-col">
      {/* Header section (NOT fixed to screen while scrolling) */}
      <header className="w-full bg-surface-container-lowest border-b border-outline-variant shadow-xs">
        {/* Top Disclaimer Banner */}
        <div className="bg-surface-container-high border-b border-outline-variant px-6 lg:px-8 py-1 text-on-surface-variant text-[11px] flex items-center justify-between">
          <div className="max-w-[1440px] mx-auto w-full flex items-center justify-between">
            <span className="font-mono flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-primary">info</span>
              Simulated riders · All rupee amounts are placeholders until rider interviews
            </span>
            <span
              className={`font-mono shrink-0 text-[11px] flex items-center gap-1.5 ${source === "unreachable" ? "text-error font-bold" : "text-on-surface-variant/80"}`}
              data-testid="data-source"
              title={error?.message}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${SOURCE_DOT[source]}`} />
              {sourceLabel}
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
            HeatGate Fair thresholds need expert review. NDMA and union rules copy the published documents. Heat index is a proxy for outdoor heat stress, not a medical measure.
          </p>

        </div>
      </footer>
    </div>
  );
}
