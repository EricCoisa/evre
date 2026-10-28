'use client';

import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { insertToken, VariableButtons } from '@/components/variable-insert';
import type { ReservedVariable, TemplateVariable } from '@/lib/actions/messaging/types';

/** Campo de texto com atalhos para inserir `{{ variável }}` na posição do cursor. */
export function VariableInputRow({
  label,
  value,
  onChange,
  variables,
  reserved,
  usedNames,
  maxLength,
  placeholder,
  description,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  variables: TemplateVariable[];
  reserved: ReservedVariable[];
  usedNames: Set<string>;
  maxLength?: number;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="group grid gap-1.5">
      <Label>{label}</Label>
      <Input
        ref={ref}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {/* Só aparece com o campo ativo — senão a tela fica poluída com botões de todo campo. */}
      <div className="hidden group-focus-within:block">
        <VariableButtons
          variables={variables}
          reserved={reserved}
          usedNames={usedNames}
          onInsert={(name) => ref.current && insertToken(ref.current, value, name, onChange)}
        />
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
