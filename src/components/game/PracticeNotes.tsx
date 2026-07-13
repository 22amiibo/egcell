"use client";

import type { PracticeNote } from "@/domain/challenges/challengeTypes";

/**
 * Only ever rendered inside the result card, and only in practice mode. The run is already over by
 * the time this exists, which is the point: a hint shown mid-run would decide the run rather than
 * teach anything.
 */
export function PracticeNotes({ notes }: { notes: PracticeNote[] }) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <div data-testid="practice-notes" className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
      {notes.map((note) => (
        <div key={note.title} className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium tracking-widest text-accent-strong uppercase">
            {note.title}
          </span>
          <p className="text-[13px] leading-snug text-muted">{note.body}</p>
        </div>
      ))}
    </div>
  );
}
