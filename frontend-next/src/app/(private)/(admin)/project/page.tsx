import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import LangLabel from "@/components/ui/langLabel";
import { ProjectTab } from "./components/project-tab";

export default function ProjectPage() {
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
