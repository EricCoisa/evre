import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormBuilder, FormBuilderModal, SubmitCancelledError } from './form-builder';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));
// Upload (usado pelo campo type="image") depende de useStorageHealth via react-query.
vi.mock('@/lib/actions/user/queries', () => ({
  useStorageHealth: () => ({ data: { operational: true } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// jsdom não implementa estas APIs usadas pelo Radix Select e pelo preview de imagem.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
const createObjectURLMock = vi.fn(() => 'blob:mock-preview');
URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;

const schema = z.object({ name: z.string().min(1) });
const fields = [{ name: 'name', label: 'Nome' }];

function setup(onSubmit: () => Promise<unknown>) {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  render(
    <FormBuilder
      schema={schema}
      fields={fields}
      onSubmit={onSubmit}
      onSuccess={onSuccess}
      onError={onError}
    />,
  );
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'x' } });
  fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));
  return { onSuccess, onError };
}

describe('FormBuilder — form element', () => {
  it('declara method="post" — Enter antes da hidratação não deve virar GET com dados na URL', () => {
    const { container } = render(
      <FormBuilder schema={schema} fields={fields} onSubmit={vi.fn()} />,
    );
    expect(container.querySelector('form')).toHaveAttribute('method', 'post');
  });
});

describe('FormBuilder — onSubmit', () => {
  it('SubmitCancelledError (pessoa desistiu) não mostra erro nem conclui o formulário', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new SubmitCancelledError());
    const { onSuccess, onError } = setup(onSubmit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(toast.error).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('erro de verdade continua virando toast com a mensagem', async () => {
    const { onError } = setup(vi.fn().mockRejectedValue(new Error('tipo em uso')));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('tipo em uso'));
    expect(onError).toHaveBeenCalled();
  });
});

describe('FormBuilder — disableSubmitWhenClean', () => {
  it('desabilita o submit enquanto o valor bate com o salvo, habilita ao digitar diferente', () => {
    render(
      <FormBuilder
        schema={schema}
        fields={fields}
        mode="edit"
        values={{ name: 'original' }}
        onSubmit={vi.fn()}
        disableSubmitWhenClean
      />,
    );
    const button = screen.getByRole('button', { name: /submit|save|salvar|enviar/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'novo valor' } });
    expect(button).not.toBeDisabled();
  });

  it('sem a flag, o submit nunca é desabilitado por estar "limpo"', () => {
    render(
      <FormBuilder schema={schema} fields={fields} mode="edit" values={{ name: 'original' }} onSubmit={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /submit|save|salvar|enviar/i })).not.toBeDisabled();
  });
});

describe('FormBuilder — validação', () => {
  it('schema inválido bloqueia o submit e mostra a mensagem de erro do campo', async () => {
    const onSubmit = vi.fn();
    render(<FormBuilder schema={schema} fields={fields} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    await waitFor(() => expect(document.querySelector('[data-slot="form-message"]')).not.toBeNull());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('FormBuilder — onSubmit (casos adicionais)', () => {
  it('rejeita com valor que não é Error — usa a mensagem genérica errorMessage', async () => {
    const onSubmit = vi.fn().mockRejectedValue('string de erro');
    render(<FormBuilder schema={schema} fields={fields} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('errorMessage'));
  });

  it('erro sem onError informado não quebra o fluxo', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('falhou'));
    render(<FormBuilder schema={schema} fields={fields} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('falhou'));
  });

  it('rejeita com valor que não é Error E onError está presente — onError recebe um Error sintético', async () => {
    const onSubmit = vi.fn().mockRejectedValue('string de erro');
    const onError = vi.fn();
    render(<FormBuilder schema={schema} fields={fields} onSubmit={onSubmit} onError={onError} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(new Error('errorMessage')));
  });
});

describe('FormBuilder — submit com sucesso', () => {
  it('modo create: toast successMessage, chama onSuccess e limpa o campo', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ id: 1 });
    const onSuccess = vi.fn();
    render(<FormBuilder schema={schema} fields={fields} mode="create" onSubmit={onSubmit} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('successMessage'));
    expect(onSuccess).toHaveBeenCalledWith({ id: 1 });
    await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveValue(''));
  });

  it('modo edit: toast usa updatedSuccessfully', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <FormBuilder schema={schema} fields={fields} mode="edit" values={{ name: 'original' }} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'novo' } });
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('updatedSuccessfully'));
  });

  it('showToast=false não mostra toast mas ainda chama onSuccess', async () => {
    const onSubmit = vi.fn().mockResolvedValue('ok');
    const onSuccess = vi.fn();
    render(
      <FormBuilder schema={schema} fields={fields} onSubmit={onSubmit} onSuccess={onSuccess} showToast={false} />,
    );
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('ok'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('successView substitui o conteúdo do formulário após o sucesso', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <FormBuilder schema={schema} fields={fields} onSubmit={onSubmit} successView={<div>Tudo certo!</div>} />,
    );
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    expect(await screen.findByText('Tudo certo!')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
  });
});

describe('FormBuilder — estado isSubmitting', () => {
  it('desabilita o submit e mostra o spinner enquanto a promise não resolve', async () => {
    let resolveSubmit: (v: unknown) => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { container } = render(<FormBuilder schema={schema} fields={fields} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'x' } });
    const button = screen.getByRole('button', { name: /submit|save|salvar|enviar/i });
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(container.querySelector('svg.animate-spin')).toBeTruthy();

    resolveSubmit(undefined);
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});

describe('FormBuilder — barra de ações', () => {
  it('sem onCancel e sem actions: só o submit, full width', () => {
    const { container } = render(<FormBuilder schema={schema} fields={fields} onSubmit={vi.fn()} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveClass('w-full');
  });

  it('com onCancel (sem actions): vira submit+cancel, cancelar reseta o form', () => {
    const onCancel = vi.fn();
    render(<FormBuilder schema={schema} fields={fields} onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'mudou' } });

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByLabelText('Nome')).toHaveValue('');
  });

  it('actions.mode submit+cancel sem a prop onCancel: Cancelar ainda aparece (handleCancel interno é sempre truthy) e só reseta o form', () => {
    const { container } = render(
      <FormBuilder schema={schema} fields={fields} onSubmit={vi.fn()} actions={{ mode: 'submit+cancel' }} />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'mudou' } });
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.getByLabelText('Nome')).toHaveValue('');
  });

  it('actions.mode submit+link com link: renderiza o link e dispara o onClick', () => {
    const onClick = vi.fn();
    render(
      <FormBuilder
        schema={schema}
        fields={fields}
        onSubmit={vi.fn()}
        actions={{ mode: 'submit+link', link: { label: 'Esqueceu?', href: '#help', onClick } }}
      />,
    );
    const link = screen.getByRole('link', { name: 'Esqueceu?' });
    expect(link).toHaveAttribute('href', '#help');
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalled();
  });

  it('actions.mode submit+link sem link: não renderiza nada extra', () => {
    const { container } = render(
      <FormBuilder schema={schema} fields={fields} onSubmit={vi.fn()} actions={{ mode: 'submit+link' }} />,
    );
    expect(container.querySelectorAll('button, a')).toHaveLength(1);
  });

  it('actions.mode explícito tem prioridade sobre a presença de onCancel', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <FormBuilder
        schema={schema}
        fields={fields}
        onSubmit={vi.fn()}
        onCancel={onCancel}
        actions={{ mode: 'submit-only' }}
      />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });
});

describe('FormBuilder — chrome e layout', () => {
  it('chrome="card" envolve o conteúdo com o wrapper com borda/fundo', () => {
    const { container } = render(<FormBuilder schema={schema} fields={fields} onSubmit={vi.fn()} chrome="card" />);
    expect(container.querySelector('.bg-card\\/30')).toBeTruthy();
  });

  it('gridClassName troca a classe padrão do wrapper dos campos', () => {
    const { container } = render(
      <FormBuilder schema={schema} fields={fields} onSubmit={vi.fn()} gridClassName="flex gap-8" />,
    );
    expect(container.querySelector('.flex.gap-8')).toBeTruthy();
    expect(container.querySelector('.grid.gap-4')).toBeFalsy();
  });
});

describe('FormBuilder — resolução de campos via fieldConfig', () => {
  it('constrói os campos a partir do schema + fieldConfig quando "fields" não é passado', () => {
    const cfgSchema = z.object({ email: z.string().email(), age: z.number() });
    render(<FormBuilder schema={cfgSchema} fieldConfig={{ email: { label: 'Email' } }} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Age')).toBeInTheDocument();
  });

  it('schema que não é ZodObject + fieldConfig não gera nenhum campo', () => {
    render(<FormBuilder schema={z.string() as never} fieldConfig={{} as never} onSubmit={vi.fn()} />);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /submit|save|salvar|enviar/i })).toBeInTheDocument();
  });
});

describe('FormBuilder — mode edit reage a mudança de values', () => {
  it('reseta os campos quando values muda (edição trocando de registro)', () => {
    const { rerender } = render(
      <FormBuilder schema={schema} fields={fields} mode="edit" values={{ name: 'Primeiro' }} onSubmit={vi.fn()} />,
    );
    expect(screen.getByLabelText('Nome')).toHaveValue('Primeiro');

    rerender(
      <FormBuilder schema={schema} fields={fields} mode="edit" values={{ name: 'Segundo' }} onSubmit={vi.fn()} />,
    );
    expect(screen.getByLabelText('Nome')).toHaveValue('Segundo');
  });
});

describe('FormBuilder — campo number', () => {
  it('onChange usa valueAsNumber em vez da string digitada', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const numberField = [{ name: 'age', label: 'Idade', type: 'number' as const }];
    render(<FormBuilder schema={z.object({ age: z.number() })} fields={numberField} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Idade'), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ age: 42 }));
  });
});

describe('FormBuilder — campo textarea', () => {
  it('renderiza um textarea e aceita digitação', () => {
    const textareaField = [{ name: 'bio', label: 'Bio', type: 'textarea' as const, placeholder: 'Fale sobre você' }];
    render(<FormBuilder schema={z.object({ bio: z.string().optional() })} fields={textareaField} onSubmit={vi.fn()} />);

    const textarea = screen.getByLabelText('Bio');
    expect(textarea.tagName).toBe('TEXTAREA');
    fireEvent.change(textarea, { target: { value: 'uma bio qualquer' } });
    expect(textarea).toHaveValue('uma bio qualquer');
  });
});

describe('FormBuilder — campo checkbox', () => {
  it('começa desmarcado por padrão (computeFieldDefaults) e alterna ao clicar', () => {
    const checkboxField = [{ name: 'active', label: 'Ativo', type: 'checkbox' as const }];
    render(<FormBuilder schema={z.object({ active: z.boolean() })} fields={checkboxField} onSubmit={vi.fn()} />);

    const checkbox = screen.getByLabelText('Ativo') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });
});

describe('FormBuilder — campo select', () => {
  const selectFields = [
    {
      name: 'role',
      label: 'Role',
      type: 'select' as const,
      options: [
        { value: 'admin', label: 'Admin' },
        { value: 'user', label: 'User' },
      ],
    },
  ];

  it('mostra o placeholder padrão da tradução e seleciona uma opção ao abrir', async () => {
    const user = userEvent.setup();
    render(<FormBuilder schema={z.object({ role: z.string() })} fields={selectFields} onSubmit={vi.fn()} />);

    expect(screen.getByText('selectPlaceholder')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Admin' }));

    expect(screen.getByRole('combobox')).toHaveTextContent('Admin');
  });

  it('usa o placeholder customizado do campo quando informado', () => {
    const customPlaceholder = [{ ...selectFields[0], placeholder: 'Escolha um papel' }];
    render(<FormBuilder schema={z.object({ role: z.string() })} fields={customPlaceholder} onSubmit={vi.fn()} />);

    expect(screen.getByText('Escolha um papel')).toBeInTheDocument();
  });
});

describe('FormBuilder — campo phone', () => {
  it('digita o número e emite o valor em E.164 via onChange', () => {
    const phoneField = [{ name: 'phone', label: 'Telefone', type: 'phone' as const, placeholder: '(DD) 9....-....' }];
    render(<FormBuilder schema={z.object({ phone: z.string() })} fields={phoneField} onSubmit={vi.fn()} />);

    const input = screen.getByPlaceholderText('(DD) 9....-....') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '11999999999' } });

    expect(input.value.replace(/\D/g, '')).toBe('11999999999');
  });
});

describe('FormBuilder — campos phone/select com field.disabled', () => {
  it('field.disabled=true desabilita o input de telefone e o trigger do select mesmo fora de isSubmitting', () => {
    const mixedFields = [
      { name: 'phone', label: 'Telefone', type: 'phone' as const, placeholder: '(DD) 9....-....', disabled: true },
      {
        name: 'role',
        label: 'Role',
        type: 'select' as const,
        disabled: true,
        options: [{ value: 'admin', label: 'Admin' }],
      },
    ];
    render(
      <FormBuilder schema={z.object({ phone: z.string(), role: z.string() })} fields={mixedFields} onSubmit={vi.fn()} />,
    );
    expect(screen.getByPlaceholderText('(DD) 9....-....')).toBeDisabled();
    for (const combobox of screen.getAllByRole('combobox')) {
      expect(combobox).toBeDisabled();
    }
  });
});

describe('FormBuilder — campos phone/select com valor null (fallback ?? "")', () => {
  it('valores null em edição não quebram phone/select — cai no fallback de string vazia', () => {
    const mixedFields = [
      { name: 'phone', label: 'Telefone', type: 'phone' as const, placeholder: '(DD) 9....-....' },
      {
        name: 'role',
        label: 'Role',
        type: 'select' as const,
        options: [{ value: 'admin', label: 'Admin' }],
      },
    ];
    render(
      <FormBuilder
        schema={z.object({ phone: z.string().nullable(), role: z.string().nullable() })}
        fields={mixedFields}
        mode="edit"
        values={{ phone: null, role: null }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('(DD) 9....-....')).toHaveValue('');
    expect(screen.getByText('selectPlaceholder')).toBeInTheDocument();
  });
});

describe('FormBuilder — campos phone/select desabilitam durante isSubmitting', () => {
  it('desabilita o input de telefone e o trigger do select enquanto a promise não resolve', async () => {
    let resolveSubmit: (v: unknown) => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const mixedFields = [
      { name: 'phone', label: 'Telefone', type: 'phone' as const, placeholder: '(DD) 9....-....' },
      {
        name: 'role',
        label: 'Role',
        type: 'select' as const,
        options: [{ value: 'admin', label: 'Admin' }],
      },
    ];
    render(
      <FormBuilder
        schema={z.object({ phone: z.string(), role: z.string() })}
        fields={mixedFields}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    await waitFor(() => expect(screen.getByPlaceholderText('(DD) 9....-....')).toBeDisabled());
    for (const combobox of screen.getAllByRole('combobox')) {
      expect(combobox).toBeDisabled();
    }

    resolveSubmit(undefined);
    await waitFor(() => expect(screen.getByPlaceholderText('(DD) 9....-....')).not.toBeDisabled());
  });
});

describe('FormBuilder — campo file', () => {
  it('seleciona um arquivo e o envia no submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const fileField = [{ name: 'doc', label: 'Documento', type: 'file' as const }];
    render(<FormBuilder schema={z.object({ doc: z.any() })} fields={fileField} onSubmit={onSubmit} />);

    const file = new File(['conteudo'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Documento'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ doc: file }));
  });
});

describe('FormBuilder — campo image', () => {
  const avatarSchema = z.object({ avatar: z.any() });

  it('sem valor e sem preview não chama URL.createObjectURL', () => {
    const imageField = [{ name: 'avatar', label: 'Avatar', type: 'image' as const }];
    render(<FormBuilder schema={avatarSchema} fields={imageField} onSubmit={vi.fn()} />);
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it('usa field.preview como preview quando não há valor', () => {
    const imageField = [{ name: 'avatar', label: 'Avatar', type: 'image' as const, preview: 'https://x/old.png' }];
    render(<FormBuilder schema={avatarSchema} fields={imageField} onSubmit={vi.fn()} />);
    expect(screen.getByText('Avatar')).toBeInTheDocument();
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it('ao escolher um arquivo, gera o preview via URL.createObjectURL', () => {
    const imageField = [{ name: 'avatar', label: 'Avatar', type: 'image' as const }];
    const { container } = render(<FormBuilder schema={avatarSchema} fields={imageField} onSubmit={vi.fn()} />);

    const file = new File(['img'], 'a.png', { type: 'image/png' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(createObjectURLMock).toHaveBeenCalledWith(file);
  });

  it('com valor string (edição) usa a própria string como preview', () => {
    const imageField = [{ name: 'avatar', label: 'Avatar', type: 'image' as const }];
    render(
      <FormBuilder
        schema={avatarSchema}
        fields={imageField}
        mode="edit"
        values={{ avatar: 'https://x/current.png' }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('Avatar')).toBeInTheDocument();
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it('sem label não renderiza o FormLabel', () => {
    const imageField = [{ name: 'avatar', label: '', type: 'image' as const }];
    render(<FormBuilder schema={avatarSchema} fields={imageField} onSubmit={vi.fn()} />);
    expect(screen.queryByText('Avatar')).not.toBeInTheDocument();
  });
});

describe('FormBuilder — campo custom', () => {
  it('chama field.render com o field do RHF e reflete a digitação', () => {
    const customField = [
      {
        name: 'extra',
        label: 'Extra',
        type: 'custom' as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render: (f: any) => (
          <input aria-label="custom-input" value={f.value ?? ''} onChange={(e) => f.onChange(e.target.value)} />
        ),
      },
    ];
    render(
      <FormBuilder schema={z.object({ extra: z.string().optional() })} fields={customField} onSubmit={vi.fn()} />,
    );

    const input = screen.getByLabelText('custom-input');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input).toHaveValue('abc');
  });

  it('sem render e sem label não quebra e não mostra FormLabel', () => {
    const customField = [{ name: 'extra', label: '', type: 'custom' as const }];
    const { container } = render(
      <FormBuilder schema={z.object({ extra: z.string().optional() })} fields={customField} onSubmit={vi.fn()} />,
    );
    expect(container.querySelector('label')).toBeNull();
  });
});

describe('FormBuilder — campo display', () => {
  it('mostra valor somente leitura via placeholder e exibe a description', () => {
    const displayField = [
      { name: 'status', label: 'Status', type: 'display' as const, placeholder: 'Ativo', description: 'Situação atual' },
    ];
    render(
      <FormBuilder schema={z.object({ status: z.string().optional() })} fields={displayField} onSubmit={vi.fn()} />,
    );

    const input = screen.getByDisplayValue('Ativo') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(screen.getByText('Situação atual')).toBeInTheDocument();
  });

  it('sem placeholder, cai no fallback de string vazia', () => {
    const displayField = [{ name: 'status', label: 'Status', type: 'display' as const }];
    const { container } = render(
      <FormBuilder schema={z.object({ status: z.string().optional() })} fields={displayField} onSubmit={vi.fn()} />,
    );
    expect(container.querySelector('input')).toHaveValue('');
  });
});

describe('FormBuilderModal', () => {
  it('renderiza título e descrição quando open=true', () => {
    render(
      <FormBuilderModal
        open
        onOpenChange={vi.fn()}
        title="Novo item"
        description="Preencha os dados"
        schema={schema}
        fields={fields}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('Novo item')).toBeInTheDocument();
    expect(screen.getByText('Preencha os dados')).toBeInTheDocument();
  });

  it('open=false não renderiza o conteúdo do modal', () => {
    render(
      <FormBuilderModal
        open={false}
        onOpenChange={vi.fn()}
        title="Novo item"
        schema={schema}
        fields={fields}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByText('Novo item')).not.toBeInTheDocument();
  });

  it('onSuccess fecha o modal (onOpenChange(false)) e repassa o resultado', async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(
      <FormBuilderModal
        open
        onOpenChange={onOpenChange}
        title="Novo item"
        schema={schema}
        fields={fields}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /submit|save|salvar|enviar/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSuccess).toHaveBeenCalledWith({ ok: true });
  });

  it('cancelar fecha o modal (onOpenChange(false)) e chama onCancel', () => {
    const onOpenChange = vi.fn();
    const onCancel = vi.fn();
    render(
      <FormBuilderModal
        open
        onOpenChange={onOpenChange}
        title="Novo item"
        schema={schema}
        fields={fields}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCancel).toHaveBeenCalled();
  });
});
