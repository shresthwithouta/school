"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Square, Loader2 } from "lucide-react";

export function PendingDecisions({ decisions }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);

  async function markDone(d) {
    setBusy(d.decisionId);
    const res = await fetch(
      `/api/meetings/${d.meetingId}/decisions/${d.decisionId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      }
    );
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not update");
      return;
    }
    router.refresh();
  }

  if (decisions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No pending decisions from your meetings.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {decisions.map((d) => (
        <li
          key={d.decisionId}
          className="flex items-start gap-2 rounded-lg border p-2.5"
        >
          <button
            type="button"
            onClick={() => markDone(d)}
            disabled={!!busy}
            title="Mark as done"
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-500 disabled:opacity-50"
          >
            {busy === d.decisionId ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Square className="size-4" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm">{d.text}</p>
            <div className="flex flex-wrap items-center gap-x-2 text-xs">
              <Link
                href={`/meetings/${d.meetingKey}`}
                className="text-muted-foreground hover:text-foreground"
              >
                {d.meetingKey} · {d.meetingTitle}
              </Link>
              {d.dueDate && (
                <span
                  className={
                    d.overdue
                      ? "font-medium text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground"
                  }
                >
                  · due {new Date(d.dueDate).toLocaleDateString("en-GB")}
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
