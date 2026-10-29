import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import LangLabel from "@/components/ui/langLabel";
import { CompanyTab } from "./components/company-tab";

/**
 * Server Component — não ponha `'use client'` aqui.
 *
 * Esta página é o lugar onde feature flag e permissão decidem **o que existe na tela**;
 * a interação toda (tabela, filtros, modais) mora em `./components/`. Ver
 * `docs/frontend/page-structure.md` → "Gating é decisão do servidor".
 *
 * Para esconder algo por flag, leia no servidor — assim o elemento não chega ao browser:
 *
 *   import { serverFeatureFlag } from '@/lib/server-context';
 *   const enabled = await serverFeatureFlag('MINHA_FLAG');   // função vira async
 *   {enabled && <AlgoOpcional />}
 *
 * Para várias abas, troque o <Container> por <TabsShell> (`@/components/tabs-shell`).
 * Rótulo em RSC vai em <LangLabel>, não em t() — o i18n aqui só roda no cliente.
 */
export default function CompanyPage() {
  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={<LangLabel text="title" langJson="company" />}
        description={<LangLabel text="description" langJson="company" />}
      />
      <CompanyTab />
    </Container>
  );
}
