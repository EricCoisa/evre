"use client";

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { ConfigRow } from '@/components/config-row';
import { useTranslation } from '@/hooks/use-translation';
import { useMe } from '@/lib/actions/auth/queries';
import { CAPABILITY_FIX_PATH, type ConfigurationRequirements } from '@/types/capabilities';
import i18n from '../../i18n';

interface ConfigurationRowProps {
  title: ReactNode;
  description?: ReactNode;
  requirements?: ConfigurationRequirements;
  disableOnRequirement?: boolean;
  children: ReactElement<{
    disabled?: boolean;
    warning?: boolean;
    warningReason?: ReactNode;
    fixPath?: string;
  }>;
  wide?: boolean;
  /** Âncora de DOM para deep-link (ex.: busca de recursos no header). */
  id?: string;
}

/** Resolve o motivo de desabilitado, preferindo `capability.<nome>.unavailable` ao hint genérico. */
function resolveDisabledHint(requirements: ConfigurationRequirements | undefined, t: (key: string) => string): ReactNode {
  if (requirements?.reason) return requirements.reason;
  const capability = requirements?.capability;
  if (capability) {
    const specificKey = `capability.${capability}.unavailable`;
    if (i18n.exists(specificKey, { ns: 'common' })) {
      return t(specificKey);
    }
  }
  return t('capability.unavailable');
}

/** Deriva disabled/warning/fixPath a partir dos requirements, do role do usuário e do estado já aplicado ao filho. */
function resolveRowState(
  requirements: ConfigurationRequirements | undefined,
  childDisabled: boolean | undefined,
  userRole: string | undefined,
  disableOnRequirement: boolean,
  t: (key: string) => string,
) {
  const isRequirementDisabled = Boolean(requirements?.disabled);
  // Se disableOnRequirement for false (UserConfiguration), a indisponibilidade não desabilita o controle do usuário
  const disabled = (disableOnRequirement && isRequirementDisabled) || Boolean(childDisabled);

  // Usuários que não têm acesso a configurar o que é necessário (não-ADMIN) não devem ver o warn
  const hasNoAccessToConfigure = userRole != null && userRole !== 'ADMIN';
  const showWarning = isRequirementDisabled && !hasNoAccessToConfigure;

  const warningReason = showWarning ? resolveDisabledHint(requirements, t) : undefined;
  const fixPath =
    showWarning && requirements?.capability ? CAPABILITY_FIX_PATH[requirements.capability] : undefined;

  return { disabled, showWarning, warningReason, fixPath };
}

export function ConfigurationRow({
  title,
  description,
  requirements,
  children,
  wide,
  id,
  disableOnRequirement = true,
}: ConfigurationRowProps) {
  const { t } = useTranslation();
  const { data: user } = useMe();

  if (requirements?.hidden) return null;

  const { disabled, showWarning, warningReason, fixPath } = resolveRowState(
    requirements,
    children.props.disabled,
    user?.role,
    disableOnRequirement,
    t,
  );

  return (
    <ConfigRow title={title} description={description} wide={wide} id={id}>
      {isValidElement(children)
        ? cloneElement(children, {
            disabled,
            warning: showWarning,
            warningReason,
            fixPath,
          })
        : children}
    </ConfigRow>
  );
}
