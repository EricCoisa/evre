import { Container } from "@/components/container";
import { useProject } from "@/lib/actions/project/queries";
import { Stage } from "./stage";
import { useTranslation } from "@/hooks/use-translation";

export function Project({ projectId }: { projectId: string }) {
    const { t } = useTranslation('dashboard');
    const { data: project } = useProject(projectId);

    return (
        <Container>

            {project && (
                <div className="mt-4">
                    <h2 className="text-lg font-medium">{t('selectedProject')}</h2>
                    <p>{project.name}</p>
                    <p>{project.description}</p>
                    <Stage projectId={projectId} />
                </div>
            )}

        </Container>
    );
}