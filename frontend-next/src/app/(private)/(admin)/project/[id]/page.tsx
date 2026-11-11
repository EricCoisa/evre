import { Container } from "@/components/container";
import { isClientUser } from "@/lib/role-utils";
import { PageHeader } from "@/components/page-header";
import { SubNavLayout, type SubNavSection, TabsContent } from "@/components/sub-nav-layout";
import { ItemNotFound } from "@/components/ui/item-not-found";
import { Badge } from "@/components/ui/badge";
import LangLabel from "@/components/ui/langLabel";
import { getProject } from "@/lib/actions/project/api";
import { serverMe } from "@/lib/server-context";
import { ProjectBoardTab } from "./components/project-board-tab";
import { ProjectInfoRequestsTab } from "./components/project-info-requests-tab";
import { LayoutGrid, KeyRound } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  COMPLETED: "outline",
  ARCHIVED: "secondary",
};

const sections: SubNavSection[] = [
  {
    items: [
      {
        id: "board",
        label: <LangLabel text="tabBoard" langJson="project" />,
        icon: <LayoutGrid className="size-4" />,
      },
      {
        id: "info-requests",
        label: <LangLabel text="tabInfoRequests" langJson="project" />,
        icon: <KeyRound className="size-4" />,
      },
    ],
  },
];

export default async function ProjectDetailPage({
  params,
  initialTaskId,
}: {
  params: Promise<{ id: string; taskId?: string }>;
  initialTaskId?: string;
}) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const taskId = initialTaskId ?? resolvedParams.taskId;
  const me = await serverMe();
  const isClient = isClientUser(me);
  const response = await getProject(id);

  if (!response.success || !response.data) {
    return <ItemNotFound itemName="projeto" returnPage="/project" returnLabel="Voltar para Projetos" />;
  }

  const project = response.data;

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        badge={
          <Badge variant={STATUS_VARIANT[project.status] ?? "default"}>
            <LangLabel text={project.status.toLowerCase()} langJson="project" />
          </Badge>
        }
      />
      <SubNavLayout sections={sections} defaultTab="board">
        <TabsContent value="board" className="mt-0 space-y-4">
          <ProjectBoardTab
            projectId={project.id}
            initialTaskId={taskId}
            canEdit={!isClient}
            mode={isClient ? 'client' : 'admin'}
          />
        </TabsContent>
        <TabsContent value="info-requests" className="mt-0 space-y-4">
          <ProjectInfoRequestsTab
            projectId={project.id}
            mode={isClient ? 'client' : 'admin'}
          />
        </TabsContent>
      </SubNavLayout>
    </Container>
  );
}
