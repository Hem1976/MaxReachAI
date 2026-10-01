import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { QualityReport } from "@/lib/bulk/quality";
import type { BulkLeadStatus } from "@/lib/bulk/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Partial<Record<BulkLeadStatus, string>> = {
  ready: "Ready",
  needs_review: "Needs review",
  approved: "Approved",
  failed: "Failed",
  skipped: "Skipped",
  generating: "Generating",
  queued: "Queued",
};

export function QualityPanel({
  report,
  status,
}: {
  report: QualityReport;
  status: BulkLeadStatus;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Before you send</p>
        <Badge
          variant={
            status === "ready" || status === "approved"
              ? "success"
              : status === "needs_review"
                ? "warning"
                : status === "failed"
                  ? "danger"
                  : "outline"
          }
        >
          {STATUS_LABEL[status] ?? status}
        </Badge>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {report.items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            {item.passed ? (
              <Check className="size-3.5 shrink-0 text-success" />
            ) : (
              <X className="size-3.5 shrink-0 text-danger" />
            )}
            <span
              className={cn(
                item.passed ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 font-mono text-sm text-foreground">
        Score: {report.score}
        <span className="text-subtle-foreground">/100</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {report.passedCount}/{report.items.length} checks
        </span>
      </p>
    </div>
  );
}
