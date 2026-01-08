
import { getCompany } from "../actions/company/api";
import { getProposal } from "../actions/proposal/api";
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
    },
    {
        path: 'company',
        key: 'data.name',
        getBreadName: (id?: string) => ({
            queryKey: () => ["company", id],
            queryFn: (id?: string) => getCompany(id as string),
        }),
    },
    {
        path: 'proposal',
        key: 'data.name',
        getBreadName: (id?: string) => ({
            queryKey: () => ["proposal", id],
            queryFn: (id?: string) => getProposal(id as string),
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