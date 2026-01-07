
import { getUser } from "../actions/user/api";

export interface RoutePageQuery<T> {
    queryKey: (id?: string) => unknown[];
    queryFn: (id?: string) => Promise<T>;
}

export const RoutePagesList: RoutePage<unknown>[] = [
    {
        path: 'users',
        key: 'name',
        getBreadName: (id?: string) => ({
            queryKey: () => ["user", id],
            queryFn: (id?: string) => getUser(id as string),
        }),
    }
]

export interface RoutePage<T> {
    path: string;
    key: string;
    getBreadName: (id?: string) => RoutePageQuery<T>;
}

export async function nullFunction<T>() : Promise<T> {
    return null as unknown as T;
}