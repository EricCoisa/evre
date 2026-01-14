import { Banner } from "@/components/banner";

export default function AcessoNegadoPage() {
  return (
    <div className="min-h-screen flex">
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12 bg-background">
        <div className="w-full max-w-md mx-auto text-center">
          <h2 className="text-3xl font-bold text-destructive mb-4">Acesso Negado</h2>
          <p className="text-lg text-muted-foreground mb-6">
            Você não tem permissão para acessar esta página.<br />
            Caso acredite que isso seja um engano, entre em contato com o administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
