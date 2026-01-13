import { Container } from "@/components/container";
import { useActivitiesByStage } from "@/lib/actions/project/queries";

export function Activity({ stageId }: { stageId: string }) {

    const { data: activities } = useActivitiesByStage(stageId, {
        pagination: false,
    });


    return (
        <Container>{
            (Array.isArray(activities) ? activities : activities?.data)?.map((activity) => (
                <div key={activity.id}>{activity.title}</div>
            ))}</Container>
    );
}