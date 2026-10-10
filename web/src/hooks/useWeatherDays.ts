import * as api from "../api.ts";
import { useQuery } from "./useAsync.ts";

// The real hot days a simulation can replay (GET /weather-days), for the Simulator's weather-day picker.
// Run one with useSimulation().run({ ...params, weather: { kind: "replay", weatherDayId: day.id } }).
export function useWeatherDays() {
  return useQuery((signal) => api.weatherDays(signal), "weather-days");
}
