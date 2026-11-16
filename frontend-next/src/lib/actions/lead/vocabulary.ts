import type { VariantProps } from 'class-variance-authority';
import type { badgeVariants } from '@/components/ui/badge';
import { LeadDtoStatus } from '@/lib/generated/schemas';

export const LEAD_STATUSES = [LeadDtoStatus.NEW, LeadDtoStatus.VIEWED, LeadDtoStatus.RESOLVED] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function leadStatusLabelKey(status: string): string {
  return LEAD_STATUSES.includes(status as LeadStatus)
    ? `leadStatus.${status}`
    : 'leadStatus.UNKNOWN';
}

export const LEAD_STATUS_BADGE_VARIANT: Record<LeadStatus, VariantProps<typeof badgeVariants>['variant']> = {
  NEW: 'default',
  VIEWED: 'secondary',
  RESOLVED: 'outline',
};
