// ULID-style id: 10 chars of time + 16 chars of a counter, Crockford base32.
// Deterministic (no Math.random): ids sort by time, then by call order.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
let counter = 0;

function encode(value: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out = ALPHABET[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

export function newDecisionId(now: Date): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return encode(now.getTime(), 10) + encode(counter, 16);
}
