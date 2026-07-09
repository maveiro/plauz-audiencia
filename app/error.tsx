"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
      <h2 className="font-semibold text-red-800 dark:text-red-300">
        Algo deu errado
      </h2>
      <p className="text-sm text-red-700 dark:text-red-400">{error.message}</p>
      <button
        onClick={reset}
        className="w-fit rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900"
      >
        Tentar de novo
      </button>
    </div>
  );
}
