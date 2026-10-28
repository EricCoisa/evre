"use client";

import type { ReactNode } from 'react';
import { AsyncBoundary } from '@/components/async-boundary';
import { ConfigurationRow } from '@/components/configuration-row';
import { SystemConfiguration } from '@/components/system-configuration';
import type { OtherConfigurationProps } from '@/components/base-configuration';
import { useConfiguration } from '@/lib/actions/systemConfiguration/queries';
import { useSyncOnCapabilitiesChange } from '@/lib/actions/capability/queries';

interface SystemConfigurationRowProps extends OtherConfigurationProps {
  title: ReactNode;
  wide?: boolean;
}

function Row({ title, wide, description, ...props }: SystemConfigurationRowProps) {
  const { data } = useConfiguration(props.labelKey);
  // Resincroniza `requirements` sempre que `['capabilities']` mudar, não importa quem mudou —
  // ver useSyncOnCapabilitiesChange.
  useSyncOnCapabilitiesChange(['system-configuration', props.labelKey]);

  return (
    <ConfigurationRow
      title={title}
      description={description}
      requirements={data?.requirements}
      wide={wide}
      id={props.labelKey}
    >
      {/* `description` já foi exibido pelo ConfigurationRow acima — não repassar pro controle. */}
      <SystemConfiguration {...props} />
    </ConfigurationRow>
  );
}

/** `ConfigRow` + `SystemConfiguration` com o gate de `requirements` da própria chave — mesma
 *  query que o controle usa por baixo, sem request extra. */
export function SystemConfigurationRow(props: SystemConfigurationRowProps) {
  return (
    <AsyncBoundary>
      <Row {...props} />
    </AsyncBoundary>
  );
}
