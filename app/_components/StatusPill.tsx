import { Circle, Pause, CircleX } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  active: { label: "Ativa", Icon: Circle, className: "text-[color:var(--status-good)]" },
  paused: { label: "Pausada", Icon: Pause, className: "text-zinc-500 dark:text-zinc-400" },
  error: { label: "Erro", Icon: CircleX, className: "text-[color:var(--status-critical)]" },
} as const;

export function StatusPill({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const { label, Icon, className } = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={className}>
      <Icon aria-hidden className={status === "active" ? "fill-current" : undefined} />
      {label}
    </Badge>
  );
}
