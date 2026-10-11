import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { useDataSource, type DataSource } from "./hooks/index.ts";
import { InfoTip } from "./components/ui.tsx";

const SOURCE_DOT: Record<DataSource, string> = {
  live: "bg-emerald-500",
  fixtures: "bg-amber-500",
  unreachable: "bg-red-600",
  checking: "bg-gray-400",
};

export function Layout({ routes }: { routes: readonly { path: string; label: string }[] }) {
  const { source, apiUrl, error } = useDataSource();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  // Page links keep the current run, so the next page shows the same data after a reload.
  const run = searchParams.get("run");
  const linkTo = (path: string) => (run ? `${path}?run=${encodeURIComponent(run)}` : path);
  useEffect(() => setMenuOpen(false), [pathname]);
  const shortSourceLabel =
    source === "live" ? "Live API" : source === "fixtures" ? "Fixture data" : source === "unreachable" ? "API unreachable" : "Checking API…";
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
        {/* Top Disclaimer Banner: one line on a phone (short texts), full texts from sm up */}
        <div className="bg-surface-container-high border-b border-outline-variant px-4 sm:px-6 lg:px-8 py-1 text-on-surface-variant text-[11px]">
          <div className="max-w-[1440px] mx-auto w-full flex items-center justify-between gap-3">
            <span className="font-mono flex items-center gap-1.5 min-w-0">
              <span className="material-symbols-outlined text-[14px] text-primary shrink-0">info</span>
              <span className="sm:hidden">₹ amounts are placeholders</span>
              <span className="hidden sm:inline">Simulated riders · ₹ amounts are placeholders</span>
            </span>
            <span
              className={`font-mono shrink-0 text-[11px] flex items-center gap-1.5 ${source === "unreachable" ? "text-error font-bold" : "text-on-surface-variant/80"}`}
              data-testid="data-source"
              title={error?.message ?? sourceLabel}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${SOURCE_DOT[source]}`} />
              <span className="sm:hidden">{shortSourceLabel}</span>
              <span className="hidden sm:inline">{sourceLabel}</span>
            </span>
          </div>
        </div>

        {/* Main Navbar (compact h-16) */}
        <div className="h-16 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
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
                  to={linkTo(r.path)}
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

          {/* Menu button below 768 px */}
          <button
            type="button"
            className="md:hidden w-11 h-11 -mr-1 flex items-center justify-center rounded-lg text-on-surface hover:bg-surface-container"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="material-symbols-outlined text-[26px]">{menuOpen ? "close" : "menu"}</span>
          </button>
        </div>

        {menuOpen && (
          <nav id="mobile-nav" className="md:hidden border-t border-outline-variant px-4 py-2 flex flex-col gap-1">
            {routes.map((r) => (
              <NavLink
                key={r.path}
                to={linkTo(r.path)}
                className={({ isActive }) =>
                  `min-h-[44px] px-3.5 flex items-center rounded-lg text-sm ${
                    isActive ? "bg-primary text-on-primary font-bold" : "text-on-surface hover:bg-surface-container font-medium"
                  }`
                }
              >
                {r.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Main Content Area (natural top margin since header is not fixed) */}
      <main className="w-full py-5 flex-1 bg-surface">
        <Outlet />
      </main>

      {/* Standardized Web Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-outline-variant py-4 mt-auto">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-xs text-on-surface-variant gap-2">
          <p className="text-center md:text-left">
            Heat index is a proxy for heat stress, not a medical measure.{" "}
            <InfoTip label="About the rules and numbers">
              ₹ amounts are placeholders until rider interviews. NDMA and union rules copy the published documents. HeatGate Fair thresholds
              need expert review. Rider IDs are pseudonymous but likely still personal data under India's DPDP Act, 2023.
            </InfoTip>
          </p>

        </div>
      </footer>
    </div>
  );
}
