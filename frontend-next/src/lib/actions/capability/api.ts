"use server";
import type { ApiResponse } from '../../api/api';
import { getCapabilities as createCapabilitiesClient } from '@/lib/generated/capabilities/capabilities';
import type { CapabilityStatus } from './types';
import { wrapAs } from '../wrap';

const api = createCapabilitiesClient();

export async function getCapabilities(): Promise<ApiResponse<Record<string, CapabilityStatus>>> {
  return wrapAs(() => api.capabilityControllerGetAll());
}
