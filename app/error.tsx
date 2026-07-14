"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="flex flex-col gap-4 bg-destructive/10 p-6 ring-destructive/30">
      <h2 className="font-semibold text-destructive">Algo deu errado</h2>
      <p className="text-sm text-destructive/90">{error.message}</p>
      <Button variant="outline" onClick={reset} className="w-fit">
        Tentar de novo
      </Button>
    </Card>
  );
}
