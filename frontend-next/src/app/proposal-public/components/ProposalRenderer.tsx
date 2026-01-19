"use client";

import React from 'react';
import { Title } from './Title';
import { Text } from './Text';
import { ImageComponent } from './Image';
import { Topic } from './Topic';
import { Container } from './Container';
import { IframeComponent } from './Iframe';
import type {
  ProposalComponent,
  ProposalSchema,
} from './proposal-schema';

interface ProposalRendererProps {
  content: string | ProposalSchema;
}

export function ProposalRenderer({ content }: ProposalRendererProps) {
  // Parse o conteúdo se for string
  const schema: ProposalSchema = typeof content === 'string' 
    ? JSON.parse(content) 
    : content;

  if (!schema.components || !Array.isArray(schema.components)) {
    return (
      <div className="text-center text-muted-foreground p-8">
        Schema inválido ou vazio
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schema.components.map((component, index) => (
        <ComponentRenderer key={index} component={component} />
      ))}
    </div>
  );
}

interface ComponentRendererProps {
  component: ProposalComponent;
}

function ComponentRenderer({ component }: ComponentRendererProps) {
  switch (component.object) {
    case 'Container':
      return (
        <Container value={renderValue(component.value)} className={component.className} />
      );

    case 'Title':
      return (
        <Title
          value={component.value as string}
          level={component.level}
          className={component.className}
        />
      );

    case 'Text':
      return (
        <Text value={renderValue(component.value)} className={component.className} />
      );

    case 'Image':
      return (
        <ImageComponent
          value={component.value}
          alt={component.alt}
          caption={component.caption}
          className={component.className}
        />
      );

    case 'Topic':
      return <Topic value={component.value} className={component.className} />;

    case 'Iframe':
      return (
        <IframeComponent
          value={component.value}
          title={component.title}
          width={component.width}
          height={component.height}
          allow={component.allow}
          className={component.className}
          modal={component.modal}
        />
      );

    default:
      return null;
  }
}

function renderValue(value: unknown): React.ReactNode {
  // Se for string, retorna diretamente
  if (typeof value === 'string') {
    return value;
  }

  // Se for array de componentes, renderiza recursivamente
  if (Array.isArray(value)) {
    return (
      <>
        {value.map((item, index) => {
          if (typeof item === 'object' && 'object' in item) {
            return <ComponentRenderer key={index} component={item as ProposalComponent} />;
          }
          return null;
        })}
      </>
    );
  }

  // Se for um objeto com componente aninhado
  if (typeof value === 'object' && value !== null && 'object' in value) {
    return <ComponentRenderer component={value as ProposalComponent} />;
  }

  return null;
}
