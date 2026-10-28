import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import LangLabel from "@/components/ui/langLabel";
import { ProposalTab } from "./components/proposal-tab";

/**
 * Server Component — não ponha `'use client'` aqui.
 *
 * Esta página é o lugar onde feature flag e permissão decidem **o que existe na tela**;
 * a interação toda (tabela, filtros, modais) mora em `./components/`. Ver
 * `docs/frontend/page-structure.md` → "Gating é decisão do servidor".
 *
 * Rótulo em RSC vai em <LangLabel>, não em t() — o i18n aqui só roda no cliente.
 */
export default function ProposalPage() {
  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={<LangLabel text="title" langJson="proposal" />}
        description={<LangLabel text="description" langJson="proposal" />}
      />
      <ProposalTab />
    </Container>
  );
}
