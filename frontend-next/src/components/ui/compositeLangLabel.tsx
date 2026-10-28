'use client';

import { useTranslation } from '@/hooks/use-translation';
import { useTranslation as useTranslationI18n } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';
import { isLabelKey } from '@/lib/translation-utils';
import { useCapabilities } from '@/lib/actions/capability/queries';

export interface CompositePart {
  /** Chave de tradução da parte individual */
  text: string;
  /** Se o recurso/capability correspondente está ativo (default: true) */
  active?: boolean;
  /** Capability opcional para determinar ativação dinâmica pelo status available */
  capability?: string;
  /** Namespace i18n opcional específico da parte (herda do pai se omitido) */
  langJson?: string;
}

export interface CompositeLangLabelProps {
  /** Partes candidatas a compor o texto */
  parts: CompositePart[];
  /** Namespace padrão para as traduções (padrão: "common") */
  langJson?: string;
  /**
   * Chave mestre opcional usada quando TODAS as partes estiverem ativas.
   * Se não informada, une os textos individuais com o separador.
   */
  compoundKey?: string;
  /** Separador entre termos múltiplos (padrão: " & ") */
  separator?: string;
}

function translateKey(i18n: I18nInstance | null | undefined, key: string, namespace: string): string {
  if (isLabelKey(key) && i18n?.hasResourceBundle?.(i18n.language, 'labelKey')) {
    return i18n.getResource(i18n.language, 'labelKey', key) ?? key;
  }
  return i18n?.t?.(key, { ns: namespace }) ?? key;
}

export function isPartActive(
  part: CompositePart,
  capabilities?: Record<string, { available?: boolean }> | null
): boolean {
  if (part.active !== undefined) return part.active;
  if (part.capability && capabilities) {
    return capabilities[part.capability]?.available !== false;
  }
  return true;
}

export function resolveCompositeText(
  parts: CompositePart[],
  options: {
    langJson?: string;
    compoundKey?: string;
    separator?: string;
    capabilities?: Record<string, { available?: boolean }> | null;
    translateFn: (key: string, ns: string) => string;
  }
): string | null {
  const activeParts = parts.filter((part) => isPartActive(part, options.capabilities));
  if (activeParts.length === 0) return null;

  const defaultNs = options.langJson ?? 'common';
  const separator = options.separator ?? ' & ';

  if (options.compoundKey && activeParts.length === parts.length) {
    return options.translateFn(options.compoundKey, defaultNs);
  }

  if (activeParts.length === 1) {
    const single = activeParts[0];
    return options.translateFn(single.text, single.langJson ?? defaultNs);
  }

  return activeParts
    .map((part) => options.translateFn(part.text, part.langJson ?? defaultNs))
    .join(separator);
}

export default function CompositeLangLabel({
  parts,
  langJson = 'common',
  compoundKey,
  separator = ' & ',
}: CompositeLangLabelProps) {
  const { t } = useTranslation(langJson);
  const { i18n } = useTranslationI18n();
  const { data: capabilities } = useCapabilities();

  const activeParts = parts.filter((part) => isPartActive(part, capabilities));

  if (activeParts.length === 0) {
    return null;
  }

  if (compoundKey && activeParts.length === parts.length) {
    return <>{t(compoundKey)}</>;
  }

  if (activeParts.length === 1) {
    const single = activeParts[0];
    const ns = single.langJson ?? langJson;
    return <>{translateKey(i18n, single.text, ns)}</>;
  }

  const joinedText = activeParts
    .map((part) => translateKey(i18n, part.text, part.langJson ?? langJson))
    .join(separator);

  return <>{joinedText}</>;
}
