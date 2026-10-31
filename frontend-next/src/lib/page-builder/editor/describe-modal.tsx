'use client';

import React, { useMemo, useState } from 'react';
import { Check, Copy, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/modal';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { usePageSources } from '@/lib/actions/pageBuilder/queries';
import { describeBlocks } from '../blocks.meta';
import { classNamesFor } from '../class-names';
import { describePages } from '../pages';
import {
  DEFAULT_PROFILE,
  LAYOUT_PROFILES,
  type LayoutProfileName,
} from '../profiles';
import { SPANS } from '../schema';

const INLINE_SHAPES = {
  list: '{ data: Record<string, unknown>[], meta?: { total, page, limit, totalPages } }',
  count: 'mesmo shape de "list" — o bloco usa só meta.total',
  series: '{ data: { date: string, value: number }[] }',
} as const;

export function getDescribeData(
  profile: LayoutProfileName = DEFAULT_PROFILE,
  sources: ReturnType<typeof usePageSources>['data'] = [],
) {
  const profileConfig = LAYOUT_PROFILES[profile];
  const { dataSources } = profileConfig;

  return {
    profile,
    dataSources,
    blocks: describeBlocks(profile),
    pages: describePages(),
    spans: [...SPANS],
    classNames: classNamesFor(profile),
    maxBlocks: profileConfig.maxBlocks,
    maxChildren: profileConfig.maxChildren,
    sources:
      dataSources === 'role-filtered'
        ? (sources ?? []).map((s) => ({
            key: s.key,
            kind: s.kind,
            description: s.description,
            fields: s.fields ?? [],
            params: s.params ?? [],
          }))
        : [],
    inlineShapes: dataSources === 'inline-only' ? INLINE_SHAPES : undefined,
  };
}

export function DescribeModal({
  open,
  onOpenChange,
  profile = DEFAULT_PROFILE,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: LayoutProfileName;
}) {
  const { t } = useTranslation('page-builder');
  const { data: sources = [] } = usePageSources();
  const [copied, setCopied] = useState(false);

  const describeJson = useMemo(() => {
    const data = getDescribeData(profile, sources);
    return JSON.stringify(data, null, 2);
  }, [profile, sources]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(describeJson);
      setCopied(true);
      toast.success(
        t('editor.describeCopySuccess', {
          defaultValue: 'JSON do describe copiado para a área de transferência!',
        }),
      );
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(
        t('editor.describeCopyError', {
          defaultValue: 'Não foi possível copiar para a área de transferência.',
        }),
      );
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <FileJson className="size-5 text-primary" />
          <span>
            {t('editor.describeModalTitle', {
              defaultValue: 'Especificações da Página (Describe)',
            })}
          </span>
        </div>
      }
      description={t('editor.describeModalDesc', {
        defaultValue:
          'Mesma informação que o agente interno usa para montar e validar o layout.',
      })}
      size="xl"
      className="max-w-4xl"
    >
      <div className="w-full min-w-0 space-y-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <span className="text-xs text-muted-foreground">
            {t('editor.describeModalInstruction', {
              defaultValue:
                'Copie este JSON e envie para a IA externa gerar o layout compatível.',
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 gap-1.5 text-xs font-medium shrink-0"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-green-600" />
                <span>{t('editor.describeCopied', { defaultValue: 'Copiado!' })}</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>{t('editor.describeCopyJson', { defaultValue: 'Copiar JSON' })}</span>
              </>
            )}
          </Button>
        </div>

        <div className="w-full min-w-0 overflow-hidden rounded-lg border bg-muted/40">
          <pre className="max-h-[65vh] w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto p-4 font-mono text-xs leading-relaxed text-foreground select-all">
            {describeJson}
          </pre>
        </div>
      </div>
    </Modal>
  );
}
