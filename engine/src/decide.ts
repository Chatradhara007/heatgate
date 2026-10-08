import * as cedar from "@cedar-policy/cedar-wasm/nodejs";
import type { DecideRequest, Decision, Outcome, PolicyVersion } from "@heatgate/contracts";
import { heatIndexC } from "./heatIndex.ts";
import { newDecisionId } from "./ids.ts";
import { POLICY_SETS, schema } from "./policies.ts";

const STRENGTH: Record<Outcome, number> = { ALLOW: 0, SKIP_ORDER: 1, DENY: 2, FORCE_REST: 3 };
const DEFAULT_REST_MINUTES = 20;

export function decide(request: DecideRequest, policy: PolicyVersion, now: Date = new Date()): Decision {
  const { tempC, humidityPct } = request.conditions;
  return decideWithHeatIndex(request, policy, heatIndexC(tempC, humidityPct), now);
}

// Same as decide(), but takes the heat index directly (the golden tests use this).
export function decideWithHeatIndex(
  request: DecideRequest,
  policy: PolicyVersion,
  heatIndex: number,
  now: Date = new Date(),
): Decision {
  const set = POLICY_SETS[policy];
  // Cedar only has whole numbers (Long).
  const context = {
    heatIndexC: Math.round(heatIndex),
    hourOfDay: Math.round(request.conditions.hourOfDay),
    minutesSinceBreak: Math.round(request.riderState.minutesSinceBreak),
    exposureMinutesToday: Math.round(request.riderState.exposureMinutesToday),
    restMinutesRemaining: Math.round(request.riderState.restMinutesRemaining),
    tripMinutes: Math.round(request.order.tripMinutes),
    demandLevel: request.conditions.demandLevel,
    alertLevel: request.conditions.alertLevel,
  };
  const distanceKm = Math.ceil(request.order.distanceKm);

  const principal = { type: "HeatGate::Rider", id: request.rider.id };
  const resource = { type: "HeatGate::Order", id: request.order.id };
  const entities: cedar.EntityJson[] = [
    { uid: principal, attrs: { vehicle: request.rider.vehicle }, parents: [] },
    { uid: resource, attrs: { zone: request.order.zone, distanceKm }, parents: [] },
  ];
  const check = (action: string) => {
    const answer = cedar.isAuthorized({
      principal,
      action: { type: "HeatGate::Action", id: action },
      resource,
      context,
      schema,
      validateRequest: true,
      policies: { staticPolicies: set.policies },
      entities,
    });
    if (answer.type === "failure") throw new Error(`Cedar: ${answer.errors.map((e) => e.message).join("; ")}`);
    if (answer.response.diagnostics.errors.length > 0) {
      throw new Error(`Cedar: ${answer.response.diagnostics.errors.map((e) => e.error.message).join("; ")}`);
    }
    return answer.response;
  };

  const assign = check("AssignOrder");
  let outcome: Outcome = "ALLOW";
  let firedRules: string[] = [];
  let message = "Order assigned.";
  let messages: Decision["messages"];
  let restMinutes = 0;

  if (assign.decision === "deny") {
    // Fired forbid rules in file order; the strongest outcome wins, ties go to the earliest rule.
    const reasons = new Set(assign.diagnostics.reason);
    const fired = set.rules.filter((r) => reasons.has(r.id) && r.annotations.outcome);
    let winner = fired[0];
    for (const rule of fired) {
      if (STRENGTH[rule.annotations.outcome as Outcome] > STRENGTH[winner.annotations.outcome as Outcome]) winner = rule;
    }
    const a = winner.annotations;
    outcome = a.outcome as Outcome;
    firedRules = [winner.id, ...fired.filter((r) => r !== winner).map((r) => r.id)];
    message = a.message;
    if (a.messageHi || a.messageTe || a.messageUr) {
      messages = {
        ...(a.messageHi && { hi: a.messageHi }),
        ...(a.messageTe && { te: a.messageTe }),
        ...(a.messageUr && { ur: a.messageUr }),
      };
    }
    if (outcome === "FORCE_REST") {
      restMinutes = winner.id.endsWith("-rest-in-progress")
        ? context.restMinutesRemaining
        : Number(a.restMinutes ?? DEFAULT_REST_MINUTES);
    }
  }

  const penaltyWaived = outcome !== "ALLOW" || check("DeclineWithoutPenalty").decision === "allow";

  return {
    decisionId: newDecisionId(now),
    at: now.toISOString(),
    policyVersion: policy,
    riderId: request.rider.id,
    orderId: request.order.id,
    ...(request.simulationId !== undefined && { simulationId: request.simulationId }),
    outcome,
    restMinutes,
    penaltyWaived,
    heatIndexC: context.heatIndexC,
    firedRules,
    message,
    ...(messages && { messages }),
    cedarContext: { ...context, distanceKm },
  };
}
