"use client";

/**
 * Schema de contrato para o JSON de documentos contratuais
 * Define os componentes renderizáveis e suas propriedades
 */

export type ComponentType = 'Container' | 'Title' | 'Text' | 'Clause' | 'Term' | 'Party' | 'Date';

export interface BaseComponent {
  object: ComponentType;
}

export interface ContainerComponent extends BaseComponent {
  object: 'Container';
  value: string | ContractComponent[];
  className?: string;
}

export interface TitleComponent extends BaseComponent {
  object: 'Title';
  value: string;
  level?: 1 | 2 | 3 | 4;
  className?: string;
}

export interface TextComponent extends BaseComponent {
  object: 'Text';
  value: string | ContractComponent[];
  className?: string;
}

export interface ClauseComponent extends BaseComponent {
  object: 'Clause';
  value: {
    number?: string | number;
    title: string;
    content: string;
    subclauses?: string[] | { title?: string; content: string }[];
  };
  className?: string;
}

export interface TermComponent extends BaseComponent {
  object: 'Term';
  value: string | string[];
  className?: string;
}

export interface PartyComponent extends BaseComponent {
  object: 'Party';
  value: {
    name: string;
    document?: string;
    address?: string;
    role: 'contractor' | 'contracted' | 'witness';
  };
  className?: string;
}

export interface DateComponent extends BaseComponent {
  object: 'Date';
  value: string;
  label?: string;
  className?: string;
}

export type ContractComponent =
  | ContainerComponent
  | TitleComponent
  | TextComponent
  | ClauseComponent
  | TermComponent
  | PartyComponent
  | DateComponent;

export interface ContractSchema {
  version: string;
  components: ContractComponent[];
}

/**
 * Valida se um objeto é um componente válido
 */
export function isValidComponent(obj: unknown): obj is ContractComponent {
  if (!obj || typeof obj !== 'object') return false;
  const component = obj as Record<string, unknown>;
  return (
    typeof component.object === 'string' &&
    ['Container', 'Title', 'Text', 'Clause', 'Term', 'Party', 'Date'].includes(component.object) &&
    'value' in component
  );
}
