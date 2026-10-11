import { useState } from "react";
import type { AlertSetting, SimParams } from "@heatgate/contracts";
import { useWeatherDays } from "../hooks/index.ts";
import { InfoTip } from "./ui.tsx";

interface ScenarioBarProps {
  params: SimParams;
  setParams: (params: SimParams) => void;
}

// Two slider presets. These are inputs for a run, not results.
const PRESETS = [
  { key: "normal", label: "Normal Day", icon: "wb_sunny", peakTempC: 34, humidityPct: 40, alertLevel: 0 as AlertSetting },
  { key: "heatwave", label: "Heatwave Day", icon: "local_fire_department", peakTempC: 40, humidityPct: 25, alertLevel: "auto" as AlertSetting },
] as const;

const alertText = (a: AlertSetting) => (a === "auto" ? "Alert auto" : `Alert ${a}`);

export function ScenarioBar({ params, setParams }: ScenarioBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const weatherDays = useWeatherDays();

  const replayId = params.weather?.kind === "replay" ? params.weather.weatherDayId : "";
  const replayDay = weatherDays.data?.find((d) => d.id === replayId);
  const activePreset = replayId
    ? undefined
    : PRESETS.find((p) => p.peakTempC === params.peakTempC && p.humidityPct === params.humidityPct && p.alertLevel === params.alertLevel);

  const setSlider = (patch: Partial<SimParams>) => setParams({ ...params, ...patch, weather: { kind: "slider" } });

  return (
    <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-2xl p-3.5 lg:p-4 shadow-xs">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        <div className="lg:col-span-8 xl:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Scenario">
          {PRESETS.map((p) => {
            const selected = activePreset?.key === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSlider({ peakTempC: p.peakTempC, humidityPct: p.humidityPct, alertLevel: p.alertLevel })}
                className={`w-full h-[58px] px-3.5 rounded-xl border flex items-center gap-2.5 text-left focus:outline-none focus:ring-2 focus:ring-primary ${
                  selected ? "border-2 border-primary bg-[#E6F4F1]" : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container"
                }`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selected ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}>
                  <span className="material-symbols-outlined text-[18px]">{p.icon}</span>
                </span>
                <span className="min-w-0">
                  <span className={`block text-xs font-bold truncate ${selected ? "text-primary" : "text-on-surface"}`}>{p.label}</span>
                  <span className="block text-[11px] font-mono text-on-surface-variant truncate mt-0.5">
                    {p.peakTempC}°C · {p.humidityPct}% · {alertText(p.alertLevel)}
                  </span>
                </span>
              </button>
            );
          })}

          {/* Real weather day replay (GET /weather-days) */}
          <label
            className={`w-full h-[58px] px-3.5 rounded-xl border flex flex-col justify-center ${
              replayId ? "border-2 border-primary bg-[#E6F4F1]" : "border-outline-variant bg-surface-container-lowest"
            }`}
          >
            <span className={`text-xs font-bold ${replayId ? "text-primary" : "text-on-surface"}`}>Replay a real day</span>
            {weatherDays.error ? (
              <span role="alert" className="text-[11px] text-error truncate" title={weatherDays.error.message}>
                Weather days unavailable: {weatherDays.error.message}
              </span>
            ) : (
              <select
                aria-label="Weather day to replay"
                value={replayId}
                disabled={!weatherDays.data}
                onChange={(e) =>
                  e.target.value
                    ? setParams({ ...params, alertLevel: "auto", weather: { kind: "replay", weatherDayId: e.target.value } })
                    : setParams({ ...params, weather: { kind: "slider" } })
                }
                className="bg-transparent text-[11px] font-mono text-on-surface-variant focus:outline-none cursor-pointer"
              >
                <option value="">{weatherDays.loading ? "Loading days…" : "Choose a day…"}</option>
                {weatherDays.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.city} {d.date} · {d.peakTempC}°C
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>

        <div className="lg:col-span-4 xl:col-span-3 bg-surface-container/60 border border-outline-variant/80 rounded-xl p-2 flex items-center justify-between gap-2.5">
          <div className="flex flex-col min-w-0 pl-1.5">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider leading-none flex items-center gap-1">
              Next run
              <InfoTip label="About the weather and alert level">
                {replayId
                  ? "Replay uses the day's hourly weather (Open-Meteo reanalysis, ~25 km grid). "
                  : "Slider weather: a made-up day with this peak. "}
                The alert level is assumed from the peak temperature, not a real IMD alert.
              </InfoTip>
            </span>
            <span className="font-mono text-xs font-bold text-on-surface mt-1 truncate">
              {replayId
                ? replayDay
                  ? `${replayDay.city} ${replayDay.date}`
                  : replayId
                : `${params.peakTempC}°C · ${params.humidityPct}% · ${alertText(params.alertLevel)}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            className={`h-10 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 shrink-0 ${
              isOpen ? "bg-primary text-on-primary border-primary" : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Advanced</span>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-3.5 pt-3.5 border-t border-outline-variant grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/70 flex flex-col gap-1.5">
            <span className="flex justify-between items-center text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              <span>Peak temperature</span>
              <span className="font-mono text-xs text-primary font-bold">{params.peakTempC}°C</span>
            </span>
            <input
              className="accent-primary w-full"
              type="range"
              min={34}
              max={46}
              step={1}
              disabled={!!replayId}
              value={params.peakTempC}
              onChange={(e) => setSlider({ peakTempC: Number(e.target.value) })}
            />
          </label>
          <label className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/70 flex flex-col gap-1.5">
            <span className="flex justify-between items-center text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              <span>Humidity</span>
              <span className="font-mono text-xs text-primary font-bold">{params.humidityPct}%</span>
            </span>
            <input
              className="accent-primary w-full"
              type="range"
              min={10}
              max={90}
              step={1}
              disabled={!!replayId}
              value={params.humidityPct}
              onChange={(e) => setSlider({ humidityPct: Number(e.target.value) })}
            />
          </label>
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/70 flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Alert level (assumed)</span>
            <div className="grid grid-cols-4 bg-surface-container p-0.5 rounded-lg border border-outline-variant h-9 items-center gap-0.5" role="radiogroup" aria-label="Alert level">
              {(["auto", 0, 1, 2] as const).map((lvl) => (
                <button
                  key={String(lvl)}
                  type="button"
                  role="radio"
                  aria-checked={params.alertLevel === lvl}
                  onClick={() => setParams({ ...params, alertLevel: lvl })}
                  className={`h-full rounded-md text-xs font-semibold ${
                    params.alertLevel === lvl ? "bg-surface-container-lowest font-bold text-primary" : "text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  {lvl === "auto" ? "Auto" : lvl}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
