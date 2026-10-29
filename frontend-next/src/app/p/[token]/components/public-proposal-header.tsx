/** Faixa escura com o nome da marca e o descritor opcional, acima do corpo da proposta — mesma
 * anatomia do legado (`bg-foreground`, container alinhado a `max-w-4xl`), com nome/descritor
 * vindos de `SystemConfiguration` (`SYSTEM_APP_NAME`/`SYSTEM_APP_TAGLINE`) em vez de literal no
 * JSX. No celular o descritor empilha abaixo do nome; a partir de `sm` fica ao lado, separado por
 * borda, sem `nowrap` — nunca estoura a largura. */
export function PublicProposalHeader({
  name,
  tagline,
}: {
  name: string;
  tagline: string;
}) {
  return (
    <header className="bg-foreground shadow-md">
      <div className="mx-auto flex max-w-4xl flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:gap-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-background sm:text-4xl md:text-5xl">
          {name}
        </h1>
        {tagline ? (
          <span className="text-sm font-semibold text-background/80 sm:border-l-2 sm:border-background/30 sm:pl-4 sm:text-base md:text-lg">
            {tagline}
          </span>
        ) : null}
      </div>
    </header>
  );
}
