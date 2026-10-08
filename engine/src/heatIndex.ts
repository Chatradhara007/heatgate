// NOAA heat index (Rothfusz regression with the NWS adjustments), °C in and out.
// A proxy for outdoor heat stress, not a medical measure.
export function heatIndexC(tempC: number, humidityPct: number): number {
  if (tempC < 27) return tempC;
  const t = tempC * 1.8 + 32;
  const rh = humidityPct;
  let hi =
    -42.379 +
    2.04901523 * t +
    10.14333127 * rh -
    0.22475541 * t * rh -
    0.00683783 * t * t -
    0.05481717 * rh * rh +
    0.00122874 * t * t * rh +
    0.00085282 * t * rh * rh -
    0.00000199 * t * t * rh * rh;
  if (rh < 13 && t >= 80 && t <= 112) {
    hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  } else if (rh > 85 && t >= 80 && t <= 87) {
    hi += ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return (hi - 32) / 1.8;
}
