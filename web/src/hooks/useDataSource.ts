// Where the data on screen comes from, for the header badge.
//   "fixtures"    VITE_USE_FIXTURES=true: the JSON in web/fixtures/, never the network
//   "live"        GET /health answered
//   "unreachable" GET /health failed (error says why)
//   "checking"    the first health check is still running
// Re-checks every 15 s so the badge turns red if the API goes away mid-demo.
import { useEffect } from "react";
import * as api from "../api.ts";
import { useQuery } from "./useAsync.ts";

export type DataSource = "fixtures" | "checking" | "live" | "unreachable";

const RECHECK_MS = 15_000;

export function useDataSource(): { source: DataSource; apiUrl: string; error: Error | undefined } {
  const health = useQuery((signal) => api.health(signal), "health");
  const { reload } = health;

  useEffect(() => {
    if (api.USE_FIXTURES) return;
    const t = setInterval(reload, RECHECK_MS);
    return () => clearInterval(t);
  }, [reload]);

  const source: DataSource = api.USE_FIXTURES
    ? "fixtures"
    : health.error
      ? "unreachable"
      : health.data
        ? "live"
        : "checking";
  return { source, apiUrl: api.API_URL, error: health.error };
}
