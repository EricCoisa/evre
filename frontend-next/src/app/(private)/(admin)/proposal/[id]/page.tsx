import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { ItemNotFound } from "@/components/ui/item-not-found";
import LangLabel from "@/components/ui/langLabel";
import { getProposal } from "@/lib/actions/proposal/api";
import { proposalStatusLabelKey } from "@/lib/vocabulary";
import { ProposalCompanyField } from "../components/proposal-company-field";
import { ProposalDetailTabs } from "../components/proposal-detail-tabs";

/** Server Component — o registro é buscado no servidor com o JWT do cookie e chega renderizado.
 * `SubNavLayout` mora em `ProposalDetailTabs` (Client Component) porque precisa de estado para
 * esconder a sidebar durante a edição da aba `conteudo` — RSC não tem `useState`. */
export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await getProposal(id);

  if (!response.success || !response.data) {
    return <ItemNotFound itemName="proposta" returnPage="/proposal" returnLabel="Voltar para Propostas" />;
  }

  const proposal = response.data;

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={proposal.name}
        description={<ProposalCompanyField proposal={proposal} />}
        badge={
          <Badge variant="outline">
            <LangLabel text={proposalStatusLabelKey(proposal.status)} langJson="vocabulary" />
          </Badge>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/proposal">
              <ArrowLeft className="size-4 mr-1.5" />
              <LangLabel text="backToList" langJson="proposal" />
            </Link>
          </Button>
        }
      />
      <ProposalDetailTabs proposal={proposal} />
    </Container>
  );
}
