'use client';

import Link from 'next/link';
import { useProjects } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderKanban } from 'lucide-react';
import type { PaginationParams } from '@/lib/types/pagination.types';
import { formatDate } from '@/lib/utils';

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  COMPLETED: "outline",
  ARCHIVED: "secondary",
};

export function CompanyProjectsTab({ companyId }: { companyId?: string }) {
  const { t } = useTranslation('project');
  const { t: tc } = useTranslation('company');
  const { data, isLoading } = useProjects(
    companyId ? { companyId, limit: 50, pagination: false } as PaginationParams & { companyId: string } : undefined,
  );

  const projects = Array.isArray(data) ? data : data?.data ?? [];

  if (isLoading) return <p className="text-sm text-muted-foreground">{tc('loading')}</p>;
  if (projects.length === 0) return <p className="text-sm text-muted-foreground">{t('empty')}</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {projects.map((p) => (
        <Link key={p.id} href={`/project/${p.id}`}>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderKanban className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="font-medium text-sm truncate">{p.name}</span>
                </div>
                <Badge variant={STATUS_VARIANT[p.status] ?? "default"} className="flex-shrink-0">
                  {t(p.status?.toLowerCase())}
                </Badge>
              </div>
              {p.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">{formatDate(p.createdAt)}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
