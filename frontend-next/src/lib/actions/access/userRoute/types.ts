// Re-export from generated schemas; local-only types preserved below
export type { UserRouteAccessDto as UserRouteAccess, GrantUserRouteAccessDto } from '@/lib/generated/schemas';

// Not in openapi spec — kept locally
export interface BulkGrantUserRouteAccessDto {
  userId: string;
  routeIds: string[];
}

export interface BulkGrantResponse {
  message: string;
  created: number;
  skipped: number;
}
