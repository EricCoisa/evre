"use client";

import { useTranslation } from '@/hooks/use-translation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Sem horário: mensagem de tool só existe vinda do backend, que não devolve
// timestamp por mensagem — aqui o horário nunca chegou a aparecer.
interface ToolCallGroupProps {
  messages: Array<{ id: string; content: string; toolCallId?: string }>;
  toolNameByCallId: Record<string, string>;
}

export default function ToolCallGroup({ messages, toolNameByCallId }: ToolCallGroupProps) {
  const { t } = useTranslation('agent');

  if (messages.length === 1) {
    const msg = messages[0];
    const toolName = msg.toolCallId ? toolNameByCallId[msg.toolCallId] : undefined;
    return (
      <div className="mr-auto max-w-[80%] select-none rounded-lg border border-amber-500/40 bg-amber-50/50 px-3 py-2 dark:bg-amber-950/20">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            {toolName ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>🔧</span>
                </TooltipTrigger>
                <TooltipContent>{toolName}</TooltipContent>
              </Tooltip>
            ) : (
              <span>🔧</span>
            )}
            <span>{t('toolCall')}</span>
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-amber-100/60 p-2 text-xs dark:bg-amber-900/30">
            {msg.content}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="mr-auto max-w-[80%] select-none rounded-lg border border-amber-500/40 bg-amber-50/50 px-3 py-2 dark:bg-amber-950/20">
      <details>
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
          <span>🔧</span>
          <span>{t('toolCallCount', { count: messages.length })}</span>
        </summary>
        <ul className="mt-2 space-y-2">
          {messages.map((msg) => {
            const toolName = msg.toolCallId ? toolNameByCallId[msg.toolCallId] : undefined;
            return (
              <li key={msg.id} className="border-t border-amber-500/20 pt-2 first:border-t-0 first:pt-0">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                  {toolName ? <span className="font-mono">{toolName}</span> : <span>🔧</span>}
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-amber-100/60 p-2 text-xs dark:bg-amber-900/30">
                  {msg.content}
                </pre>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
