"use client";

import { useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";

import { formatDateTime } from "@/lib/utils";

const PAGE_SIZE = 6;

export function RecentActivityList({ activity }) {
  const [showAll, setShowAll] = useState(false);

  if (activity.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing has happened recently.</p>;
  }

  const visible = showAll ? activity : activity.slice(0, PAGE_SIZE);

  return (
    <>
      <ul className="divide-y">
        {visible.map((a) => (
          <li key={a.id}>
            <Link
              href={`/tasks/${a.taskKeyRef}`}
              className="-mx-2 flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent/40"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{a.actorName}</span> {a.message}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.taskKeyRef} · {a.taskTitle} · {formatDateTime(a.createdAt)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {activity.length > PAGE_SIZE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {showAll ? "Show less" : `See all activity (${activity.length})`}
        </button>
      )}
    </>
  );
}
