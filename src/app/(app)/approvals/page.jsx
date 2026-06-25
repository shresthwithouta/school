import Link from "next/link";
import { ArrowRight, CheckCheck } from "lucide-react";

import { requireManager } from "@/lib/session";
import { listVisibleTasks } from "@/lib/tasks";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/tasks/task-badges";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const user = await requireManager();
  const tasks = await listVisibleTasks(user);

  const canReview = (t) => t.assignerId === user.id || user.tier === "OWNER";
  const pending = tasks.filter(
    (t) => canReview(t) && t.assignees.some((a) => a.status === "submitted")
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Submitted work waiting for your review and approval."
      />

      {pending.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCheck className="size-6" />
          </div>
          <h3 className="mt-3 font-medium">Nothing to review</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            When someone submits work on a task you created, it appears here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {pending.map((t) => {
            const submitters = t.assignees.filter((a) => a.status === "submitted");
            return (
              <Card key={t.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status="submitted" />
                      <PriorityBadge priority={t.priority} />
                      {t.dueDate && (
                        <span className="text-xs text-muted-foreground">
                          due {formatDate(t.dueDate)}
                        </span>
                      )}
                    </div>
                    <h3 className="truncate font-medium">{t.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Submitted by {submitters.map((s) => s.name).join(", ")}
                    </p>
                  </div>
                  <Button asChild className="shrink-0">
                    <Link href={`/tasks/${t.id}`}>
                      Review
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
