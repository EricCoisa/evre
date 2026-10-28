import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Upload } from './upload';

const mockUseStorageHealth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/user/queries', () => ({ useStorageHealth: mockUseStorageHealth }));

describe('Upload', () => {
  it('mostra o título e os children quando fornecidos', () => {
    mockUseStorageHealth.mockReturnValue({ data: { operational: true } });
    render(<Upload title="Foto de perfil">{'<img>'}</Upload>);

    expect(screen.getByText('Foto de perfil')).toBeInTheDocument();
    expect(screen.getByText('<img>')).toBeInTheDocument();
  });

  it('clicar na máscara aciona o input de arquivo quando habilitado', () => {
    mockUseStorageHealth.mockReturnValue({ data: { operational: true } });
    const { container } = render(<Upload />);
    const input = container.querySelector('input')!;
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.click(container.querySelector('.absolute')!);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('storage indisponível desabilita o input e a máscara não aciona o clique', () => {
    mockUseStorageHealth.mockReturnValue({ data: { operational: false } });
    const { container } = render(<Upload />);
    const input = container.querySelector('input')!;
    const clickSpy = vi.spyOn(input, 'click');

    expect(input).toBeDisabled();
    fireEvent.click(container.querySelector('.absolute')!);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('disabled explícito desabilita mesmo com storage operacional', () => {
    mockUseStorageHealth.mockReturnValue({ data: { operational: true } });
    const { container } = render(<Upload disabled />);
    expect(container.querySelector('input')).toBeDisabled();
  });

  it('repassa name, type, accept e onChange para o input', () => {
    mockUseStorageHealth.mockReturnValue({ data: { operational: true } });
    const onChange = vi.fn();
    const { container } = render(
      <Upload name="avatar" type="file" accept="image/*" onChange={onChange} />,
    );

    const input = container.querySelector('input')!;
    expect(input).toHaveAttribute('name', 'avatar');
    expect(input).toHaveAttribute('accept', 'image/*');

    fireEvent.change(input, { target: { files: [] } });
    expect(onChange).toHaveBeenCalled();
  });

  it('sem storageHealth resolvido ainda, considera habilitado', () => {
    mockUseStorageHealth.mockReturnValue({ data: undefined });
    const { container } = render(<Upload />);
    expect(container.querySelector('input')).not.toBeDisabled();
  });
});
