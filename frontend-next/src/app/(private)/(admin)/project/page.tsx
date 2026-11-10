import { Container } from "@/components/container";
import { isClientUser } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import LangLabel from "@/components/ui/langLabel";
import { ProjectTab } from "./components/project-tab";
import { serverMe } from "@/lib/server-context";
import { ClientProjectsList } from "./components/client-projects-list";

export default async function ProjectPage() {
  const me = await serverMe();
  const isClient = isClientUser(me);

  if (isClient) {
    return <ClientProjectsList />;
  }

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={<LangLabel text="title" langJson="project" />}
        description={<LangLabel text="description" langJson="project" />}
      />
      <ProjectTab />
    </Container>
  );
}
