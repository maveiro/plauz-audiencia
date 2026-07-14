import { Card } from "@/components/ui/card";

interface StatTileProps {
  label: string;
  value: string;
  delta?: { value: string; direction: "up" | "down" | "flat" } | null;
  hint?: string;
}

export function StatTile({ label, value, delta, hint }: StatTileProps) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {delta && (
          <span
            className={
              delta.direction === "up"
                ? "text-sm font-medium text-[color:var(--status-good)]"
                : delta.direction === "down"
                  ? "text-sm font-medium text-[color:var(--status-critical)]"
                  : "text-sm font-medium text-muted-foreground"
            }
          >
            {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "•"} {delta.value}
          </span>
        )}
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Card>
  );
}
