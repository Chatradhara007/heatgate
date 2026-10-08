// The only source of randomness in the simulator (mulberry32). Never Math.random.
export type Rng = () => number; // uniform in [0, 1)

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Independent streams per seed, so e.g. the order stream does not depend on how riders were drawn.
export function stream(seed: number, name: string): Rng {
  let h = seed >>> 0;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x9e3779b1) >>> 0;
  return mulberry32(h);
}

export const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

export function poisson(rng: Rng, mean: number): number {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = rng();
  while (p > limit) {
    k++;
    p *= rng();
  }
  return k;
}
