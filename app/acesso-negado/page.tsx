import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface AcessoNegadoPageProps {
  searchParams: Promise<{ reason?: string }>;
}

const REASON_MESSAGES: Record<string, string> = {
  domain: "Esse login não é de uma conta do domínio autorizado. Você foi desconectado.",
  no_access:
    "Sua conta é do domínio certo, mas ainda não tem acesso liberado a este app. Peça a um administrador para conceder o papel na plataforma Plauz.",
};

export default async function AcessoNegadoPage({ searchParams }: AcessoNegadoPageProps) {
  const { reason } = await searchParams;
  const message = REASON_MESSAGES[reason ?? "domain"] ?? REASON_MESSAGES.domain;

  return (
    <Card className="mx-auto flex max-w-sm flex-col gap-4 bg-destructive/10 p-6 text-center ring-destructive/30">
      <h1 className="font-semibold text-destructive">Acesso negado</h1>
      <p className="text-sm text-destructive/90">{message}</p>
      <Button variant="outline" asChild className="w-fit self-center">
        <Link href="/login">Tentar com outra conta</Link>
      </Button>
    </Card>
  );
}
