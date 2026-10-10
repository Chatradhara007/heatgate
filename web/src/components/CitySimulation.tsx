// The abstract 10 x 10 km simulated city, animated from result.runs[policy].frames (first seed only).
// Not a real map: positions are km on a made-up grid (docs/api-guide.md §5).
import { useEffect, useState } from "react";
import type { PolicyVersion, RiderState, SimResult } from "@heatgate/contracts";
import { POLICY_LABELS } from "@heatgate/contracts";

interface CitySimulationProps {
  sim: SimResult | undefined;
  policy: PolicyVersion;
  canRun?: boolean; // false while there are no settings, so no Run button (e.g. the API is down)
}

const FRAME_MS = 200; // at 1x; one frame = 5 simulated minutes
const W = 600;
const H = 600;

const formatTime = (startHour: number, minute: number) => {
  const total = startHour * 60 + minute;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const DEMAND = { 0: "Quiet", 1: "Normal", 2: "Rush" } as const;

const STATE_COLOR: Record<RiderState, string> = {
  idle: "#6B7280",
  delivering: "#2563EB",
  resting: "#D97706",
  paused: "#DC2626",
};

export function CitySimulation({ sim, policy, canRun = true }: CitySimulationProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const frames = sim?.runs[policy]?.frames ?? [];

  // A new result starts at the first frame.
  useEffect(() => {
    setFrameIndex(0);
    setIsPlaying(false);
  }, [sim?.simulationId]);

  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const t = window.setInterval(() => {
      setFrameIndex((i) => {
        if (i >= frames.length - 1) {
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, FRAME_MS / speed);
    return () => clearInterval(t);
  }, [isPlaying, frames.length, speed]);

  const frame = frames[frameIndex];
  if (!sim || !frame) {
    return (
      <div className="lg:col-span-8 flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest text-xs text-on-surface-variant">
        {canRun
          ? "No simulation yet. Press Run Simulation below to see the city."
          : "No simulation yet. The Run Simulation button appears once the API answers."}
      </div>
    );
  }

  const { startHour, endHour } = sim.params;
  const counts: Record<RiderState, number> = { idle: 0, delivering: 0, resting: 0, paused: 0 };
  for (const r of frame.riders) counts[r.state] += 1;
  const nonAllow = frame.events.filter((e) => e.outcome !== "ALLOW");

  return (
    <div className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 lg:p-5 shadow-xs flex flex-col h-full gap-3">
      <div className="pb-2.5 border-b border-outline-variant/60">
        <h2 className="font-bold text-on-surface" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "24px" }}>
          Simulated city · {POLICY_LABELS[policy]}
        </h2>
        <p className="text-xs text-on-surface-variant">
          Abstract 10 × 10 km grid, not a real map. {sim.params.riders} simulated riders; the map shows the first seed only. Resting
          riders sit at a cooling point.
        </p>
      </div>

      <div className="relative w-full aspect-square max-h-[560px] mx-auto bg-[#EFEFEA] rounded-xl border border-outline-variant overflow-hidden">
        <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`City at ${formatTime(startHour, frame.minute)}: ${counts.delivering} delivering, ${counts.resting} resting, ${counts.idle} idle, ${counts.paused} paused`}>
          <g stroke="#DDD9CC" strokeWidth="1">
            {Array.from({ length: 11 }, (_, i) => (
              <g key={i}>
                <line x1={(i * W) / 10} x2={(i * W) / 10} y1={0} y2={H} />
                <line x1={0} x2={W} y1={(i * H) / 10} y2={(i * H) / 10} />
              </g>
            ))}
          </g>
          <g stroke="#FFFFFF" strokeWidth="1.5">
            {frame.riders.map((r) => (
              <circle
                key={r.id}
                cx={(r.x / 10) * W}
                cy={(r.y / 10) * H}
                r={r.state === "resting" ? 8 : 6}
                fill={STATE_COLOR[r.state]}
                style={{ transition: `cx ${FRAME_MS / speed}ms linear, cy ${FRAME_MS / speed}ms linear` }}
              >
                <title>
                  {r.id}: {r.state}
                </title>
              </circle>
            ))}
          </g>
        </svg>

        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-surface-container-lowest/95 border border-outline-variant px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl shadow-md pointer-events-none">
          <div className="font-bold text-on-surface leading-none text-[24px] sm:text-[32px]" style={{ letterSpacing: "0.06em", fontFamily: '"Bebas Neue", sans-serif' }}>
            {formatTime(startHour, frame.minute)}
          </div>
          <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mt-0.5">1 frame = 5 min</div>
        </div>
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col items-end sm:flex-row sm:items-center gap-1.5 sm:gap-2 pointer-events-none">
          <span className="px-2.5 py-1 rounded-lg bg-surface-container-lowest/95 border border-error/30 text-error shadow-md text-xs font-bold">
            Heat index {frame.heatIndexC}°C
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-surface-container-lowest/95 border border-outline-variant text-on-surface shadow-md text-xs font-bold">
            {DEMAND[frame.demandLevel]} demand
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => {
              if (frameIndex >= frames.length - 1) setFrameIndex(0);
              setIsPlaying(!isPlaying);
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="w-10 h-10 rounded-lg bg-primary hover:bg-[#0B4F4A] text-on-primary flex items-center justify-center shrink-0"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">{isPlaying ? "pause" : "play_arrow"}</span>
          </button>
          <label className="flex flex-col flex-1 w-full gap-1">
            <span className="flex justify-between text-[11px] font-mono text-on-surface-variant font-semibold">
              <span>{String(startHour).padStart(2, "0")}:00</span>
              <span className="text-primary font-bold">{formatTime(startHour, frame.minute)}</span>
              <span>{String(endHour).padStart(2, "0")}:00</span>
            </span>
            <input
              aria-label="Time of day"
              className="w-full accent-primary"
              type="range"
              min={0}
              max={frames.length - 1}
              value={frameIndex}
              onChange={(e) => setFrameIndex(Number(e.target.value))}
            />
          </label>
          <div className="flex items-center gap-1 border border-outline-variant rounded-lg p-0.5 bg-surface-container-lowest shrink-0" role="radiogroup" aria-label="Speed">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={speed === s}
                onClick={() => setSpeed(s)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${speed === s ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"}`}
                type="button"
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2 border-t border-outline-variant/60 text-xs font-medium text-on-surface-variant">
          {(Object.keys(counts) as RiderState[]).map((st) => (
            <span key={st} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: STATE_COLOR[st] }} />
              {st[0].toUpperCase() + st.slice(1)} ({counts[st]})
            </span>
          ))}
        </div>
      </div>

      <div className="w-full bg-[#1B1F23] text-white font-mono text-xs px-4 py-2.5 rounded-lg flex items-center gap-3 overflow-x-auto" aria-live="off">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider shrink-0 font-semibold">Decisions since last frame</span>
        {nonAllow.length === 0 ? (
          <span className="text-gray-300">{frame.events.length > 0 ? `${frame.events.length} × ALLOW` : "none"}</span>
        ) : (
          nonAllow.slice(0, 4).map((e, i) => (
            <span key={i} className="shrink-0">
              <span className="bg-white/10 px-1.5 py-0.5 rounded text-[11px]">{e.riderId}</span>{" "}
              <span className="text-[#FFB77D] font-bold">{e.outcome}</span> <span className="text-gray-300">{e.rule}</span>
            </span>
          ))
        )}
        {nonAllow.length > 4 && <span className="text-gray-400 shrink-0">+{nonAllow.length - 4} more</span>}
      </div>
    </div>
  );
}
