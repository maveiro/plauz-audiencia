import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { NavLinks } from "./_components/NavLinks";
import { ToastProvider } from "./_components/ToastProvider";
import { createClient } from "@/lib/supabase/serverClient";
import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unificador de Interessados",
  description:
    "Unifica respostas de Google Sheets e uploads de CSV/XLS em uma base única de interessados, por artista e evento.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="pt-BR"
      className={cn("h-full", "antialiased", geistMono.variable, "font-sans", inter.variable)}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4 text-sm">
            <Link href="/" className="flex items-center">
              <Image src="/plauz-logo.png" alt="Plauz" width={800} height={322} className="h-7 w-auto" priority />
            </Link>
            <NavLinks />
            {user && (
              <div className="ml-auto flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                <span>{user.email}</span>
                <form action={signOutAction}>
                  <Button type="submit" variant="outline" size="sm">
                    Sair
                  </Button>
                </form>
              </div>
            )}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </body>
    </html>
  );
}
