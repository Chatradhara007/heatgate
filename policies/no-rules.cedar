@id("base-allow-assign")
permit (principal is HeatGate::Rider,
        action == HeatGate::Action::"AssignOrder",
        resource is HeatGate::Order);
