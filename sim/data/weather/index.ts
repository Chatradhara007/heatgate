// The committed real weather days (npm run fetch-weather writes the JSON files; add each one here).
// Static imports, so the Lambda bundle carries them: the simulator never fetches weather.
import delhi_2020_06_19 from "./delhi-2020-06-19.json" with { type: "json" };
import delhi_2024_06_18 from "./delhi-2024-06-18.json" with { type: "json" };
import delhi_2025_06_13 from "./delhi-2025-06-13.json" with { type: "json" };
import hyderabad_2022_05_01 from "./hyderabad-2022-05-01.json" with { type: "json" };
import hyderabad_2023_05_13 from "./hyderabad-2023-05-13.json" with { type: "json" };
import hyderabad_2024_05_27 from "./hyderabad-2024-05-27.json" with { type: "json" };
import lucknow_2022_05_16 from "./lucknow-2022-05-16.json" with { type: "json" };
import lucknow_2024_05_29 from "./lucknow-2024-05-29.json" with { type: "json" };
import lucknow_2024_06_19 from "./lucknow-2024-06-19.json" with { type: "json" };

export const WEATHER_FILES: Record<string, unknown> = {
  "delhi-2020-06-19.json": delhi_2020_06_19,
  "delhi-2024-06-18.json": delhi_2024_06_18,
  "delhi-2025-06-13.json": delhi_2025_06_13,
  "hyderabad-2022-05-01.json": hyderabad_2022_05_01,
  "hyderabad-2023-05-13.json": hyderabad_2023_05_13,
  "hyderabad-2024-05-27.json": hyderabad_2024_05_27,
  "lucknow-2022-05-16.json": lucknow_2022_05_16,
  "lucknow-2024-05-29.json": lucknow_2024_05_29,
  "lucknow-2024-06-19.json": lucknow_2024_06_19,
};
