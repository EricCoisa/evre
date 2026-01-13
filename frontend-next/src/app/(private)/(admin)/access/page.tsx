'use client';

import { Container } from "@/components/container";

import { useTranslation } from "@/hooks/use-translation";
import { useState, useCallback, Fragment } from 'react';
import { DataTable } from "@/components/data-table";
import { SortableRoutesTable } from "./components/sortable-routes-table";
import { useRoutes } from "@/lib/actions/access/route/queries";
import { useUserRole } from "@/lib/actions/access/roleRouteAccess/queries";
import { getUserRoleColumns } from "./components/roleRouteAccess-columns";

import type { RoleUser } from "@/lib/actions/access/roleRouteAccess/types";
import UserRoleAccess from "./components/user-role-access";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


function UserRoleTab({ t }: { t: (key: string) => string }) {
  const [viewingRoutesRole, setViewingRoutesRole] = useState<RoleUser | null>(null);
  const [isRoutesDialogOpen, setIsRoutesDialogOpen] = useState(false);

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const { data: dataUserRole, error: errorUserRole } = useUserRole({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    pagination: true
  });

  const handleViewRoutes = useCallback((role: RoleUser) => {
    setViewingRoutesRole(role);
    setIsRoutesDialogOpen(true);
  }, []);

  const columnsUserRole = getUserRoleColumns({ t, onViewRoutes: handleViewRoutes });


  return (
    <Fragment>
      <DataTable
        columns={columnsUserRole}
        data={dataUserRole}
        error={errorUserRole}
        queryKey={['userRoles', pagination]}
        pagination={pagination}
        onPaginationChange={setPagination}
        loadingMessage={t('loading')}
        emptyMessage={t('noUserRoles')}
        entityName={t('entity') ?? 'userRole'}
        entityNamePlural={t('entityPlural') ?? 'userRoles'}
        enableGlobalFilter={true}
        searchPlaceholder={t('searchRoles')}
      />

      {viewingRoutesRole && (
        <UserRoleAccess
          role={viewingRoutesRole}
          open={isRoutesDialogOpen}
          onOpenChange={(open: boolean) => {
            setIsRoutesDialogOpen(open);
            if (!open) setViewingRoutesRole(null);
          }}
        />
      )}
    </Fragment>
  )
}

function RoutesTab({ t }: { t: (key: string) => string }) {
  const { data: dataRoute, error: errorRoute, isLoading: isLoadingRoutes } = useRoutes({
    pagination: false,
  });


  return (
    <Fragment>
        {isLoadingRoutes ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {t('loading')}
          </div>
        ) : errorRoute ? (
          <div className="flex-1 flex items-center justify-center text-destructive">
            {t('error')}
          </div>
        ) : (
          <div className="flex-1">
            <SortableRoutesTable
              routes={Array.isArray(dataRoute) ? dataRoute : []}
              t={t}
            />
          </div>
        )}
      </Fragment>
  )
}


export default function AccessPage() {

  const { t } = useTranslation('access');


  // const { data: dataUserRoute, error: errorUserRoute } = useUserRouteAccess({
  //   page: pagination.pageIndex + 1,
  //   limit: pagination.pageSize,
  //   pagination: true,
  // });

  // const columnsUserRoute = getUserRouteAccessColumns(t);

  // Buscar todas as rotas sem paginação para o sortable


  return (
     <Container variant="form" border={false}>
      <Tabs defaultValue="userRole">
        <TabsList>
          <TabsTrigger value="userRole">{t('userTab')}</TabsTrigger>
          <TabsTrigger value="routes">{t('routesTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="userRole"><UserRoleTab t={t} /></TabsContent>
        <TabsContent value="routes"><RoutesTab t={t} /></TabsContent>
      </Tabs>
    </Container>
  );
}