"use server";
import { getFeatureFlags } from '@/lib/generated/feature-flags/feature-flags';
import type { FeatureFlag, CreateFeatureFlagDto, UpdateFeatureFlagDto, SetFeatureFlagRolesDto } from './types';
import { wrapAs } from '../wrap';

const api = getFeatureFlags();

export async function getMyFeatureFlags() {
  return wrapAs<Record<string, boolean>>(() => api.featureFlagControllerGetForMe());
}

export async function getAllFeatureFlags() {
  return wrapAs<FeatureFlag[]>(() => api.featureFlagControllerFindAll());
}

export async function createFeatureFlag(dto: CreateFeatureFlagDto) {
  return wrapAs<FeatureFlag>(() => api.featureFlagControllerCreate(dto));
}

export async function updateFeatureFlag(id: string, dto: UpdateFeatureFlagDto) {
  return wrapAs<FeatureFlag>(() => api.featureFlagControllerUpdate(id, dto));
}

export async function deleteFeatureFlag(id: string) {
  return wrapAs<void>(() => api.featureFlagControllerRemove(id));
}

export async function setFeatureFlagRoles(id: string, dto: SetFeatureFlagRolesDto) {
  return wrapAs<FeatureFlag>(() => api.featureFlagControllerSetRoles(id, dto));
}
