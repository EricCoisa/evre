import { Container } from "@/components/container";
import { useCommentsByEntity } from "@/lib/actions/project/queries";

export function Comments({ entityType, entityId }: { entityType: string, entityId: string }) {

    const { data: comments } = useCommentsByEntity(entityType, entityId);


    return (
        <Container>
            <div>{comments && comments.map(comment => (
                <div key={comment.id}>{comment.content}</div>
            ))}</div>
        </Container>
    )
}