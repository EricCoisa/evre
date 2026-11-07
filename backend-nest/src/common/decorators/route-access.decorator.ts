import { SetMetadata } from '@nestjs/common';

export const ROUTE_ACCESS_KEY = 'route_access_path';

/**
 * Define explicitamente a rota do banco de dados (`Route.path`) associada ao Controller ou Handler.
 * Se não for informada, o `RolesGuard` infere a partir do `@Controller('path')`.
 */
export const RouteAccess = (path: string) => SetMetadata(ROUTE_ACCESS_KEY, path);
