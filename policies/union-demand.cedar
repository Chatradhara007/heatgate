@id("base-allow-assign")
permit (principal is HeatGate::Rider,
        action == HeatGate::Action::"AssignOrder",
        resource is HeatGate::Order);

@id("union-rest-in-progress")
@outcome("FORCE_REST")
@message("Your cooling break is still running. No penalty.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.restMinutesRemaining > 0 };

@id("union-rest-due")
@outcome("FORCE_REST")
@restMinutes("20")
@message("Heatwave day: paid 20-minute cooling break after 2 hours of work. Nearest shade and water below. No penalty.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.alertLevel >= 1
    && context.minutesSinceBreak + context.tripMinutes > 120 };

@id("union-decline-no-penalty")
permit (principal, action == HeatGate::Action::"DeclineWithoutPenalty",
        resource)
when { context.alertLevel >= 1 };
