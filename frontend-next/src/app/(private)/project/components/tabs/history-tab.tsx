'use client';

import { Project, ProjectHistory } from '@/lib/actions/project/types';
import { useHistoryByProject } from '@/lib/actions/project/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useMemo } from 'react';
import { DataTable } from '@/components/data-table';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { getHistoryColumns } from '../history-columns';
import LangLabel from '@/components/ui/langLabel';
import { useTranslation } from '@/hooks/use-translation';

interface HistoryTabProps {
  project: Project;
}

export function HistoryTab({ project }: HistoryTabProps) {
  const { t } = useTranslation('projects');
  const [historyPagination, setHistoryPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data: historyData } = useHistoryByProject(project.id, {
    page: historyPagination.pageIndex + 1,
    limit: historyPagination.pageSize,
    pagination: true,
  });

  const historyColumns: ColumnDef<ProjectHistory>[] = useMemo(() => getHistoryColumns(t), [t]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle><LangLabel text="history" langJson="projects" /></CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={historyColumns}
            data={historyData}
            error={null}
            queryKey={['history', project.id]}
            pagination={historyPagination}
            onPaginationChange={setHistoryPagination}
            emptyMessage={t('noHistory')}
            entityName={t('historyItem')}
            entityNamePlural={t('historyItems')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
