import { useTranslation } from '@/hooks/use-translation';

interface ThinkingPanelProps {
  reasoning: string;
  toolEvents: Array<{ id: string; name: string; input: unknown; result?: unknown }>;
}

export default function ThinkingPanel({ reasoning, toolEvents }: ThinkingPanelProps) {
  const { t } = useTranslation('agent');
  if (!reasoning && toolEvents.length === 0) return null;

  return (
    <details className="mr-auto max-w-[80%] rounded-lg border bg-muted/40 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        {t('thinking')}
      </summary>
      {reasoning && (
        <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{reasoning}</p>
      )}
      {toolEvents.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {toolEvents.map((e, i) => (
            <li key={e.id || `${e.name}-${i}`} className="flex items-center gap-1">
              <span className="font-mono">{e.name}</span>
              <span className="text-muted-foreground">{e.result ? '\u2713' : '\u2026'}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}