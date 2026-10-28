"use client";

import type { ReactNode } from 'react';
import { AsyncBoundary } from '@/components/async-boundary';
import { ConfigurationRow } from '@/components/configuration-row';
import { UserConfiguration } from '@/components/user-configuration';
import type { OtherConfigurationProps } from '@/components/base-configuration';
import { useUserConfiguration } from '@/lib/actions/userConfiguration/queries';
import { useSyncOnCapabilitiesChange } from '@/lib/actions/capability/queries';

interface UserConfigurationRowProps extends OtherConfigurationProps {
  title: ReactNode;
  wide?: boolean;
}

function Row({ title, wide, description, ...props }: UserConfigurationRowProps) {
  const { data } = useUserConfiguration(props.labelKey);
  // Resincroniza `requirements` sempre que `['capabilities']` mudar, não importa quem mudou —
  // ver useSyncOnCapabilitiesChange.
  useSyncOnCapabilitiesChange(['user-configuration', props.labelKey]);

  return (
    <ConfigurationRow
      title={title}
      description={description}
      requirements={data?.requirements}
      disableOnRequirement={false}
      wide={wide}
      id={props.labelKey}
    >
      {/* `description` já foi exibido pelo ConfigurationRow acima — não repassar pro controle. */}
      <UserConfiguration {...props} />
    </ConfigurationRow>
  );
}

/** `ConfigRow` + `UserConfiguration` com o gate de `requirements` da própria chave — mesma
 *  query que o controle usa por baixo, sem request extra. */
export function UserConfigurationRow(props: UserConfigurationRowProps) {
  return (
    <AsyncBoundary>
      <Row {...props} />
    </AsyncBoundary>
  );
}
