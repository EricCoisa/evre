"use client";

/**
 * Schema de contrato para o JSON de propostas
 * Define os componentes renderizáveis e suas propriedades
 */

export type ComponentType = 'Container' | 'Title' | 'Text' | 'Image' | 'Topic' | 'Iframe';
export interface IframeComponent extends BaseComponent {
  object: 'Iframe';
  value: string; // URL do iframe
  title?: string;
  width?: string | number;
  height?: string | number;
  allow?: string;
  className?: string;
}

export interface BaseComponent {
  object: ComponentType;
}

export interface ContainerComponent extends BaseComponent {
  object: 'Container';
  value: string | ProposalComponent[];
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
  value: string | ProposalComponent[];
  className?: string;
}

export interface ImageComponent extends BaseComponent {
  object: 'Image';
  value: string; // URL da imagem
  alt?: string;
  caption?: string;
  className?: string;
}

export interface TopicComponent extends BaseComponent {
  object: 'Topic';
  value: {
    title: string;
    description?: string;
    items?: string[];
    icon?: string;
  };
  className?: string;
}

export type ProposalComponent =
  | ContainerComponent
  | TitleComponent
  | TextComponent
  | ImageComponent
  | TopicComponent
  | IframeComponent;

export interface ProposalSchema {
  version: string;
  components: ProposalComponent[];
}

/**
 * Valida se um objeto é um componente válido
 */
export function isValidComponent(obj: unknown): obj is ProposalComponent {
  if (!obj || typeof obj !== 'object') return false;
  const component = obj as Record<string, unknown>;
  return (
    typeof component.object === 'string' &&
    ['Container', 'Title', 'Text', 'Image', 'Topic', 'Iframe'].includes(component.object) &&
    'value' in component
  );
}
