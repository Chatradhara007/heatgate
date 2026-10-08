@id("base-allow-assign")
permit (principal is HeatGate::Rider,
        action == HeatGate::Action::"AssignOrder",
        resource is HeatGate::Order);

@id("ndma-rest-in-progress")
@outcome("FORCE_REST")
@message("Your cooling break is still running. No penalty and no pay cut.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.restMinutesRemaining > 0 };

@id("ndma-peak-hours-pause")
@outcome("DENY")
@message("Heat alert: no mandatory orders from 11 AM to 4 PM. No penalty.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.alertLevel >= 1
    && context.hourOfDay >= 11 && context.hourOfDay < 16 };

@id("ndma-break-due")
@outcome("FORCE_REST")
@restMinutes("15")
@message("Heat alert: 15-minute cooling break after 90 minutes of work. No penalty and no pay cut.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.alertLevel >= 1
    && context.minutesSinceBreak + context.tripMinutes > 90 };

@id("ndma-reduced-radius")
@outcome("SKIP_ORDER")
@message("Heat alert: orders are limited to 3 km.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.alertLevel >= 1 && resource.distanceKm > 3 };

@id("ndma-decline-no-penalty")
permit (principal, action == HeatGate::Action::"DeclineWithoutPenalty",
        resource)
when { context.alertLevel >= 1 };
