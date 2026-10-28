'use client';

import { Button } from '@/components/ui/button';

/** Forma mínima que um botão de variável precisa. Cada módulo estende o que for seu. */
export interface InsertableVariable {
  name: string;
  required?: boolean;
  /** Texto do tooltip, já traduzido por quem chama — o componente não conhece namespace. */
  title?: string;
}

export function insertToken(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  name: string,
  onChange: (value: string) => void,
) {
  const token = `{{ ${name} }}`;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const scrollTop = el.scrollTop;

  el.focus();
  el.setSelectionRange(start, end);

  // insertText preserva a pilha de undo nativa; reescrever `value` pelo React a apagaria.
  const inserted =
    typeof document.execCommand === 'function' &&
    document.execCommand('insertText', false, token);
  if (inserted) {
    el.scrollTop = scrollTop;
    return;
  }

  onChange(value.slice(0, start) + token + value.slice(end));
  requestAnimationFrame(() => {
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
    el.scrollTop = scrollTop;
  });
}


/** Lista botões de variáveis; `usedNames` é calculado pelo chamador para todo o formulário. */
export function VariableButtons({
  variables,
  reserved = [],
  usedNames,
  onInsert,
}: {
  variables: InsertableVariable[];
  reserved?: InsertableVariable[];
  usedNames: Set<string>;
  onInsert: (name: string) => void;
}) {
  if (variables.length === 0 && reserved.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {variables.map((v) => {
        const used = usedNames.has(v.name);
        const variant = used ? 'success' : v.required ? 'destructive' : 'secondary';
        return (
          <Button
            key={v.name}
            type="button"
            size="sm"
            variant={variant}
            className="h-6 px-2 font-mono text-xs"
            title={v.title}
            onClick={() => onInsert(v.name)}
          >
            {`{{${v.name}}}`}
          </Button>
        );
      })}
      {variables.length > 0 && reserved.length > 0 && (
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      )}
      {reserved.map((v) => (
        <Button
          key={v.name}
          type="button"
          size="sm"
          variant={usedNames.has(v.name) ? 'success' : 'outline'}
          className="h-6 px-2 font-mono text-xs"
          title={v.title}
          onClick={() => onInsert(v.name)}
        >
          {`{{${v.name}}}`}
        </Button>
      ))}
    </div>
  );
}
