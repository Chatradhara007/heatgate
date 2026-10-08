@id("base-allow-assign")
permit (principal is HeatGate::Rider,
        action == HeatGate::Action::"AssignOrder",
        resource is HeatGate::Order);

@id("fair-rest-in-progress")
@outcome("FORCE_REST")
@message("Your paid cooling break is still running.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.restMinutesRemaining > 0 };

@id("fair-rest-early-in-lull")
@outcome("FORCE_REST")
@restMinutes("20")
@message("Orders are slow right now. Take a paid 20-minute break in the shade.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.heatIndexC >= 38
    && context.minutesSinceBreak >= 70
    && context.demandLevel == 0 };

@id("fair-rest-due")
@outcome("FORCE_REST")
@restMinutes("20")
@message("Paid 20-minute cooling break. Nearest shade and water below.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.heatIndexC >= 38
    && context.minutesSinceBreak + context.tripMinutes > 100
    && context.demandLevel < 2 };

@id("fair-rest-hard-limit")
@outcome("FORCE_REST")
@restMinutes("20")
@message("Paid 20-minute cooling break. Nearest shade and water below.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.heatIndexC >= 38
    && context.minutesSinceBreak + context.tripMinutes > 120 };

@id("fair-short-trips-only")
@outcome("SKIP_ORDER")
@message("This order is too far for this heat. You stay online for nearer orders.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.heatIndexC >= 41 && resource.distanceKm > 3 };

@id("fair-extreme-heat-stop")
@outcome("DENY")
@message("Extreme heat. Deliveries paused. Your incentive target is reduced for this time.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.heatIndexC >= 46 };

@id("fair-decline-no-penalty")
permit (principal, action == HeatGate::Action::"DeclineWithoutPenalty",
        resource)
when { context.heatIndexC >= 38 };
