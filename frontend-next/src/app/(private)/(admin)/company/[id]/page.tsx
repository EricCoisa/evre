import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { SubNavLayout, type SubNavSection, TabsContent } from "@/components/sub-nav-layout";
import { ItemNotFound } from "@/components/ui/item-not-found";
import { Badge } from "@/components/ui/badge";
import LangLabel from "@/components/ui/langLabel";
import { getCompany } from "@/lib/actions/company/api";
import { CompanyEdit } from "../components/company-edit";
import { CompanyContactsTab } from "../components/company-contacts-tab";
import { Building2, Users } from "lucide-react";

const companyDetailSections: SubNavSection[] = [
  {
    items: [
      {
        id: "dados",
        label: <LangLabel text="tabData" langJson="company" />,
        icon: <Building2 className="size-4" />,
      },
      {
        id: "contatos",
        label: <LangLabel text="tabContacts" langJson="company" />,
        icon: <Users className="size-4" />,
      },
    ],
  },
];

/** Server Component: o registro é buscado no servidor com o JWT do cookie e chega renderizado. */
export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await getCompany(id);

  if (!response.success || !response.data) {
    return <ItemNotFound itemName="empresa" returnPage="/company" returnLabel="Voltar para Empresas" />;
  }

  const company = response.data;

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={company.name}
        description={company.tradeName ?? undefined}
        badge={
          company.archivedAt ? <Badge variant="secondary">Arquivada</Badge> : undefined
        }
      />
      <SubNavLayout sections={companyDetailSections} defaultTab="dados">
        <TabsContent value="dados" className="mt-0 space-y-4">
          <CompanyEdit company={company} />
        </TabsContent>
        <TabsContent value="contatos" className="mt-0 space-y-4">
          <CompanyContactsTab companyId={company.id} />
        </TabsContent>
      </SubNavLayout>
    </Container>
  );
}
