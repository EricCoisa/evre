"use server";

import { getTimeTracking as getTimeTrackingFactory } from '@/lib/generated/time-tracking/time-tracking';
import type { ApiResponse } from '@/lib/api/api';
import type {
  TimeEntry,
  ActiveTimerResponse,
  StartTimerDto,
  UpdateTimeEntryDto,
  CreateManualEntryDto,
} from './types';
import type { PaginatedResponse } from '@/lib/types/pagination.types';
import { wrapAs } from '../wrap';

const api = getTimeTrackingFactory();

export async function getActiveTimer(): Promise<ApiResponse<ActiveTimerResponse>> {
  const res = await wrapAs<ActiveTimerResponse>(() => api.timeTrackingControllerGetActiveTimer());
  if (!res.success && res.status === 404) {
    return {
      success: true,
      data: { entry: null, isForgotten: false, thresholdHours: 8 },
      message: '',
      status: 200,
    };
  }
  return res;
}

export async function startTimer(data: StartTimerDto): Promise<ApiResponse<TimeEntry>> {
  return wrapAs<TimeEntry>(() => api.timeTrackingControllerStartTimer(data));
}

export async function stopTimer(): Promise<ApiResponse<TimeEntry>> {
  return wrapAs<TimeEntry>(() => api.timeTrackingControllerStopTimer());
}

export async function createManualTimeEntry(
  data: CreateManualEntryDto,
): Promise<ApiResponse<TimeEntry>> {
  return wrapAs<TimeEntry>(() => api.timeTrackingControllerCreateManualEntry(data));
}

export async function updateTimeEntry(
  id: string,
  data: UpdateTimeEntryDto,
): Promise<ApiResponse<TimeEntry>> {
  return wrapAs<TimeEntry>(() => api.timeTrackingControllerUpdateTimeEntry(id, data));
}

export async function deleteTimeEntry(id: string): Promise<ApiResponse<{ success: boolean }>> {
  return wrapAs<{ success: boolean }>(() => api.timeTrackingControllerDeleteTimeEntry(id));
}

export async function listTimeEntries(
  params?: Record<string, any>,
): Promise<ApiResponse<PaginatedResponse<TimeEntry>>> {
  return wrapAs<PaginatedResponse<TimeEntry>>(() =>
    api.timeTrackingControllerListTimeEntries((params ?? {}) as any),
  );
}
