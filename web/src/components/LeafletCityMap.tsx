// The "City map" view: the simulator's 10 x 10 km grid drawn as a square on OpenStreetMap tiles, centred on the
// run's city. An illustration only: riders and cooling points come from the result, not from real places.
// Loaded lazily (React.lazy), so Leaflet stays out of the main bundle until someone opens the map.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Frame, RiderState } from "@heatgate/contracts";
import { CITY_KM, kmToLatLng, type CoolingPoint } from "../lib/cityMap.ts";

export const TILE_TIMEOUT_MS = 4_000;
const TILE_ERRORS_BEFORE_GIVING_UP = 4;

interface Props {
  centre: { lat: number; lng: number };
  frame: Frame;
  coolingPoints: CoolingPoint[];
  tweenMs: number; // how long a rider takes to glide to its next position (one frame at the current speed)
  stateColor: Record<RiderState, string>;
  onTilesFailed: (reason: string) => void;
}

export default function LeafletCityMap({ centre, frame, coolingPoints, tweenMs, stateColor, onTilesFailed }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const ridersRef = useRef(new Map<string, L.Marker>());
  const pointsRef = useRef<L.LayerGroup | null>(null);
  const failedRef = useRef(onTilesFailed);
  failedRef.current = onTilesFailed;

  // The map, its tiles and the grid: once per city.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ll = (x: number, y: number) => L.latLng(...kmToLatLng(centre, x, y));
    const bounds = L.latLngBounds(ll(0, 0), ll(CITY_KM, CITY_KM));
    const map = L.map(box, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
      maxBounds: bounds.pad(0.5),
      minZoom: 10,
      maxZoom: 16,
      zoomSnap: 0.25, // lets the 10 km square fill the box instead of jumping a whole zoom level
    });
    map.attributionControl.setPrefix(false);
    // Keep the square clear of the clock (top) and the illustration label (bottom) drawn over the map.
    map.fitBounds(bounds, { paddingTopLeft: [8, 48], paddingBottomRight: [8, 64] });
    mapRef.current = map;

    // Tiles: give up (back to the grid) when none has loaded in time, or several fail before any loads.
    let loaded = false;
    let errors = 0;
    let gaveUp = false;
    const giveUp = (reason: string) => {
      if (loaded || gaveUp) return;
      gaveUp = true;
      failedRef.current(reason);
    };
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    });
    tiles.on("tileload", () => (loaded = true));
    tiles.on("tileerror", () => {
      errors += 1;
      if (errors >= TILE_ERRORS_BEFORE_GIVING_UP) giveUp("the map tiles could not be loaded (offline, or the tile server is blocked)");
    });
    tiles.addTo(map);
    const timer = window.setTimeout(() => giveUp(`the map tiles did not load within ${TILE_TIMEOUT_MS / 1000} seconds`), TILE_TIMEOUT_MS);

    // The simulated 10 x 10 km square with 1 km grid lines.
    const grid = L.layerGroup().addTo(map);
    L.rectangle(bounds, { color: "#005c55", weight: 2, fill: true, fillColor: "#ffffff", fillOpacity: 0.15, interactive: false }).addTo(grid);
    for (let i = 1; i < CITY_KM; i++) {
      const line = { color: "#005c55", weight: 0.6, opacity: 0.45, interactive: false };
      L.polyline([ll(i, 0), ll(i, CITY_KM)], line).addTo(grid);
      L.polyline([ll(0, i), ll(CITY_KM, i)], line).addTo(grid);
    }
    pointsRef.current = L.layerGroup().addTo(map);

    // Riders glide with a CSS transition on their transform; switch it off while zooming so they do not lag.
    const container = map.getContainer();
    container.classList.add("hg-map-anim");
    map.on("zoomstart", () => container.classList.remove("hg-map-anim"));
    map.on("zoomend", () => container.classList.add("hg-map-anim"));

    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(box);
    const riders = ridersRef.current;
    return () => {
      window.clearTimeout(timer);
      resize.disconnect();
      riders.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [centre]);

  // Cooling points, labelled "CP n" only.
  useEffect(() => {
    const group = pointsRef.current;
    if (!group) return;
    group.clearLayers();
    for (const cp of coolingPoints) {
      L.marker(kmToLatLng(centre, cp.x, cp.y), {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: "hg-cp", html: `<span>${cp.label}</span>`, iconSize: [40, 18], iconAnchor: cp.labelBelow ? [20, -7] : [20, 25] }),
      }).addTo(group);
    }
  }, [coolingPoints, centre]);

  // Riders: one marker per id, moved (not re-created) every frame.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().style.setProperty("--hg-tween", `${tweenMs}ms`);
    const markers = ridersRef.current;
    const seen = new Set<string>();
    for (const r of frame.riders) {
      seen.add(r.id);
      const at = kmToLatLng(centre, r.x, r.y);
      let m = markers.get(r.id);
      if (!m) {
        m = L.marker(at, {
          keyboard: false,
          title: r.id,
          icon: L.divIcon({ className: "hg-rider", iconSize: [12, 12], iconAnchor: [6, 6] }),
        }).addTo(map);
        markers.set(r.id, m);
      } else {
        m.setLatLng(at);
      }
      const el = m.getElement();
      if (el) {
        el.style.backgroundColor = stateColor[r.state];
        el.classList.toggle("hg-rider--resting", r.state === "resting");
        el.title = `${r.id}: ${r.state}`;
      }
    }
    for (const [id, m] of markers) {
      if (!seen.has(id)) {
        m.remove();
        markers.delete(id);
      }
    }
  }, [frame, centre, tweenMs, stateColor]);

  return <div ref={boxRef} className="absolute inset-0 hg-city-map" aria-label="Simulated riders on a city map (illustration)" role="img" />;
}
