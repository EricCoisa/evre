"use client";

import React from 'react';
import { Title } from './Title';
import { Text } from './Text';
import { Container } from './Container';
import { Clause } from './Clause';
import { Term } from './Term';
import { Party } from './Party';
import { DateComponent } from './Date';
import type {
  ContractComponent,
  ContractSchema,
} from './contract-schema';

interface ContractRendererProps {
  content: string | ContractSchema;
}

export function ContractRenderer({ content }: ContractRendererProps) {
  // Parse o conteúdo se for string
  const schema: ContractSchema = typeof content === 'string' 
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
  component: ContractComponent;
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

    case 'Clause':
      return <Clause value={component.value} className={component.className} />;

    case 'Term':
      return <Term value={component.value} className={component.className} />;

    case 'Party':
      return <Party value={component.value} className={component.className} />;

    case 'Date':
      return (
        <DateComponent
          value={component.value}
          label={component.label}
          className={component.className}
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
            return <ComponentRenderer key={index} component={item as ContractComponent} />;
          }
          return null;
        })}
      </>
    );
  }

  // Se for um objeto com componente aninhado
  if (typeof value === 'object' && value !== null && 'object' in value) {
    return <ComponentRenderer component={value as ContractComponent} />;
  }

  return null;
}
