import type { MasteryProjection } from "@/domain/mastery/masteryTypes";

const levelLabel = (level: string): string => level.charAt(0).toUpperCase() + level.slice(1);

/** Compact progression summary; detailed run history stays in the existing sections below it. */
export function MasteryPanel({ mastery }: { mastery: MasteryProjection }) {
  const recommended = mastery.skills.find(
    (skill) => skill.family === mastery.recommendedFamily,
  );

  return (
    <section aria-labelledby="mastery-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="mastery-heading"
          className="text-[11px] font-medium tracking-widest text-muted uppercase"
        >
          Mastery
        </h2>
        <p className="text-[12px] font-medium text-ink">
          Recommended practice: {recommended?.label}
        </p>
      </div>

      <div className="grid overflow-hidden rounded-lg border border-line sm:grid-cols-2">
        {mastery.skills.map((skill) => (
          <div
            key={skill.family}
            className="border-b border-line p-3 last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
          >
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-ink">{skill.label}</span>
              <span className="text-[11px] text-muted">
                {levelLabel(skill.level)} · {skill.runCount} runs
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${skill.label} mastery`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={skill.score}
              className="mt-2 h-1 overflow-hidden rounded-full bg-surface-raised"
            >
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${skill.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {(mastery.badges.length > 0 || mastery.unlockSignals.length > 0) && (
        <div className="flex flex-wrap gap-2 text-[11px] text-muted">
          {mastery.badges.map((badge) => (
            <span key={badge} className="rounded border border-line px-2 py-1">
              {badge}
            </span>
          ))}
          {mastery.unlockSignals.map((signal) => (
            <span key={signal} className="rounded border border-accent/40 px-2 py-1 text-ink">
              Cosmetic signal · {signal}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
