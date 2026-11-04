import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import LangLabel from "@/components/ui/langLabel";
import { ArtifactTab } from "./components/artifact-tab";

/**
 * Server Component — não ponha `'use client'` aqui. Ver `docs/frontend/page-structure.md`
 * → "Gating é decisão do servidor".
 */
export default function ArtifactPage() {
  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={<LangLabel text="title" langJson="artifact" />}
        description={<LangLabel text="description" langJson="artifact" />}
      />
      <ArtifactTab />
    </Container>
  );
}
