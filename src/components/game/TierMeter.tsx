type TierMeterProps = {
  tier: number;
  heat: number;
  heatToPromote: number;
  overdriveRungs: number;
};

/** The ladder at a glance: five tier pips, heat progress toward the next rung, overdrive badge. */
export function TierMeter({ tier, heat, heatToPromote, overdriveRungs }: TierMeterProps) {
  return (
    <div
      className="flex items-center gap-2"
      role="status"
      aria-label={`Tier ${tier}${overdriveRungs > 0 ? `, overdrive ${overdriveRungs}` : ""}, heat ${heat} of ${heatToPromote}`}
    >
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((pip) => (
          <span
            key={pip}
            aria-hidden
            className={`h-2.5 w-2.5 rounded-sm ${pip <= tier ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: heatToPromote }, (_, dot) => (
          <span
            key={dot}
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${dot < heat ? "bg-warning" : "bg-line"}`}
          />
        ))}
      </div>
      {overdriveRungs > 0 && (
        <span className="rounded bg-accent/15 px-1.5 text-[11px] font-semibold text-accent">
          OVERDRIVE ×{overdriveRungs}
        </span>
      )}
    </div>
  );
}
