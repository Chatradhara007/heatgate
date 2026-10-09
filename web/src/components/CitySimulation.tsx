import React, { useState, useEffect, useRef } from "react";
import type { SimResult, Frame, PolicyVersion, RiderState, Outcome } from "@heatgate/contracts";

interface CitySimulationProps {
  sim: SimResult | undefined;
  policy: PolicyVersion;
}

const formatTime = (startHour: number, minute: number) => {
  const totalMinutes = startHour * 60 + minute;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

const demandLabels = {
  0: "Quiet",
  1: "Normal",
  2: "Rush"
};

// 8 Cooling Points in Begumpet Zone (mapped to Hyderabad coords & 10x10 grid)
const COOLING_POINTS = [
  { id: "CP 1", x: 1.8, y: 3.4, lat: 17.4520, lng: 78.4480, name: "Begumpet Flyover Hub" },
  { id: "CP 2", x: 2.7, y: 2.1, lat: 17.4580, lng: 78.4550, name: "Prakash Nagar Station" },
  { id: "CP 3", x: 3.4, y: 3.9, lat: 17.4480, lng: 78.4620, name: "Begumpet Bus Shelter Hub" },
  { id: "CP 4", x: 4.1, y: 4.8, lat: 17.4410, lng: 78.4680, name: "Rashtrapati Road Shelter" },
  { id: "CP 5", x: 5.3, y: 1.8, lat: 17.4600, lng: 78.4780, name: "Secunderabad Clock Tower" },
  { id: "CP 6", x: 5.0, y: 5.8, lat: 17.4330, lng: 78.4750, name: "Hussain Sagar North Gate" },
  { id: "CP 7", x: 3.1, y: 5.5, lat: 17.4360, lng: 78.4600, name: "Somajiguda Circle Station" },
  { id: "CP 8", x: 1.6, y: 5.2, lat: 17.4380, lng: 78.4460, name: "Punjagutta Junction Hub" },
];

export function CitySimulation({ sim, policy }: CitySimulationProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mapMode, setMapMode] = useState<"real" | "grid">("real");

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  const run = sim?.runs[policy];
  const frames = run?.frames || [];
  const currentFrame = frames[frameIndex] || null;
  const startHour = sim?.params.startHour || 8;
  const endHour = sim?.params.endHour || 20;

  useEffect(() => {
    let timer: number;
    if (isPlaying && frames.length > 0) {
      timer = window.setInterval(() => {
        setFrameIndex((idx) => {
          if (idx >= frames.length - 1) {
            setIsPlaying(false);
            return idx;
          }
          return idx + 1;
        });
      }, 1000 / speed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, frames.length, speed]);

  // Initialize Real Leaflet Map of Begumpet, Hyderabad
  useEffect(() => {
    const checkAndInitLeaflet = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [17.4448, 78.4664], // Begumpet, Hyderabad
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
        });

        // Crisp OpenStreetMap standard tiles (No API key watermark required)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          subdomains: ["a", "b", "c"],
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        mapInstanceRef.current = map;
      }

      if (mapInstanceRef.current) {
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, 100);
      }
    };

    const t = setTimeout(checkAndInitLeaflet, 150);

    let ro: ResizeObserver | null = null;
    if (mapContainerRef.current) {
      ro = new ResizeObserver(() => {
        mapInstanceRef.current?.invalidateSize();
      });
      ro.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(t);
      if (ro) ro.disconnect();
    };
  }, [mapMode]);

  // Update Real Map Markers (Riders & Cooling Points) on Frame Change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !markersLayerRef.current || !currentFrame) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();

    // 1. Plot Cooling Points on Real Map
    COOLING_POINTS.forEach((cp) => {
      const icon = L.divIcon({
        className: "custom-cp-pin",
        html: `<div style="background:#0F766E; color:#FFFFFF; border:2px solid #FFFFFF; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.3);">💧</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([cp.lat, cp.lng], { icon })
        .bindTooltip(`<b>${cp.name}</b><br/>Water refill + shade mister`, { direction: "top" })
        .addTo(layer);
    });

    // 2. Plot Simulated Riders mapped to Hyderabad street bounding box
    currentFrame.riders.forEach((r) => {
      // Map 10x10 km simulation grid to Begumpet coords [17.41 to 17.48, 78.43 to 78.50]
      const lat = 17.4448 + (r.y - 5) * 0.007;
      const lng = 78.4664 + (r.x - 5) * 0.007;

      let color = "#6B7280"; // idle
      if (r.state === "delivering") color = "#2563EB";
      else if (r.state === "resting") color = "#D97706";
      else if (r.state === "paused") color = "#DC2626";

      L.circleMarker([lat, lng], {
        radius: r.state === "resting" ? 7 : 5,
        fillColor: color,
        color: "#FFFFFF",
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(layer);
    });
  }, [currentFrame, mapMode]);

  if (!sim || !currentFrame) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest text-xs text-on-surface-variant">
        Map area (run a simulation)
      </div>
    );
  }

  const counts = {
    idle: 0,
    delivering: 0,
    resting: 0,
    paused: 0
  };

  currentFrame.riders.forEach(r => {
    counts[r.state] = (counts[r.state] || 0) + 1;
  });

  const event = currentFrame.events?.[0];

  return (
    <div className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 lg:p-5 shadow-xs flex flex-col justify-between h-full gap-3">
      {/* Card Title & Map View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-outline-variant/60 gap-2 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "24px" }}>
              City Simulation · Begumpet Urban Zone
            </h2>
            <span className="font-mono text-[11px] bg-surface-container px-2.5 py-0.5 rounded-lg border border-outline-variant font-semibold text-on-surface">
              10 × 10 km
            </span>
          </div>
          <p className="font-body-sm text-xs text-on-surface-variant">50 rider agents real-time occupational heat exposure model</p>
        </div>

        {/* Real Map / Simulation Grid Toggle */}
        <div className="inline-flex items-center border border-outline-variant rounded-lg p-0.5 bg-surface-container text-xs font-semibold gap-0.5 self-start sm:self-auto shadow-xs">
          <button 
            type="button"
            onClick={() => setMapMode("real")}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              mapMode === "real" 
                ? "bg-surface-container-lowest text-primary font-bold shadow-xs" 
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">map</span>
            <span>Real Map (Hyderabad)</span>
          </button>
          <button 
            type="button"
            onClick={() => setMapMode("grid")}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              mapMode === "grid" 
                ? "bg-surface-container-lowest text-primary font-bold shadow-xs" 
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">grid_view</span>
            <span>Sim Grid</span>
          </button>
        </div>
      </div>

      {/* Map Display Container: flex-1 to fill all vertical height evenly */}
      <div className="relative w-full flex-1 min-h-[480px] lg:min-h-[510px] bg-[#EFEFEA] rounded-xl border border-outline-variant overflow-hidden select-none shadow-inner">
        {/* Real Leaflet Map */}
        <div 
          ref={mapContainerRef} 
          className={`w-full h-full absolute inset-0 z-0 transition-opacity duration-300 ${mapMode === "real" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} 
          style={{ background: "#F5F2EB" }} 
        />
        
        {/* Stylized SVG Simulation Grid */}
        <div className={`w-full h-full absolute inset-0 z-0 transition-opacity duration-300 ${mapMode === "grid" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
          <svg className="w-full h-full" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient cx="45%" cy="40%" id="heat-micro-1" r="40%">
                <stop offset="0%" stopColor="#F97316" stopOpacity="0.22" />
                <stop offset="70%" stopColor="#F97316" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
              </radialGradient>
              <radialGradient cx="75%" cy="70%" id="heat-micro-2" r="35%">
                <stop offset="0%" stopColor="#EF4444" stopOpacity="0.26" />
                <stop offset="60%" stopColor="#EF4444" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect fill="#EFEFEA" height="600" width="800" x="0" y="0" />
            <circle cx="360" cy="240" fill="url(#heat-micro-1)" r="300" />
            <circle cx="600" cy="420" fill="url(#heat-micro-2)" r="260" />

            {/* Arterial Road Grid */}
            <g stroke="#CAC6B7" strokeLinecap="round" strokeWidth="4">
              <path d="M 0 140 Q 280 180 500 130 T 800 160" fill="none" />
              <path d="M 120 0 Q 180 300 240 600" fill="none" />
              <path d="M 640 0 C 600 200 680 400 620 600" fill="none" />
              <path d="M 0 420 H 800" fill="none" />
            </g>

            {/* Cooling Points in SVG */}
            {COOLING_POINTS.map((cp) => (
              <g key={cp.id} transform={`translate(${cp.x * 80}, ${cp.y * 60})`}>
                <circle cx="0" cy="0" fill="#0F766E" r="10" stroke="#FFFFFF" strokeWidth="2" />
                <text fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle" y="3">💧</text>
                <text fill="#0F766E" fontSize="9" fontWeight="bold" textAnchor="middle" y="18">{cp.id}</text>
              </g>
            ))}

            {/* Riders in SVG */}
            <g stroke="#FFFFFF" strokeWidth="1.5">
              {currentFrame.riders.map((r) => {
                const cx = r.x * 80;
                const cy = r.y * 60;
                let fill = "#6B7280";
                if (r.state === "delivering") fill = "#2563EB";
                else if (r.state === "resting") fill = "#D97706";
                else if (r.state === "paused") fill = "#DC2626";
                return <circle key={r.id} cx={cx} cy={cy} fill={fill} r={r.state === "resting" ? 8 : 6} />;
              })}
            </g>
          </svg>
        </div>

        {/* Map Overlay Top-Left: Digital Clock (compact) */}
        <div className="absolute top-3.5 left-3.5 z-10 bg-surface-container-lowest/95 border border-outline-variant px-3 py-2 rounded-xl shadow-md pointer-events-none">
          <div className="font-mono font-bold tracking-wide text-on-surface leading-none" style={{ letterSpacing: "0.06em", fontFamily: '"Bebas Neue", sans-serif', fontSize: "36px" }}>
            {formatTime(startHour, currentFrame.minute)}
          </div>
          <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mt-0.5">1 sec = 1 min</div>
        </div>

        {/* Map Overlay Top-Right: Heat Index & Demand Badge (compact) */}
        <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-lowest/95 border border-error/30 text-error shadow-md text-xs font-bold">
            <span className="material-symbols-outlined text-[15px]">device_thermostat</span>
            <span>Heat index {currentFrame.heatIndexC}°C</span>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary/20 shadow-md text-xs font-bold">
            <span className="material-symbols-outlined text-[15px]">local_fire_department</span>
            <span>{demandLabels[currentFrame.demandLevel]}</span>
          </div>
        </div>
      </div>

      {/* Bottom Playback Controls & Timeline Bar (compact) */}
      <div className="flex flex-col gap-3 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Play / Pause & Timeline Scrubber */}
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-lg bg-primary hover:bg-[#0B4F4A] text-on-primary flex items-center justify-center shrink-0 shadow-xs focus:outline-none transition-all" 
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">{isPlaying ? "pause" : "play_arrow"}</span>
            </button>
            <div className="flex flex-col flex-1 px-1 gap-1">
              <div className="flex justify-between text-[11px] font-mono text-on-surface-variant font-semibold">
                <span>{startHour.toString().padStart(2, "0")}:00</span>
                <span className="text-primary font-bold">Current: {formatTime(startHour, currentFrame.minute)}</span>
                <span>{endHour.toString().padStart(2, "0")}:00</span>
              </div>
              <input 
                className="w-full accent-primary h-1.5 bg-outline-variant/50 rounded-lg cursor-pointer" 
                max={frames.length > 0 ? frames.length - 1 : 0} 
                min={0} 
                onChange={(e) => setFrameIndex(parseInt(e.target.value))}
                type="range" 
                value={frameIndex} 
              />
            </div>
          </div>
          {/* Simulation Speed Multiplier Controls */}
          <div className="flex items-center gap-1 border border-outline-variant rounded-lg p-0.5 bg-surface-container-lowest shrink-0 shadow-xs">
            {[1, 2, 4].map(s => (
              <button 
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${speed === s ? "bg-primary text-on-primary shadow-xs" : "text-on-surface-variant hover:text-on-surface"}`} 
                type="button"
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Clean Status Indicator Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2 border-t border-outline-variant/60 text-xs font-medium text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6B7280] inline-block shadow-xs"></span>
            <span>Idle ({counts.idle})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] inline-block shadow-xs"></span>
            <span>Delivering ({counts.delivering})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] inline-block shadow-xs"></span>
            <span>Resting ({counts.resting})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] inline-block shadow-xs"></span>
            <span>Paused ({counts.paused})</span>
          </div>
        </div>
      </div>

      {/* Monospace Event Ticker Bar (compact) */}
      <div className="w-full bg-[#1B1F23] text-white font-mono text-xs px-4 py-2.5 rounded-lg flex items-center justify-between overflow-x-auto shadow-xs">
        <div className="flex items-center gap-2.5 shrink-0">
          {event ? (
            <>
              <span className="text-[#80D5CB] font-bold">{formatTime(startHour, currentFrame.minute)}</span>
              <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-[11px]">{event.riderId}</span>
              <span className="text-[#FFB77D] font-bold">{event.outcome}</span>
              <span className="text-gray-300">{event.rule}</span>
            </>
          ) : (
            <>
              <span className="text-[#80D5CB] font-bold">13:25</span>
              <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-[11px]">R-014</span>
              <span className="text-[#D97706] font-bold">FORCE_REST</span>
              <span className="text-gray-300">fair-rest-due · Cooling Point 3 assigned (420m)</span>
            </>
          )}
        </div>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider shrink-0 pl-3 font-semibold">Sim Event Log</span>
      </div>
    </div>
  );
}
