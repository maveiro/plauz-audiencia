"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const FONTES_TABS = [
  { href: "/fontes", label: "Fontes" },
  { href: "/fontes/revisao", label: "Revisão de local" },
  { href: "/fontes/sincronizacoes", label: "Sincronizações" },
];

export function FontesTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-4 border-b border-zinc-200 text-sm dark:border-zinc-800">
      {FONTES_TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 pb-2",
              active
                ? "border-zinc-900 font-medium text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
