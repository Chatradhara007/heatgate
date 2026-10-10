import * as api from "../api.ts";
import { useQuery } from "./useAsync.ts";

// The default SimParams plus fairKnobs (the default heatgate-fair knobs): the starting values for the Simulator sliders.
export function useDefaults() {
  return useQuery((signal) => api.defaults(signal), "defaults");
}
