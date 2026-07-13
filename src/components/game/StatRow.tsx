"use client";

import type { ReactNode } from "react";

export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums text-ink">{value}</span>
    </div>
  );
}
