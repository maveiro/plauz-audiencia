"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/artistas", label: "Artistas" },
  { href: "/fontes", label: "Fontes" },
  { href: "/publico-sobreposto", label: "Sobreposição de público" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV_LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "border-b-2 border-zinc-900 pb-1 font-medium text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                : "border-b-2 border-transparent pb-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
