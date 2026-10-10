// Platform view: HeatGate Fair against today's voluntary measures, on the same simulated days.
// Every number comes from the active SimResult (mean and lowest–highest seed); nothing is typed in.
import { Link } from "react-router-dom";
import type { NumericMetric, SimResult } from "@heatgate/contracts";
import { POLICY_LABELS } from "@heatgate/contracts";
import { useActiveSimulation } from "../context/SimulationContext.tsx";

interface Stat {
  mean: number;
  min: number;
  max: number;
}

function stat(sim: SimResult, policy: "no-rules" | "heatgate-fair", metric: NumericMetric): Stat | undefined {
  const run = sim.runs[policy];
  if (!run) return undefined;
  const r = run.range[metric];
  return { mean: run.metrics[metric] as number, min: r.min, max: r.max };
}

const overlaps = (a: Stat, b: Stat) => a.min <= b.max && b.min <= a.max;

function fmt(n: number, digits = 0) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function withRange(s: Stat, oneSeed: boolean, digits = 0, prefix = "") {
  const mean = `${prefix}${fmt(s.mean, digits)}`;
  return oneSeed ? mean : `${mean} (${prefix}${fmt(s.min, digits)}–${prefix}${fmt(s.max, digits)})`;
}

function changeText(base: Stat, fair: Stat, oneSeed: boolean, unit: string, digits = 0) {
  const diff = fair.mean - base.mean;
  const pct = base.mean !== 0 ? ` (${diff >= 0 ? "+" : "−"}${fmt(Math.abs((diff / base.mean) * 100), 0)}%)` : "";
  const sign = diff >= 0 ? "+" : "−";
  const text = `${sign}${fmt(Math.abs(diff), digits)} ${unit}${pct}`;
  if (!oneSeed && overlaps(base, fair)) return `${text}, ranges overlap: no clear difference`;
  return text;
}

const card = "bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-5 shadow-xs flex flex-col gap-2";
const cardLabel = "text-xs font-bold text-[#4B5563] uppercase tracking-wider";
const placeholderTag = "text-[10px] font-mono text-[#4B5563] bg-[#FAFAF7] border border-[#E3E1DA] px-2 py-0.5 rounded";

export function ComparePage() {
  const { activeSim: sim, loading, status, elapsedMs, error } = useActiveSimulation();

  if (!sim || !sim.runs["no-rules"] || !sim.runs["heatgate-fair"]) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6 flex flex-col w-full gap-4 pb-12">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#1B1F23]">Platform View</h1>
        {loading ? (
          <p className="text-sm text-[#4B5563]">
            Running simulation ({status}, {Math.round(elapsedMs / 1000)} s)…
          </p>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm font-bold text-error">
            Simulation failed: {error.message}
          </p>
        ) : (
          <p className="text-sm text-[#4B5563]">
            {sim ? "This run has no no-rules or HeatGate Fair result to compare. " : "No results yet. "}Run a simulation (all four rule sets) on the{" "}
            <Link to="/simulator" className="font-bold text-[#0F766E] underline">
              Policy Sandbox
            </Link>{" "}
            first.
          </p>
        )}
      </div>
    );
  }

  const { params } = sim;
  const seeds = params.seeds.length;
  const oneSeed = seeds === 1;
  const s = (p: "no-rules" | "heatgate-fair", m: NumericMetric) => stat(sim, p, m)!;
  const weather =
    params.weather?.kind === "replay" ? `replay of ${params.weather.weatherDayId}` : `${params.peakTempC}°C peak, ${params.humidityPct}% humidity`;

  const u90 = { base: s("no-rules", "unsafeExposureMin90"), fair: s("heatgate-fair", "unsafeExposureMin90") };
  const u120 = { base: s("no-rules", "unsafeExposureMin120"), fair: s("heatgate-fair", "unsafeExposureMin120") };
  const delivered = { base: s("no-rules", "ordersDelivered"), fair: s("heatgate-fair", "ordersDelivered") };
  const avgMin = { base: s("no-rules", "avgDeliveryMinutes"), fair: s("heatgate-fair", "avgDeliveryMinutes") };
  const late = { base: s("no-rules", "ordersLate"), fair: s("heatgate-fair", "ordersLate") };
  const restPay = s("heatgate-fair", "restPayTotalInr");
  const heatFee = s("heatgate-fair", "heatFeeCollectedInr");
  const earnPct = s("heatgate-fair", "earningsPctOfNoRules");
  const avgEarn = { base: s("no-rules", "avgEarningsPerRiderInr"), fair: s("heatgate-fair", "avgEarningsPerRiderInr") };
  const minEarn = { base: s("no-rules", "minEarningsPerRiderInr"), fair: s("heatgate-fair", "minEarningsPerRiderInr") };
  const feeShare = restPay.mean > 0 ? (heatFee.mean / restPay.mean) * 100 : undefined;

  const pairs = [
    { label: "Unsafe minutes beyond 90 min since rest", unit: "rider-min", ...u90, digits: 0, prefix: "" },
    { label: "Average delivery time", unit: "min", ...avgMin, digits: 1, prefix: "" },
    { label: "Average rider earnings (placeholder pay)", unit: "", ...avgEarn, digits: 0, prefix: "₹" },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-6 flex flex-col w-full gap-6 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#1B1F23]">Platform View</h1>
          <p className="text-sm text-[#4B5563] mt-0.5">
            {POLICY_LABELS["heatgate-fair"]} compared with "{POLICY_LABELS["no-rules"]}", on the same simulated days.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E3E1DA] bg-[#FFFFFF] text-[#1B1F23] font-mono text-xs">
          {weather} · {params.riders} riders · {seeds} {oneSeed ? "seed" : "seeds"}
        </span>
      </header>

      <div className="rounded-2xl border border-[#E3E1DA] bg-[#FAFAF7] p-4 text-xs text-[#4B5563] leading-relaxed">
        {oneSeed
          ? "1 seed: one simulated day, so no ranges. Use 5 seeds for any number you present. "
          : `Each number is the mean, with the lowest and highest of ${seeds} seeds in brackets. `}
        All rupee amounts are placeholders until rider interviews. The heat fee is a hypothesis: customers may order less. Assumes{" "}
        {params.multiAppPct}% of riders keep working on another app during breaks (to confirm with riders), which keeps their heat
        exposure counting.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <div className={card}>
          <span className={cardLabel}>Unsafe heat minutes</span>
          <p className="text-sm text-[#1B1F23]">
            Beyond 90 min since rest: <strong>{withRange(u90.base, oneSeed)}</strong> → <strong className="text-[#0F766E]">{withRange(u90.fair, oneSeed)}</strong>
          </p>
          <p className="text-xs font-mono text-[#4B5563]">{changeText(u90.base, u90.fair, oneSeed, "rider-min")}</p>
          <p className="text-sm text-[#1B1F23]">
            Beyond 120 min: <strong>{withRange(u120.base, oneSeed)}</strong> → <strong className="text-[#0F766E]">{withRange(u120.fair, oneSeed)}</strong>
          </p>
          <p className="text-xs font-mono text-[#4B5563]">{changeText(u120.base, u120.fair, oneSeed, "rider-min")}</p>
          <p className="text-[11px] text-[#4B5563]">Rider-minutes outdoors at heat index ≥ 38 °C (all riders, one day). A proxy, not a medical measure.</p>
        </div>

        <div className={card}>
          <span className={cardLabel}>Orders</span>
          <p className="text-sm text-[#1B1F23]">
            Delivered: <strong>{withRange(delivered.base, oneSeed)}</strong> → <strong className="text-[#0F766E]">{withRange(delivered.fair, oneSeed)}</strong>
          </p>
          <p className="text-xs font-mono text-[#4B5563]">{changeText(delivered.base, delivered.fair, oneSeed, "orders")}</p>
          <p className="text-sm text-[#1B1F23]">
            Late (over 45 min or untaken 30 min): <strong>{withRange(late.base, oneSeed)}</strong> →{" "}
            <strong className="text-[#0F766E]">{withRange(late.fair, oneSeed)}</strong>
          </p>
          <p className="text-xs font-mono text-[#4B5563]">{changeText(late.base, late.fair, oneSeed, "orders")}</p>
        </div>

        <div className={card}>
          <span className={cardLabel}>Delivery time</span>
          <p className="text-sm text-[#1B1F23]">
            Average: <strong>{withRange(avgMin.base, oneSeed, 1)}</strong> → <strong className="text-[#0F766E]">{withRange(avgMin.fair, oneSeed, 1)}</strong> min
          </p>
          <p className="text-xs font-mono text-[#4B5563]">{changeText(avgMin.base, avgMin.fair, oneSeed, "min", 1)}</p>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between gap-2">
            <span className={cardLabel}>Rest pay vs heat fee (HeatGate Fair)</span>
            <span className={placeholderTag}>placeholder</span>
          </div>
          <p className="text-sm text-[#1B1F23]">
            Rest pay paid: <strong>{withRange(restPay, oneSeed, 0, "₹")}</strong>
          </p>
          <p className="text-sm text-[#1B1F23]">
            Heat fee collected: <strong>{withRange(heatFee, oneSeed, 0, "₹")}</strong>
          </p>
          <p className="text-xs font-mono text-[#4B5563]">
            {feeShare === undefined ? "No rest pay in this run." : `The heat fee covers ${fmt(feeShare)}% of the rest pay (means).`}
          </p>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between gap-2">
            <span className={cardLabel}>Rider earnings</span>
            <span className={placeholderTag}>placeholder</span>
          </div>
          <p className="text-sm text-[#1B1F23]">
            Average rider: <strong>{withRange(avgEarn.base, oneSeed, 0, "₹")}</strong> → <strong className="text-[#0F766E]">{withRange(avgEarn.fair, oneSeed, 0, "₹")}</strong>
          </p>
          <p className="text-sm text-[#1B1F23]">
            Lowest-earning rider: <strong>{withRange(minEarn.base, oneSeed, 0, "₹")}</strong> →{" "}
            <strong className="text-[#0F766E]">{withRange(minEarn.fair, oneSeed, 0, "₹")}</strong>
          </p>
          <p className="text-sm text-[#1B1F23]">
            HeatGate Fair earnings as % of today's: <strong>{withRange(earnPct, oneSeed, 1)}</strong>
          </p>
          <p className="text-[11px] text-[#4B5563]">
            At placeholder rest pay a break can pay more than delivering, so this is not evidence that riders earn more.
          </p>
        </div>
      </div>

      <section className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-6 shadow-xs flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-[#1B1F23]">What it costs vs what it protects</h2>
          <p className="text-xs text-[#4B5563] mt-0.5">
            Bars are means; the black line spans the lowest to highest seed{oneSeed ? " (one seed: no range)" : ""}.
          </p>
        </div>
        {pairs.map((m) => {
          const axis = Math.max(m.base.max, m.fair.max, 1e-9);
          const pos = (v: number) => `${(v / axis) * 100}%`;
          const rows = [
            { name: "Today", stat: m.base, color: "bg-[#6B7280]" },
            { name: "HeatGate Fair", stat: m.fair, color: "bg-[#0F766E]" },
          ];
          return (
            <div key={m.label} className="flex flex-col gap-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
                <span className="text-sm font-bold text-[#1B1F23]">{m.label}</span>
                <span className="text-xs font-mono text-[#4B5563]">{changeText(m.base, m.fair, oneSeed, m.unit || "₹", m.digits)}</span>
              </div>
              {rows.map((r) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs font-semibold text-[#4B5563] text-right">{r.name}</span>
                  <div className="relative flex-1 h-5 bg-[#FAFAF7] border border-[#E3E1DA] rounded">
                    <div className={`absolute inset-y-0 left-0 rounded ${r.color}`} style={{ width: pos(r.stat.mean) }} />
                    {!oneSeed && (
                      <div
                        className="absolute top-1/2 h-0.5 bg-black"
                        style={{ left: pos(r.stat.min), width: `calc(${pos(r.stat.max)} - ${pos(r.stat.min)})` }}
                      />
                    )}
                  </div>
                  <span className="w-48 shrink-0 text-xs font-mono text-[#1B1F23]">{withRange(r.stat, oneSeed, m.digits, m.prefix)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
