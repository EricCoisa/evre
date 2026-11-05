import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { SubNavLayout, type SubNavSection, TabsContent } from "@/components/sub-nav-layout";
import { ItemNotFound } from "@/components/ui/item-not-found";
import { Badge } from "@/components/ui/badge";
import LangLabel from "@/components/ui/langLabel";
import { getCompany } from "@/lib/actions/company/api";
import { getCurrentUser } from "@/lib/actions/auth/api";
import { CompanyConfigTab } from "./components/company-config-tab";
import { CompanyProposalsTab } from "./components/company-proposals-tab";
import { CompanyProjectsTab } from "./components/company-projects-tab";
import { CompanyContractsTab } from "./components/company-contracts-tab";
import { CompanyContactsTab } from "../components/company-contacts-tab";
import { CompanyMembersTab } from "./components/company-members-tab";
import type { Company } from "@/lib/actions/company/types";
import { Building2, FileText, FolderKanban, FileSignature, Users, UserPlus } from "lucide-react";

interface CompanyDetailFlags {
  canSeeCommercials: boolean;
  isAdmin: boolean;
}

function getCompanyDetailSections(flags: CompanyDetailFlags): SubNavSection[] {
  return [
    {
      items: [
        {
          id: "configuracao",
          label: <LangLabel text="tabConfig" langJson="company" />,
          icon: <Building2 className="size-4" />,
        },
        {
          id: "contatos",
          label: <LangLabel text="tabContacts" langJson="company" />,
          icon: <Users className="size-4" />,
          hidden: !flags.canSeeCommercials,
        },
        {
          id: "propostas",
          label: <LangLabel text="tabProposals" langJson="company" />,
          icon: <FileText className="size-4" />,
          hidden: !flags.canSeeCommercials,
        },
        {
          id: "projetos",
          label: <LangLabel text="tabProjects" langJson="company" />,
          icon: <FolderKanban className="size-4" />,
        },
        {
          id: "membros",
          label: <LangLabel text="tabMembers" langJson="company" />,
          icon: <UserPlus className="size-4" />,
          hidden: !flags.isAdmin,
        },
        {
          id: "contratos",
          label: <LangLabel text="tabContracts" langJson="company" />,
          icon: <FileSignature className="size-4" />,
          hidden: !flags.canSeeCommercials,
        },
      ],
    },
  ];
}

function CompanyDetailTabsContent({ company, flags }: { company: Company; flags: CompanyDetailFlags }) {
  return (
    <>
      <TabsContent value="configuracao" className="mt-0 space-y-4">
        <CompanyConfigTab company={company} />
      </TabsContent>
      {flags.canSeeCommercials && (
        <TabsContent value="contatos" className="mt-0 space-y-4">
          <CompanyContactsTab companyId={company.id} />
        </TabsContent>
      )}
      {flags.canSeeCommercials && (
        <TabsContent value="propostas" className="mt-0 space-y-4">
          <CompanyProposalsTab companyId={company.id} />
        </TabsContent>
      )}
      <TabsContent value="projetos" className="mt-0 space-y-4">
        <CompanyProjectsTab companyId={company.id} />
      </TabsContent>
      {flags.isAdmin && (
        <TabsContent value="membros" className="mt-0 space-y-4">
          <CompanyMembersTab companyId={company.id} />
        </TabsContent>
      )}
      {flags.canSeeCommercials && (
        <TabsContent value="contratos" className="mt-0 space-y-4">
          <CompanyContractsTab />
        </TabsContent>
      )}
    </>
  );
}

/** Server Component: o registro é buscado no servidor com o JWT do cookie e chega renderizado. */
export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [response, userResponse] = await Promise.all([getCompany(id), getCurrentUser()]);

  if (!response.success || !response.data) {
    return <ItemNotFound itemName="empresa" returnPage="/company" returnLabel="Voltar para Empresas" />;
  }

  const company = response.data;
  const isAdmin = userResponse.data?.roleName === "ADMIN";
  const flags: CompanyDetailFlags = {
    isAdmin,
    canSeeCommercials: isAdmin || !!company.myMembership?.canSeeCommercials,
  };

  const sections = getCompanyDetailSections(flags);

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={company.name}
        description={company.tradeName ?? undefined}
        badge={
          company.archivedAt ? (
            <Badge variant="secondary">
              <LangLabel text="archived" langJson="company" />
            </Badge>
          ) : undefined
        }
      />
      <SubNavLayout sections={sections} defaultTab="configuracao">
        <CompanyDetailTabsContent company={company} flags={flags} />
      </SubNavLayout>
    </Container>
  );
}
