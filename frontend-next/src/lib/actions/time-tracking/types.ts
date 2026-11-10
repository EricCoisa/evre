export type {
  StartTimerDto,
  UpdateTimeEntryDto,
  CreateManualEntryDto,
  TimeTrackingControllerListTimeEntriesParams,
  TimeTrackingControllerExportTimeEntriesParams,
} from '@/lib/generated/schemas';

export interface TimeEntry {
  id: string;
  userId: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  isBillable: boolean;
  source: 'TIMER' | 'MANUAL';
  entityType: string | null;
  entityId: string | null;
  entityTitle: string | null;
  projectId: string | null;
  isManual: boolean;
  editedById: string | null;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isForgotten?: boolean;
  project?: {
    id: string;
    name: string;
  } | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  editedBy?: {
    id: string;
    name: string | null;
  } | null;
}

export interface ActiveTimerResponse {
  entry: TimeEntry | null;
  isForgotten: boolean;
  thresholdHours: number;
}

export interface ExportTimeEntryRow {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  durationFormatted: string;
  durationHours: string;
  projectName: string;
  description: string;
  entityType?: string;
  entityTitle?: string;
  userName: string;
  userEmail: string;
  isBillable: boolean;
  source: string;
  isForgotten: boolean;
}

export interface ExportTimeEntriesResponse {
  csv: string;
  filename: string;
  totalEntries: number;
  totalSeconds: number;
  billableSeconds: number;
  entries?: ExportTimeEntryRow[];
  period?: {
    startDate: string | null;
    endDate: string | null;
  };
}
