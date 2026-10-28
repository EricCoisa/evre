import {
  fetchLogsList,
  fetchSignupsSeries,
  fetchUsersList,
} from '@/lib/actions/pageBuilder/api';
import type { ApiResponse } from '@/lib/api/api';
import type { SourceData, SourceKind } from './types';

interface DataSource {
  kind: SourceKind;
  fetcher: (params?: Record<string, unknown>) => Promise<ApiResponse<SourceData>>;
}

/** Whitelist de fontes de dados disponíveis para blocos do page builder. */
export const DATA_SOURCES: Record<string, DataSource> = {
  'users.list': { kind: 'list', fetcher: fetchUsersList },
  'logs.list': { kind: 'list', fetcher: fetchLogsList },
  'users.signups.series': { kind: 'series', fetcher: fetchSignupsSeries },
};

export function getDataSource(key: string): DataSource | undefined {
  return DATA_SOURCES[key];
}
