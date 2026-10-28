import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import CompositeLangLabel, { resolveCompositeText, isPartActive } from './compositeLangLabel';

describe('CompositeLangLabel', () => {
  it('renderiza a compoundKey quando todas as partes estão ativas', () => {
    render(
      <div data-testid="container">
        <CompositeLangLabel
          langJson="settings"
          compoundKey="settings_section_ai_channels"
          parts={[
            { text: 'settings_section_ai', active: true },
            { text: 'settings_section_channels', active: true },
          ]}
        />
      </div>
    );

    expect(screen.getByTestId('container')).toHaveTextContent('Inteligência Artificial & Canais');
  });

  it('renderiza apenas a primeira parte quando a segunda está desativada', () => {
    render(
      <div data-testid="container">
        <CompositeLangLabel
          langJson="settings"
          compoundKey="settings_section_ai_channels"
          parts={[
            { text: 'settings_section_ai', active: true },
            { text: 'settings_section_channels', active: false },
          ]}
        />
      </div>
    );

    expect(screen.getByTestId('container')).toHaveTextContent('Inteligência Artificial');
    expect(screen.getByTestId('container')).not.toHaveTextContent('Canais');
  });

  it('renderiza apenas a segunda parte quando a primeira está desativada', () => {
    render(
      <div data-testid="container">
        <CompositeLangLabel
          langJson="settings"
          compoundKey="settings_section_ai_channels"
          parts={[
            { text: 'settings_section_ai', active: false },
            { text: 'settings_section_channels', active: true },
          ]}
        />
      </div>
    );

    expect(screen.getByTestId('container')).toHaveTextContent('Canais');
    expect(screen.getByTestId('container')).not.toHaveTextContent('Inteligência Artificial');
  });

  it('renderiza null quando nenhuma parte está ativa', () => {
    render(
      <div data-testid="container">
        <CompositeLangLabel
          langJson="settings"
          compoundKey="settings_section_ai_channels"
          parts={[
            { text: 'settings_section_ai', active: false },
            { text: 'settings_section_channels', active: false },
          ]}
        />
      </div>
    );

    expect(screen.getByTestId('container')).toBeEmptyDOMElement();
  });

  it('junta partes com o separador quando não há compoundKey', () => {
    render(
      <div data-testid="container">
        <CompositeLangLabel
          langJson="settings"
          parts={[
            { text: 'settings_section_ai', active: true },
            { text: 'settings_section_channels', active: true },
          ]}
        />
      </div>
    );

    expect(screen.getByTestId('container')).toHaveTextContent('Inteligência Artificial & Canais');
  });

  it('resolveCompositeText calcula texto corretamente', () => {
    const mockT = (key: string) => {
      const dict: Record<string, string> = {
        ai: 'IA',
        channels: 'Canais',
        both: 'IA e Canais',
      };
      return dict[key] ?? key;
    };

    expect(
      resolveCompositeText(
        [
          { text: 'ai', active: true },
          { text: 'channels', active: true },
        ],
        { compoundKey: 'both', translateFn: mockT }
      )
    ).toBe('IA e Canais');

    expect(
      resolveCompositeText(
        [
          { text: 'ai', active: true },
          { text: 'channels', active: false },
        ],
        { compoundKey: 'both', translateFn: mockT }
      )
    ).toBe('IA');

    expect(
      resolveCompositeText(
        [
          { text: 'ai', active: false },
          { text: 'channels', active: false },
        ],
        { compoundKey: 'both', translateFn: mockT }
      )
    ).toBeNull();
  });

  it('isPartActive e resolveCompositeText respeitam capability dinamicamente', () => {
    const mockT = (key: string) => (key === 'msg' ? 'Mensageria' : key);
    const capabilities = {
      MESSAGING: { available: false, operational: false },
      EMAIL: { available: true, operational: true },
    };

    expect(isPartActive({ text: 'msg', capability: 'MESSAGING' }, capabilities)).toBe(false);
    expect(isPartActive({ text: 'mail', capability: 'EMAIL' }, capabilities)).toBe(true);

    // explicit active takes precedence over capability
    expect(isPartActive({ text: 'msg', active: true, capability: 'MESSAGING' }, capabilities)).toBe(true);

    const resolved = resolveCompositeText(
      [{ text: 'msg', capability: 'MESSAGING' }],
      { capabilities, translateFn: mockT }
    );
    expect(resolved).toBeNull();
  });
});

