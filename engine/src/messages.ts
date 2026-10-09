// What the rider is told, in every language, and the nearest cooling point for a rest.
// Messages only describe a decision; nothing here changes an outcome.
import type { DecideRequest, Decision } from "@heatgate/contracts";
import { TRANSLATIONS } from "./translations.ts";

// The English text of an ALLOW (no rule fired). Its translations are the "allow" row of messages.csv.
export const ALLOW_MESSAGE = "Order assigned.";
export const ALLOW_MESSAGE_KEY = "allow";

type Messages = NonNullable<Decision["messages"]>;

// Translations for one message. A rule's own @messageHi/@messageTe/@messageUr win; otherwise the table
// from docs/translations/messages.csv, but only if it was translated from this exact English text
// (a knob-rendered or edited rule with different words gets no stale translation).
export function messagesFor(key: string, english: string, annotations: Record<string, string> = {}): Messages | undefined {
  const row = TRANSLATIONS[key]?.english === english ? TRANSLATIONS[key] : undefined;
  const hi = annotations.messageHi || row?.hi;
  const te = annotations.messageTe || row?.te;
  const ur = annotations.messageUr || row?.ur;
  if (!hi && !te && !ur) return undefined;
  return { ...(hi && { hi }), ...(te && { te }), ...(ur && { ur }) };
}

export interface NamedPoint {
  name: string;
  x: number; // km in the 10x10 city
  y: number;
}

// The nearest cooling point to the rider and how far it is, rounded to 10 m. Ties go to the first point.
export function nearestCoolingPoint(rider: DecideRequest["rider"], points: readonly NamedPoint[]): Decision["coolingPoint"] {
  let best: NamedPoint | undefined;
  let bestKm = Infinity;
  for (const p of points) {
    const km = Math.hypot(p.x - rider.x, p.y - rider.y);
    if (km < bestKm) {
      best = p;
      bestKm = km;
    }
  }
  return best && { name: best.name, distanceM: Math.round(bestKm * 100) * 10 };
}

// The copy of a decision that goes into the audit log. coolingPoint is left out: a distance to a known,
// fixed point would say where the rider was, and the audit log never stores a rider location.
export function auditRecord(decision: Decision): Decision {
  const { coolingPoint: _location, ...rest } = decision;
  return rest;
}
