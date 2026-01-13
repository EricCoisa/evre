import { Container } from "@/components/container";
import { useActivitiesByStage, useStagesByProject } from "@/lib/actions/project/queries";
import { Activity } from "./activity";

export function Stage({ projectId }: { projectId: string }) {

    const { data: stages } = useStagesByProject(projectId, {
        pagination: false,
    });


    return (
        <Container>
            {(Array.isArray(stages) ? stages : stages?.data)?.map((stage) => (
                <div key={stage.id}>
                    <div>{stage.name}</div>
                    <Activity stageId={stage.id} />
                </div>
            ))}
        </Container>
    )
}