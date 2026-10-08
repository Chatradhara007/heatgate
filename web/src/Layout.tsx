import { NavLink, Outlet } from "react-router-dom";
import { API_URL, USE_FIXTURES } from "./api.ts";

export function Layout({ routes }: { routes: readonly { path: string; label: string }[] }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-panel">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-md px-md py-sm">
          <span className="font-display text-lg font-bold text-brand">HeatGate</span>
          {routes.map((r) => (
            <NavLink
              key={r.path}
              to={r.path}
              className={({ isActive }) =>
                `rounded-md px-sm py-xs text-sm ${isActive ? "bg-brand text-white" : "text-ink-muted hover:text-ink"}`
              }
            >
              {r.label}
            </NavLink>
          ))}
          <span className="ml-auto text-xs text-ink-muted" data-testid="data-source">
            {USE_FIXTURES ? "Data: fixtures" : `Data: ${API_URL}`}
          </span>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-md py-lg">
        <Outlet />
      </main>
    </div>
  );
}
