import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AcessoNegadoPage() {
  return (
    <Card className="mx-auto flex max-w-sm flex-col gap-4 bg-destructive/10 p-6 text-center ring-destructive/30">
      <h1 className="font-semibold text-destructive">Acesso negado</h1>
      <p className="text-sm text-destructive/90">
        Esse login não é de uma conta do domínio autorizado. Você foi desconectado.
      </p>
      <Button variant="outline" asChild className="w-fit self-center">
        <Link href="/login">Tentar com outra conta</Link>
      </Button>
    </Card>
  );
}
