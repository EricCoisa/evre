import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Container, ContainerGrid } from './container';

describe('Container', () => {
  it('renderiza os children por padrão (expandido, com borda e padding)', () => {
    const { container } = render(<Container>conteudo</Container>);
    expect(screen.getByText('conteudo')).toBeInTheDocument();

    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner).toHaveClass('border', 'h-full', 'min-h-[50px]', 'w-full');
  });

  it('variant dataTable usa padding diferente (p-0 sm:p-6)', () => {
    const { container } = render(<Container variant="dataTable">x</Container>);
    const paddingDiv = container.querySelector('.flex.flex-col.p-0')!;
    expect(paddingDiv).toBeInTheDocument();
  });

  it('variants de altura automática (ex.: stats) usam h-auto', () => {
    const { container } = render(<Container variant="stats">x</Container>);
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner).toHaveClass('h-auto');
  });

  it('border=false remove a classe de borda', () => {
    const { container } = render(<Container border={false}>x</Container>);
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner).not.toHaveClass('border');
  });

  it('padding=false remove as classes de padding interno', () => {
    const { container } = render(<Container padding={false}>x</Container>);
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    const paddingDiv = inner.firstElementChild as HTMLElement;
    expect(paddingDiv.className.trim()).toBe('flex flex-col');
  });

  it('noSpacing=true remove o space-y do container externo', () => {
    const { container } = render(<Container noSpacing>x</Container>);
    expect(container.firstElementChild).not.toHaveClass('space-y-2');
  });

  it('defaultExpanded=false: não renderiza os children e aplica max-h-20', () => {
    const { container } = render(<Container defaultExpanded={false}>conteudo</Container>);
    expect(screen.queryByText('conteudo')).not.toBeInTheDocument();
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner).toHaveClass('max-h-20', 'overflow-hidden');
  });

  it('widthClass customizado substitui o w-full padrão', () => {
    const { container } = render(<Container widthClass="w-1/2">x</Container>);
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner).toHaveClass('w-1/2');
  });

  it('gridItem aplica o estilo de posicionamento no grid', () => {
    const { container } = render(
      <Container gridItem={{ colStart: 1, colEnd: 3, rowStart: 2, rowEnd: 4, area: 'main' }}>x</Container>,
    );
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner.style.gridColumnStart).toBe('1');
    expect(inner.style.gridColumnEnd).toBe('3');
    expect(inner.style.gridRowStart).toBe('2');
    expect(inner.style.gridRowEnd).toBe('4');
    expect(inner.style.gridArea).toBe('main');
  });

  it('sem gridItem, não aplica nenhum estilo de grid', () => {
    const { container } = render(<Container>x</Container>);
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner.style.gridArea).toBe('');
  });
});

describe('ContainerGrid', () => {
  it('colunas numéricas geram repeat(N, minmax(0, 1fr))', () => {
    const { container } = render(<ContainerGrid>x</ContainerGrid>);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
    expect(grid.style.gridTemplateRows).toBe('auto');
    expect(grid.style.gap).toBe('1rem');
  });

  it('colunas como string são usadas diretamente', () => {
    const { container } = render(<ContainerGrid columns="1fr 2fr">x</ContainerGrid>);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('1fr 2fr');
  });

  it('aceita rows, gap e style adicionais, e className', () => {
    const { container } = render(
      <ContainerGrid rows="100px" gap="2rem" className="extra" style={{ padding: '4px' }}>
        x
      </ContainerGrid>,
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid).toHaveClass('w-full', 'extra');
    expect(grid.style.gridTemplateRows).toBe('100px');
    expect(grid.style.gap).toBe('2rem');
    expect(grid.style.padding).toBe('4px');
  });
});
