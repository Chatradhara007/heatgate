import { useActiveSimulation } from "../context/SimulationContext.tsx";

interface ComparisonMetricItem {
  id: string;
  label: string;
  unit: string;
  isRupee?: boolean;
  baseline: {
    mean: number;
    min: number;
    max: number;
    display: string;
  };
  heatgate: {
    mean: number;
    min: number;
    max: number;
    display: string;
  };
  deltaLabel: string;
  deltaPercent: string;
  description: string;
  maxAxisValue: number;
}

export function ComparePage() {
  const { computedMetrics, isCustomRun } = useActiveSimulation();

  const comparisonMetrics: ComparisonMetricItem[] = [
    {
      id: "unsafe-exposure",
      label: "Unsafe Heat Exposure (>90 min unbroken work)",
      unit: "rider-hours",
      baseline: {
        mean: computedMetrics.unsafe90.baselineMean,
        min: computedMetrics.unsafe90.baselineMin,
        max: computedMetrics.unsafe90.baselineMax,
        display: `${computedMetrics.unsafe90.baselineMean} h`,
      },
      heatgate: {
        mean: computedMetrics.unsafe90.heatgateMean,
        min: computedMetrics.unsafe90.heatgateMin,
        max: computedMetrics.unsafe90.heatgateMax,
        display: `${computedMetrics.unsafe90.heatgateMean} h`,
      },
      deltaLabel: `${computedMetrics.unsafeExposureHours90Delta} rider-hours`,
      deltaPercent: "−79.2%",
      description: "Total courier-hours spent under direct heat past 90 minutes without a shaded hydration break.",
      maxAxisValue: 80,
    },
    {
      id: "delivery-time",
      label: "Average Order Delivery Duration",
      unit: "minutes",
      baseline: {
        mean: computedMetrics.deliveryTime.baselineMean,
        min: computedMetrics.deliveryTime.baselineMin,
        max: computedMetrics.deliveryTime.baselineMax,
        display: `${computedMetrics.deliveryTime.baselineMean} min`,
      },
      heatgate: {
        mean: computedMetrics.deliveryTime.heatgateMean,
        min: computedMetrics.deliveryTime.heatgateMin,
        max: computedMetrics.deliveryTime.heatgateMax,
        display: `${computedMetrics.deliveryTime.heatgateMean} min`,
      },
      deltaLabel: `+${computedMetrics.deliveryMinsDeltaMins} min`,
      deltaPercent: `+${computedMetrics.deliveryMinsDeltaPct}%`,
      description: "Mean time from merchant dispatch to customer drop-off during peak afternoon heatwave window.",
      maxAxisValue: 35,
    },
    {
      id: "rider-earnings",
      label: "Average Courier Daily Earnings (placeholder)",
      unit: "₹",
      isRupee: true,
      baseline: {
        mean: computedMetrics.riderEarnings.baselineMean,
        min: computedMetrics.riderEarnings.baselineMin,
        max: computedMetrics.riderEarnings.baselineMax,
        display: `₹${computedMetrics.riderEarnings.baselineMean}`,
      },
      heatgate: {
        mean: computedMetrics.riderEarnings.heatgateMean,
        min: computedMetrics.riderEarnings.heatgateMin,
        max: computedMetrics.riderEarnings.heatgateMax,
        display: `₹${computedMetrics.riderEarnings.heatgateMean}`,
      },
      deltaLabel: "+₹25 / rider (placeholder)",
      deltaPercent: "+3.0%",
      description: "Net earnings per rider shift including rest stipends and delivery incentives (placeholder).",
      maxAxisValue: 1000,
    },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-6 flex flex-col w-full gap-6 pb-16">
      {/* 1. HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl lg:text-3xl font-bold text-[#1B1F23] tracking-normal"
              style={{ fontFamily: '"Inter", sans-serif', letterSpacing: "-0.01em" }}
            >
              Platform View
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-[#E6F4F1] text-[#0F766E] border border-[#0F766E]/20">
              {isCustomRun ? "LIVE SANDBOX SYNCED" : "EXECUTIVE BRIEF"}
            </span>
          </div>
          <p className="text-sm text-[#4B5563] mt-0.5">
            HeatGate Fair compared with today&apos;s voluntary measures, on the same simulated day.
          </p>
        </div>

        {/* Right side chip */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E3E1DA] bg-[#FFFFFF] shadow-2xs text-[#4B5563] text-xs font-semibold self-start sm:self-auto">
          <span
            className="material-symbols-outlined text-[18px] text-[#0F766E]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            thermostat
          </span>
          <span className="font-mono text-xs">
            {isCustomRun ? "Sandbox run" : "Heatwave day"} · {computedMetrics.peakTempC}°C · {computedMetrics.seedsCount} seeds
          </span>
        </div>
      </header>

      {/* 2. TOP NEUTRAL GREY BANNER */}
      <div className="w-full bg-[#FAFAF7] border border-[#E3E1DA] rounded-xl p-4 flex items-start sm:items-center gap-3 shadow-2xs">
        <span
          className="material-symbols-outlined text-[20px] text-[#4B5563] shrink-0"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          info
        </span>
        <p className="text-xs text-[#4B5563] leading-relaxed">
          All rupee amounts are placeholders. The heat fee is a hypothesis: customers may order less,
          and it may overlap with state welfare fees. Not yet verified.
        </p>
      </div>

      {/* 3. FIVE STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-stretch">
        {/* CARD 1: Rest pay vs heat fee (spans 7 cols on large screens) */}
        <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-6 lg:p-7 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-[#0F766E]">
                balance
              </span>
              <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                Rest pay vs heat fee
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#E6F4F1] text-[#0F766E] border border-[#0F766E]/30">
                Fee covers the pay
              </span>
              <span className="text-[10px] font-mono text-[#4B5563] bg-[#FAFAF7] border border-[#E3E1DA] px-2 py-0.5 rounded">
                placeholder
              </span>
            </div>
          </div>

          {/* Giant Number / Pair */}
          <div className="my-1">
            <div
              className="text-[32px] sm:text-[38px] lg:text-[44px] font-bold text-[#1B1F23] tracking-tight leading-tight flex items-baseline flex-wrap gap-x-2.5 gap-y-1"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              <span>₹{computedMetrics.restPayInr.toLocaleString()} <span className="text-xl font-medium text-[#4B5563]">rest pay</span></span>
              <span className="text-[#4B5563] font-light text-2xl">·</span>
              <span className="text-[#0F766E]">₹{computedMetrics.heatFeeInr.toLocaleString()} <span className="text-xl font-medium text-[#0F766E]/80">heat fee</span></span>
            </div>
          </div>

          {/* Delta line with arrow and sign */}
          <div className="flex flex-col gap-1.5 pt-3 border-t border-[#E3E1DA]/80">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1B1F23] font-mono">
              <span className="material-symbols-outlined text-[18px] text-[#0F766E]">
                trending_up
              </span>
              <span>+{computedMetrics.netReserveSurplusInr >= 0 ? `₹${computedMetrics.netReserveSurplusInr.toLocaleString()}` : `−₹${Math.abs(computedMetrics.netReserveSurplusInr).toLocaleString()}`} net surplus to platform reserve (placeholder)</span>
            </div>
            <p className="text-xs text-[#4B5563] leading-relaxed">
              Customer heat surcharge during peak thermal alert fully offsets courier cooling rest stipends.
            </p>
          </div>
        </div>

        {/* CARD 2: Safety cost per order (spans 5 cols on large screens) */}
        <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-6 lg:p-7 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-[#0F766E]">
                payments
              </span>
              <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                Safety cost per order
              </span>
            </div>

            <span className="text-[10px] font-mono text-[#4B5563] bg-[#FAFAF7] border border-[#E3E1DA] px-2 py-0.5 rounded">
              placeholder
            </span>
          </div>

          {/* Giant Number (56 to 64px) */}
          <div className="my-1">
            <div
              className="text-[56px] lg:text-[64px] font-bold text-[#1B1F23] leading-none tracking-tight"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              ₹{computedMetrics.costPerOrderInr}
            </div>
          </div>

          {/* Delta line & Plain sentence */}
          <div className="flex flex-col gap-1.5 pt-3 border-t border-[#E3E1DA]/80">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#1B1F23]">
              <span className="material-symbols-outlined text-[16px] text-[#4B5563]">
                calculate
              </span>
              <span>(rest pay minus heat fee) divided by orders delivered</span>
            </div>
            <p className="text-xs text-[#4B5563] leading-relaxed">
              Effective net safety outlay equals {Math.round(computedMetrics.costPerOrderInr * 100)} paise per fulfilled delivery under active heat protocols.
            </p>
          </div>
        </div>

        {/* CARD 3: Delivery time change (spans 4 cols on large screens) */}
        <div className="lg:col-span-4 bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-6 lg:p-7 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-[#4B5563]">
                schedule
              </span>
              <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                Delivery time change
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#4B5563] bg-[#FAFAF7] border border-[#E3E1DA] px-2 py-0.5 rounded">
              SPEED DELTA
            </span>
          </div>

          {/* Giant Number (56 to 64px) */}
          <div className="my-1">
            <div
              className="text-[56px] lg:text-[64px] font-bold text-[#1B1F23] leading-none tracking-tight"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              +{computedMetrics.deliveryMinsDeltaPct}%
            </div>
          </div>

          {/* Delta line & Plain sentence */}
          <div className="flex flex-col gap-1.5 pt-3 border-t border-[#E3E1DA]/80">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#1B1F23]">
              <span className="material-symbols-outlined text-[16px] text-[#4B5563]">
                arrow_forward
              </span>
              <span>Average delivery {computedMetrics.avgDeliveryMinsBaseline} → {computedMetrics.avgDeliveryMinsHeatGate} min</span>
            </div>
            <p className="text-xs text-[#4B5563] leading-relaxed">
              A {computedMetrics.deliveryMinsDeltaMins}-minute addition to average delivery times during heat waves from scheduled recovery intervals.
            </p>
          </div>
        </div>

        {/* CARD 4: Late orders change (spans 4 cols on large screens) */}
        <div className="lg:col-span-4 bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-6 lg:p-7 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-[#4B5563]">
                alarm_on
              </span>
              <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                Late orders change
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#4B5563] bg-[#FAFAF7] border border-[#E3E1DA] px-2 py-0.5 rounded">
              DELAY DELTA
            </span>
          </div>

          {/* Giant Number (56 to 64px) */}
          <div className="my-1">
            <div
              className="text-[56px] lg:text-[64px] font-bold text-[#1B1F23] leading-none tracking-tight"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              +{computedMetrics.lateOrdersDelta}
            </div>
          </div>

          {/* Delta line & Plain sentence */}
          <div className="flex flex-col gap-1.5 pt-3 border-t border-[#E3E1DA]/80">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#1B1F23]">
              <span className="material-symbols-outlined text-[16px] text-[#4B5563]">
                arrow_forward
              </span>
              <span>{computedMetrics.lateOrdersBaseline} → {computedMetrics.lateOrdersHeatGate} orders over 45 minutes</span>
            </div>
            <p className="text-xs text-[#4B5563] leading-relaxed">
              Total orders exceeding 45 minutes across simulated city-wide peak dispatches.
            </p>
          </div>
        </div>

        {/* CARD 5: Unsafe heat prevented (spans 4 cols on large screens) */}
        <div className="lg:col-span-4 bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-6 lg:p-7 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-[#0F766E]">
                shield_with_heart
              </span>
              <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                Unsafe heat prevented
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#0F766E] bg-[#E6F4F1] border border-[#0F766E]/20 px-2 py-0.5 rounded font-bold">
              PROTECTION
            </span>
          </div>

          {/* Giant Number (56 to 64px) */}
          <div className="my-1 flex items-baseline flex-wrap gap-x-2">
            <span
              className="text-[56px] lg:text-[64px] font-bold text-[#1B1F23] leading-none tracking-tight"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              {computedMetrics.unsafeExposureHours120Delta}
            </span>
            <span className="text-xl lg:text-2xl font-bold text-[#0F766E]">
              rider-hours
            </span>
          </div>

          {/* Delta line & Plain sentence */}
          <div className="flex flex-col gap-1.5 pt-3 border-t border-[#E3E1DA]/80">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#1B1F23]">
              <span className="material-symbols-outlined text-[16px] text-[#0F766E]">
                verified
              </span>
              <span>beyond 120 min since rest; {computedMetrics.unsafeExposureHours90Delta} rider-hours beyond 90 min</span>
            </div>
            <p className="text-xs text-[#4B5563] leading-relaxed">
              Critical cumulative heat stress beyond 2 hours is almost completely eliminated across the fleet.
            </p>
          </div>
        </div>
      </div>

      {/* 4. BELOW: ONE CARD "What it costs vs what it protects" */}
      <section className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-6 lg:p-8 shadow-xs flex flex-col gap-6">
        {/* Card Header & Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E1DA]">
          <div>
            <h2
              className="text-lg lg:text-xl font-bold text-[#1B1F23] tracking-normal"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              What it costs vs what it protects
            </h2>
            <p className="text-xs text-[#4B5563] mt-0.5">
              Paired comparison of baseline vs HeatGate Fair with 5-seed range whiskers.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#6B7280]"></span>
              <span className="text-xs font-medium text-[#4B5563]">
                Baseline (Today: voluntary)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#0F766E]"></span>
              <span className="text-xs font-bold text-[#1B1F23]">
                HeatGate Fair
              </span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-[#E3E1DA] pl-3">
              <span className="font-mono text-xs text-[#4B5563] font-bold">|---•---|</span>
              <span className="text-xs text-[#4B5563]">
                Min–Max Range
              </span>
            </div>
          </div>
        </div>

        {/* Paired Horizontal Bar Chart */}
        <div className="space-y-8 pt-2">
          {comparisonMetrics.map((metric) => {
            const baselineWidth = `${Math.min(100, Math.max(0, (metric.baseline.mean / metric.maxAxisValue) * 100))}%`;
            const heatgateWidth = `${Math.min(100, Math.max(0, (metric.heatgate.mean / metric.maxAxisValue) * 100))}%`;

            const baselineMinLeft = `${Math.min(100, Math.max(0, (metric.baseline.min / metric.maxAxisValue) * 100))}%`;
            const baselineMaxLeft = `${Math.min(100, Math.max(0, (metric.baseline.max / metric.maxAxisValue) * 100))}%`;

            const heatgateMinLeft = `${Math.min(100, Math.max(0, (metric.heatgate.min / metric.maxAxisValue) * 100))}%`;
            const heatgateMaxLeft = `${Math.min(100, Math.max(0, (metric.heatgate.max / metric.maxAxisValue) * 100))}%`;

            return (
              <div
                key={metric.id}
                className="flex flex-col gap-3 group"
              >
                {/* Metric Label & Summary Delta */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1B1F23]">
                      {metric.label}
                    </span>
                    {metric.isRupee && (
                      <span className="text-[10px] font-mono text-[#4B5563] bg-[#FAFAF7] border border-[#E3E1DA] px-1.5 py-0.2 rounded">
                        placeholder
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-[#4B5563]">
                      Baseline: <strong className="text-[#1B1F23]">{metric.baseline.display}</strong>
                    </span>
                    <span className="text-xs font-mono text-[#0F766E] font-bold">
                      HeatGate: <strong>{metric.heatgate.display}</strong>
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#FAFAF7] border border-[#E3E1DA] text-[#1B1F23]">
                      Δ {metric.deltaLabel} ({metric.deltaPercent})
                    </span>
                  </div>
                </div>

                {/* Paired Bar Track */}
                <div className="bg-[#FAFAF7] border border-[#E3E1DA] rounded-xl p-4 flex flex-col gap-3.5 relative overflow-hidden">
                  {/* Row 1: Baseline Bar (Neutral Grey) */}
                  <div className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs font-semibold text-[#4B5563] text-right truncate">
                      Baseline
                    </span>
                    <div className="flex-1 relative h-6 bg-white border border-[#E3E1DA] rounded overflow-visible">
                      {/* Bar (Mean) */}
                      <div
                        className="h-full bg-[#6B7280] rounded-l transition-all duration-500"
                        style={{ width: baselineWidth }}
                      />

                      {/* Whisker Line (Min to Max with endcaps) */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-[2px] bg-[#1B1F23] pointer-events-none z-10 shadow-2xs"
                        style={{
                          left: baselineMinLeft,
                          width: `calc(${baselineMaxLeft} - ${baselineMinLeft})`,
                        }}
                      >
                        {/* Left Endcap */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 bg-[#1B1F23]"></div>
                        {/* Mean Marker Tick */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[#1B1F23]"
                          style={{
                            left: `calc((${metric.baseline.mean - metric.baseline.min} / ${Math.max(0.1, metric.baseline.max - metric.baseline.min)}) * 100%)`,
                          }}
                        ></div>
                        {/* Right Endcap */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 bg-[#1B1F23]"></div>
                      </div>
                    </div>
                    <div className="w-36 shrink-0 font-mono text-xs text-right flex items-center justify-end gap-1.5">
                      <strong className="text-[#1B1F23] text-sm">{metric.baseline.display}</strong>
                      <span className="text-[#4B5563] text-[11px]">({metric.baseline.min.toFixed(0)}–{metric.baseline.max.toFixed(0)})</span>
                    </div>
                  </div>

                  {/* Row 2: HeatGate Fair Bar (Teal) */}
                  <div className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs font-bold text-[#0F766E] text-right truncate">
                      HeatGate Fair
                    </span>
                    <div className="flex-1 relative h-6 bg-white border border-[#E3E1DA] rounded overflow-visible">
                      {/* Bar (Mean) */}
                      <div
                        className="h-full bg-[#0F766E] rounded-l transition-all duration-500"
                        style={{ width: heatgateWidth }}
                      />

                      {/* Whisker Line (Min to Max with endcaps) */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-[2px] bg-[#0B4F4A] pointer-events-none z-10 shadow-2xs"
                        style={{
                          left: heatgateMinLeft,
                          width: `calc(${heatgateMaxLeft} - ${heatgateMinLeft})`,
                        }}
                      >
                        {/* Left Endcap */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 bg-[#0B4F4A]"></div>
                        {/* Mean Marker Tick */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[#0B4F4A]"
                          style={{
                            left: `calc((${metric.heatgate.mean - metric.heatgate.min} / ${Math.max(0.1, metric.heatgate.max - metric.heatgate.min)}) * 100%)`,
                          }}
                        ></div>
                        {/* Right Endcap */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5 bg-[#0B4F4A]"></div>
                      </div>
                    </div>
                    <div className="w-36 shrink-0 font-mono text-xs text-right flex items-center justify-end gap-1.5">
                      <strong className="text-[#0F766E] text-sm">{metric.heatgate.display}</strong>
                      <span className="text-[#0F766E]/70 text-[11px]">({metric.heatgate.min.toFixed(0)}–{metric.heatgate.max.toFixed(0)})</span>
                    </div>
                  </div>

                  {/* Description subtitle */}
                  <div className="text-[11px] text-[#4B5563] pl-28">
                    {metric.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Short Note under the card */}
        <div className="pt-3 border-t border-[#E3E1DA] flex items-center justify-between text-xs text-[#4B5563] flex-wrap gap-2">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="material-symbols-outlined text-[16px] text-[#0F766E]">tune</span>
            <span>Thresholds are configurable and need expert review.</span>
          </div>
          <span className="font-mono text-[11px] text-[#4B5563]">
            Simulated over {computedMetrics.seedsCount} stochastic seeds · {computedMetrics.ordersDelivered} dispatches
          </span>
        </div>
      </section>
    </div>
  );
}
