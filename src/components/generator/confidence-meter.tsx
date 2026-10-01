import { cn } from "@/lib/utils";
import type { Confidence } from "@/lib/types";

const bandLabel: Record<Confidence["band"], string> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
};

const bandColor: Record<Confidence["band"], string> = {
  high: "bg-success",
  moderate: "bg-warning",
  low: "bg-danger",
};

export function ConfidenceMeter({
  confidence,
  compact = false,
}: {
  confidence: Confidence;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-hover">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", bandColor[confidence.band])}
            style={{ width: `${confidence.score}%` }}
          />
        </div>
        <span className="font-mono text-[0.6875rem] text-muted-foreground">
          {confidence.score}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow">AI confidence</p>
          <p className="font-mono text-sm text-foreground">
            {confidence.score}
            <span className="text-subtle-foreground">/100</span>
            <span className="ml-2 text-muted-foreground">
              {bandLabel[confidence.band]}
            </span>
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-hover">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700", bandColor[confidence.band])}
            style={{ width: `${confidence.score}%` }}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Calculated from the brief and the output — not self-reported by the
          model. More research in the notes field raises it the fastest.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {confidence.signals.map((signal) => (
          <li key={signal.label} className="flex flex-col gap-1.5 py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {signal.label}
              </span>
              <span className="font-mono text-[0.6875rem] text-muted-foreground">
                {signal.earned}/{signal.weight}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {signal.detail}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
