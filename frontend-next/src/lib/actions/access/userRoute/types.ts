export interface UserRouteAccess {
  id: string;
  userId: string;
  routeId: string;
  grantedBy: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
  route?: {
    id: string;
    path: string;
    labelKey: string;
  };
  grantedByUser?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

export interface GrantUserRouteAccessDto {
  userId: string;
  routeId: string;
}

export interface BulkGrantUserRouteAccessDto {
  userId: string;
  routeIds: string[];
}

export interface BulkGrantResponse {
  message: string;
  created: number;
  skipped: number;
}