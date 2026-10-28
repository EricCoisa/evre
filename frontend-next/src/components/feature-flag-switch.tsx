'use client';

import { Switch } from '@/components/ui/switch';
import { useUpdateFeatureFlag } from '@/lib/actions/feature-flag/queries';

export interface FeatureFlagSwitchProps {
  id: string;
  enabled: boolean;
}

export function FeatureFlagSwitch({ id, enabled }: FeatureFlagSwitchProps) {
  const updateFlag = useUpdateFeatureFlag();

  return (
    <Switch
      checked={enabled}
      onCheckedChange={(checked) => updateFlag.mutate({ id, dto: { enabled: checked } })}
      disabled={updateFlag.isPending}
    />
  );
}
