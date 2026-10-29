import { ArrowLeft, FileText, History, Receipt, Send } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { SubNavLayout, type SubNavSection, TabsContent } from "@/components/sub-nav-layout";
import { ItemNotFound } from "@/components/ui/item-not-found";
import LangLabel from "@/components/ui/langLabel";
import { getProposal } from "@/lib/actions/proposal/api";
import { ProposalCommercialTab } from "../components/proposal-commercial-tab";
import { ProposalCompanyField } from "../components/proposal-company-field";
import { ProposalContentTab } from "../components/proposal-content-tab";
import { ProposalPublicationTab } from "../components/proposal-publication-tab";
import { ProposalVersionsTab } from "../components/proposal-versions-tab";

const proposalDetailSections: SubNavSection[] = [
  {
    items: [
      {
        id: "conteudo",
        label: <LangLabel text="tabContent" langJson="proposal" />,
        icon: <FileText className="size-4" />,
      },
      {
        id: "comercial",
        label: <LangLabel text="tabCommercial" langJson="proposal" />,
        icon: <Receipt className="size-4" />,
      },
      {
        id: "publicacao",
        label: <LangLabel text="tabPublication" langJson="proposal" />,
        icon: <Send className="size-4" />,
      },
      {
        id: "versoes",
        label: <LangLabel text="tabVersions" langJson="proposal" />,
        icon: <History className="size-4" />,
      },
    ],
  },
];

/** Server Component — o registro é buscado no servidor com o JWT do cookie e chega renderizado. */
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
        badge={<Badge variant="outline">{proposal.status}</Badge>}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/proposal">
              <ArrowLeft className="size-4 mr-1.5" />
              <LangLabel text="backToList" langJson="proposal" />
            </Link>
          </Button>
        }
      />
      <SubNavLayout sections={proposalDetailSections} defaultTab="conteudo">
        <TabsContent value="conteudo" className="mt-0 space-y-4">
          <ProposalContentTab proposal={proposal} />
        </TabsContent>
        <TabsContent value="comercial" className="mt-0 space-y-4">
          <ProposalCommercialTab proposal={proposal} />
        </TabsContent>
        <TabsContent value="publicacao" className="mt-0 space-y-4">
          <ProposalPublicationTab proposal={proposal} />
        </TabsContent>
        <TabsContent value="versoes" className="mt-0 space-y-4">
          <ProposalVersionsTab proposal={proposal} />
        </TabsContent>
      </SubNavLayout>
    </Container>
  );
}
