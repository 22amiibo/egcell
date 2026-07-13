import type { ReactNode } from "react";

export function SettingControl({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_minmax(9rem,auto)] items-center gap-6 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        {htmlFor === undefined ? (
          <span className="block text-[13px] font-medium text-ink">{label}</span>
        ) : (
          <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
            {label}
          </label>
        )}
        {description !== undefined && (
          <p className="mt-0.5 text-[11px] leading-4 text-muted">{description}</p>
        )}
      </div>
      <div className="flex justify-end">{children}</div>
    </div>
  );
}

export function Toggle({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      id={id}
      aria-label={label}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 accent-accent disabled:opacity-40"
    />
  );
}

export const controlClassName =
  "min-h-9 rounded-md border border-line bg-surface px-2.5 text-[12px] text-ink shadow-sm transition-colors hover:border-line-strong";
