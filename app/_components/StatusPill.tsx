const STATUS_CONFIG = {
  active: { label: "Ativa", icon: "●", className: "text-[color:var(--status-good)]" },
  paused: { label: "Pausada", icon: "⏸", className: "text-zinc-500 dark:text-zinc-400" },
  error: { label: "Erro", icon: "⛔", className: "text-[color:var(--status-critical)]" },
} as const;

export function StatusPill({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.className}`}>
      <span aria-hidden>{config.icon}</span>
      {config.label}
    </span>
  );
}
