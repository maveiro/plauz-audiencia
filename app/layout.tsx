import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/serverClient";
import { signOutAction } from "@/lib/auth/actions";
import { NavLinks } from "./_components/NavLinks";
import { ToastProvider } from "./_components/ToastProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4 text-sm">
            <span className="font-semibold">Interessados</span>
            <NavLinks />
            {user && (
              <div className="ml-auto flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                <span>{user.email}</span>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Sair
                  </button>
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
