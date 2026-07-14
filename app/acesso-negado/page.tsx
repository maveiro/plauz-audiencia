import Link from "next/link";

export default function AcessoNegadoPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950">
      <h1 className="font-semibold text-red-800 dark:text-red-300">Acesso negado</h1>
      <p className="text-sm text-red-700 dark:text-red-400">
        Esse login não é de uma conta do domínio autorizado. Você foi desconectado.
      </p>
      <Link
        href="/login"
        className="w-fit self-center rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900"
      >
        Tentar com outra conta
      </Link>
    </div>
  );
}
