import LangLabel from "@/components/ui/langLabel";
import { CompanyEditPage } from "../components/company-edit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCompany } from "@/lib/actions/company/api";
import { ProjectList } from "../../project/components/project-list";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const data = (await getCompany(id)).data;

  return (
    <Tabs defaultValue="company" className="">
      <TabsList>
        <TabsTrigger value="company"><LangLabel text="title" langJson="companies" /></TabsTrigger>
        <TabsTrigger value="projects"><LangLabel text="projects" langJson="projects" /></TabsTrigger>
      </TabsList>
      <TabsContent value="company"><CompanyEditPage company={data} /></TabsContent>
      <TabsContent value="projects">
        <ProjectList companyId={id} showCreateInviteButton={true} showCompanyFilter={false} />
      </TabsContent>
    </Tabs>
  );
}
