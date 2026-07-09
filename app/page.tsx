import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Unificador de Interessados</h1>
      <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
        Cadastre artistas e eventos, conecte planilhas do Google Sheets ou
        envie arquivos CSV/XLS, e acompanhe os interessados consolidados em
        um único lugar.
      </p>
      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Ver dashboard
        </Link>
        <Link
          href="/fontes"
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Ver fontes cadastradas
        </Link>
        <Link
          href="/artistas"
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Gerenciar artistas
        </Link>
      </div>
    </div>
  );
}
