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

const EXPECTED_OUTPUT_FORMAT = {
  'role-filtered': {
    v: 1,
    blocks: [
      {
        id: 'string_id_unico (ex: b1)',
        type: 'tipo_do_bloco (escolhido do catalogo blocks)',
        span: 'numero de 1 a 12 (largura: 12 = 100%, 6 = 50%, 4 = 33%)',
        rowSpan: 'numero de 1 a 8 (padrao 4 para tabelas e graficos)',
        props: {
          exemplo_prop: 'valor conforme tipos declarados em props do bloco',
        },
        data: {
          source: 'chave_exata_da_fonte_em_sources',
          params: {
            limite_ou_filtro: 'valor conforme params aceitos pela fonte',
          },
        },
        className: 'classes_tailwind_da_lista_classNames (opcional)',
        children: [
          'apenas se container: true (ex: group). Maximo 1 nivel de aninhamento.',
        ],
      },
    ],
  },
  'inline-only': {
    v: 1,
    blocks: [
      {
        id: 'string_id_unico (ex: b1)',
        type: 'tipo_do_bloco (escolhido do catalogo blocks)',
        span: 'numero de 1 a 12 (largura: 12 = 100%, 6 = 50%, 4 = 33%)',
        rowSpan: 'numero de 1 a 8',
        props: {
          exemplo_prop: 'valor conforme tipos declarados em props do bloco',
        },
        data: {
          inline: {
            data: [
              'array de objetos com o dado colado (para list ou series conforme inlineShapes). NUNCA use data.source nesta superficie.',
            ],
          },
        },
        className: 'classes_tailwind_da_lista_classNames (opcional)',
        children: [
          'apenas se container: true (ex: group). Maximo 1 nivel de aninhamento.',
        ],
      },
    ],
  },
  none: {
    v: 1,
    blocks: [
      {
        id: 'string_id_unico',
        type: 'tipo_do_bloco',
        span: 'numero de 1 a 12',
        props: {},
      },
    ],
  },
} as const;

const INSTRUCTIONS_BY_DATASOURCES = {
  'role-filtered':
    'Gere um objeto JSON estrito seguindo exatamente a estrutura de "expectedOutputFormat". O campo "v" deve ser obrigatoriamente 1. Para dados, use "data.source" com uma das chaves listadas em "sources" (NUNCA use data.inline). Classes de estilo em "className" devem pertencer estritamente a "classNames". Responda APENAS com o JSON válido.',
  'inline-only':
    'Gere um objeto JSON estrito seguindo exatamente a estrutura de "expectedOutputFormat". O campo "v" deve ser obrigatoriamente 1. Para blocos que consomem dados (tabelas, graficos), cole o dado diretamente em "data.inline" seguindo o formato de "inlineShapes" (NUNCA use data.source). Classes de estilo em "className" devem pertencer estritamente a "classNames". Responda APENAS com o JSON válido.',
  none:
    'Gere um objeto JSON estrito seguindo exatamente a estrutura de "expectedOutputFormat". Não inclua campo "data". Responda APENAS com o JSON válido.',
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
    instructions: INSTRUCTIONS_BY_DATASOURCES[dataSources],
    expectedOutputFormat: EXPECTED_OUTPUT_FORMAT[dataSources],
    maxBlocks: profileConfig.maxBlocks,
    maxChildren: profileConfig.maxChildren,
    pages: profileConfig.storage === 'config' ? describePages() : undefined,
    spans: [...SPANS],
    classNames: classNamesFor(profile),
    blocks: describeBlocks(profile),
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
