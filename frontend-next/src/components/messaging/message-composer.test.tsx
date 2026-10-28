import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { MessagingCapabilities } from '@/lib/actions/messaging/types';
import { MessageComposer, type Attachment } from './message-composer';

const mocks = vi.hoisted(() => ({
  sendText: vi.fn(),
  sendFile: vi.fn(),
  sendPresence: vi.fn(),
  toastError: vi.fn(),
  voiceSupported: true,
  recording: false,
  recorderSeconds: 0,
  recorderStart: vi.fn(),
  recorderStop: vi.fn(),
  recorderCancel: vi.fn(),
}));

const TEMPLATE_FIXTURE = {
  id: 'tpl-1',
  key: 'boas_vindas',
  language: 'pt-BR',
  typeId: 'type-1',
  approvalStatus: 'APPROVED',
};
const TYPE_FIXTURE = {
  id: 'type-1',
  variables: [{ name: 'first_name', type: 'STRING', required: true }],
};

vi.mock('@/lib/actions/messaging/queries', () => ({
  useSendMessage: () => ({ mutate: mocks.sendText, isPending: false }),
  useSendAttachment: () => ({ mutate: mocks.sendFile, isPending: false }),
  useSendPresence: () => ({ mutate: mocks.sendPresence, isPending: false }),
  useTemplatesForConnection: () => ({ data: [TEMPLATE_FIXTURE] }),
  useTemplateTypes: () => ({ data: [TYPE_FIXTURE] }),
  useTemplateVariables: () => ({ data: [] }),
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));
vi.mock('@/components/rich-text-input', () => ({
  RichTextInput: ({
    value,
    onChange,
    ariaLabel,
    onKeyDown,
    onPaste,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
    onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
    disabled?: boolean;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  ),
}));
vi.mock('@/hooks/use-voice-recorder', () => ({
  isVoiceRecordingSupported: () => mocks.voiceSupported,
  useVoiceRecorder: () => ({
    recording: mocks.recording,
    seconds: mocks.recorderSeconds,
    start: mocks.recorderStart,
    stop: mocks.recorderStop,
    cancel: mocks.recorderCancel,
  }),
}));

const PHONE = '5511999990001';

beforeAll(() => {
  // jsdom não implementa URL de objeto; o preview do anexo usa.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
const caps = (over: Partial<MessagingCapabilities> = {}): MessagingCapabilities => ({
  provider: 'EVOLUTION_API',
  messageTypes: ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'TEMPLATE'],
  template: {
    approval: false,
    providerOwnedBody: [],
    components: { header: [], footer: false, buttons: [] },
  },
  voiceRecording: true,
  typing: { inbound: true, outbound: true },
  serviceWindowHours: null,
  ...over,
});

function setup(
  props: Partial<React.ComponentProps<typeof MessageComposer>> = {},
) {
  const onAttachmentChange = vi.fn();
  const onSent = vi.fn();
  render(
    <MessageComposer
      connectionId="conn-1"
      phone={PHONE}
      capabilities={caps()}
      operational
      attachment={null}
      onAttachmentChange={onAttachmentChange}
      onSent={onSent}
      {...props}
    />,
  );
  return { onAttachmentChange, onSent };
}

const png = new File(['x'], 'foto.png', { type: 'image/png' });
const textbox = () => screen.getByRole('textbox', { name: 'messageText' });

describe('MessageComposer — texto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.voiceSupported = true;
  });

  it('Enter envia o texto aparado; ao concluir limpa o campo e avisa', () => {
    const { onSent } = setup();
    fireEvent.change(textbox(), { target: { value: '  Oi  ' } });
    fireEvent.keyDown(textbox(), { key: 'Enter' });

    expect(mocks.sendText).toHaveBeenCalledWith(
      { connectionId: 'conn-1', phone: PHONE, type: 'TEXT', text: 'Oi' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    act(() => mocks.sendText.mock.calls[0][1].onSuccess());
    expect(onSent).toHaveBeenCalled();
    expect(textbox()).toHaveValue('');
  });

  it('Shift+Enter é quebra de linha, não envio', () => {
    setup();
    fireEvent.change(textbox(), { target: { value: 'Oi' } });
    fireEvent.keyDown(textbox(), { key: 'Enter', shiftKey: true });
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it('Enter durante composição de IME não envia', () => {
    setup();
    fireEvent.change(textbox(), { target: { value: 'にほん' } });
    fireEvent.keyDown(textbox(), { key: 'Enter', isComposing: true });
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it('texto vazio não envia', () => {
    setup();
    fireEvent.change(textbox(), { target: { value: '   ' } });
    fireEvent.keyDown(textbox(), { key: 'Enter' });
    expect(mocks.sendText).not.toHaveBeenCalled();
  });

  it('provider fora do ar desabilita tudo', () => {
    setup({ operational: false });
    expect(textbox()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'attach' })).toBeDisabled();
  });

  it('sem capabilities (carregando ou com erro) não envia', () => {
    setup({ capabilities: undefined });
    expect(textbox()).toBeDisabled();
  });
});

describe('MessageComposer — anexo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('"Fotos e vídeos" anexa para o backend deduzir o tipo; "Documento" força DOCUMENT', () => {
    const { onAttachmentChange } = setup();
    fireEvent.change(screen.getByTestId('media-input'), { target: { files: [png] } });
    expect(onAttachmentChange).toHaveBeenLastCalledWith({ file: png, asDocument: false });

    fireEvent.change(screen.getByTestId('document-input'), { target: { files: [png] } });
    expect(onAttachmentChange).toHaveBeenLastCalledWith({ file: png, asDocument: true });
  });

  it('arquivo acima de 64 MB é recusado com aviso', () => {
    const { onAttachmentChange } = setup();
    const big = new File(['x'], 'grande.mp4', { type: 'video/mp4' });
    Object.defineProperty(big, 'size', { value: 65 * 1024 * 1024 });
    fireEvent.change(screen.getByTestId('media-input'), { target: { files: [big] } });

    expect(onAttachmentChange).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('fileTooLarge');
  });

  it('colar uma imagem a anexa', () => {
    const { onAttachmentChange } = setup();
    fireEvent.paste(textbox(), { clipboardData: { files: [png] } });
    expect(onAttachmentChange).toHaveBeenCalledWith({ file: png, asDocument: false });
  });

  it('colar texto comum segue o fluxo normal', () => {
    const { onAttachmentChange } = setup();
    fireEvent.paste(textbox(), { clipboardData: { files: [] } });
    expect(onAttachmentChange).not.toHaveBeenCalled();
  });

  it('com anexo, o texto vira legenda e o envio é multipart', () => {
    const attachment: Attachment = { file: png, asDocument: true };
    const { onAttachmentChange, onSent } = setup({ attachment });
    fireEvent.change(textbox(), { target: { value: ' nota ' } });
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    expect(mocks.sendFile).toHaveBeenCalledWith(
      { connectionId: 'conn-1', phone: PHONE, file: png, caption: 'nota', type: 'DOCUMENT' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mocks.sendText).not.toHaveBeenCalled();

    act(() => mocks.sendFile.mock.calls[0][1].onSuccess());
    expect(onAttachmentChange).toHaveBeenLastCalledWith(null);
    expect(onSent).toHaveBeenCalled();
  });

  it('anexo sem legenda envia sem caption e sem forçar o tipo', () => {
    setup({ attachment: { file: png, asDocument: false } });
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    expect(mocks.sendFile).toHaveBeenCalledWith(
      { connectionId: 'conn-1', phone: PHONE, file: png, caption: undefined, type: undefined },
      expect.anything(),
    );
  });

  it('o preview mostra o nome e permite remover', () => {
    const { onAttachmentChange } = setup({ attachment: { file: png, asDocument: true } });
    expect(screen.getByText('foto.png')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'removeAttachment' }));
    expect(onAttachmentChange).toHaveBeenCalledWith(null);
  });
});

describe('MessageComposer — voz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.voiceSupported = true;
  });

  it('com campo vazio mostra o microfone no lugar do enviar', () => {
    setup();
    expect(screen.getByRole('button', { name: 'recordVoice' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'send' })).not.toBeInTheDocument();
  });

  it('ao digitar, volta o botão de enviar', () => {
    setup();
    fireEvent.change(textbox(), { target: { value: 'a' } });
    expect(screen.queryByRole('button', { name: 'recordVoice' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'send' })).toBeEnabled();
  });

  it('provider que não aceita gravação (Meta) não oferece o microfone', () => {
    setup({ capabilities: caps({ provider: 'META', voiceRecording: false }) });
    expect(screen.queryByRole('button', { name: 'recordVoice' })).not.toBeInTheDocument();
  });

  it('navegador sem MediaRecorder não oferece o microfone', () => {
    mocks.voiceSupported = false;
    setup();
    expect(screen.queryByRole('button', { name: 'recordVoice' })).not.toBeInTheDocument();
  });
});

describe('MessageComposer — template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const openTemplate = () => {
    fireEvent.keyDown(screen.getByRole('button', { name: 'attach' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: /template/ }));
  };

  it('envia o template e NÃO dispara o envio do texto digitado (submit do dialog não borbulha)', () => {
    setup();
    fireEvent.change(textbox(), { target: { value: 'rascunho' } });
    openTemplate();

    fireEvent.click(screen.getByRole('combobox', { name: 'pickTemplate' }));
    fireEvent.click(screen.getByRole('option', { name: 'boas_vindas (pt-BR)' }));
    fireEvent.change(screen.getByLabelText('first_name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    expect(mocks.sendText).toHaveBeenCalledTimes(1);
    expect(mocks.sendText.mock.calls[0][0]).toEqual({
      connectionId: 'conn-1',
      phone: PHONE,
      type: 'TEMPLATE',
      templateId: 'tpl-1',
      values: { first_name: 'Ana' },
    });
  });

  it('o menu só oferece o que o provider anuncia', () => {
    setup({ capabilities: caps({ messageTypes: ['TEXT'] }) });
    expect(screen.getByRole('button', { name: 'attach' })).toBeDisabled();
  });
});

describe('MessageComposer — presença (digitando)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.voiceSupported = true;
  });

  it('digitar avisa COMPOSING; chamadas seguidas (dentro da cadência) não repetem', () => {
    setup();
    fireEvent.change(textbox(), { target: { value: 'o' } });
    fireEvent.change(textbox(), { target: { value: 'oi' } });

    expect(mocks.sendPresence).toHaveBeenCalledTimes(1);
    expect(mocks.sendPresence).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      phone: PHONE,
      state: 'COMPOSING',
    });
  });

  it('limpar o campo avisa PAUSED', () => {
    setup();
    fireEvent.change(textbox(), { target: { value: 'oi' } });
    fireEvent.change(textbox(), { target: { value: '' } });

    expect(mocks.sendPresence).toHaveBeenLastCalledWith({
      connectionId: 'conn-1',
      phone: PHONE,
      state: 'PAUSED',
    });
  });

  it('enviar a mensagem avisa PAUSED', () => {
    setup();
    fireEvent.change(textbox(), { target: { value: 'oi' } });
    fireEvent.keyDown(textbox(), { key: 'Enter' });
    act(() => mocks.sendText.mock.calls[0][1].onSuccess());

    expect(mocks.sendPresence).toHaveBeenLastCalledWith({
      connectionId: 'conn-1',
      phone: PHONE,
      state: 'PAUSED',
    });
  });

  // capability desligada (Meta, ou Go antes do §4a/b): a tela não quebra, só não avisa.
  it('provider sem a capability de digitando nunca avisa', () => {
    setup({ capabilities: caps({ typing: { inbound: false, outbound: false } }) });
    fireEvent.change(textbox(), { target: { value: 'oi' } });
    expect(mocks.sendPresence).not.toHaveBeenCalled();
  });
});

describe('MessageComposer — fora da janela de atendimento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trava o campo de texto e o envio; o template segue disponível', () => {
    setup({ outsideServiceWindow: true });
    expect(textbox()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'send' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'attach' })).toBeEnabled();
  });
});

describe('MessageComposer — gravação ativa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.voiceSupported = true;
    mocks.recording = false;
    mocks.recorderSeconds = 0;
  });

  it('ao clicar no microfone, inicia a gravação', async () => {
    mocks.recorderStart.mockResolvedValue(undefined);
    setup();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'recordVoice' }));
    });

    expect(mocks.recorderStart).toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('se start() falhar (permissão negada), avisa micDenied', async () => {
    mocks.recorderStart.mockRejectedValue(new Error('denied'));
    setup();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'recordVoice' }));
    });

    expect(mocks.toastError).toHaveBeenCalledWith('micDenied');
  });

  it('enquanto grava, troca o composer pela RecordingBar', () => {
    mocks.recording = true;
    mocks.recorderSeconds = 65;
    setup();

    expect(screen.getByRole('status', { name: 'recording' })).toBeInTheDocument();
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'messageText' })).not.toBeInTheDocument();
  });

  it('cancelar na RecordingBar aciona recorder.cancel', () => {
    mocks.recording = true;
    setup();

    fireEvent.click(screen.getByLabelText('cancelRecording'));

    expect(mocks.recorderCancel).toHaveBeenCalled();
  });

  it('enviar na RecordingBar para e envia o áudio gravado', async () => {
    mocks.recording = true;
    const audio = new File(['x'], 'audio.webm', { type: 'audio/webm' });
    mocks.recorderStop.mockResolvedValue(audio);
    const { onSent } = setup();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('sendVoice'));
    });

    expect(mocks.sendFile).toHaveBeenCalledWith(
      { connectionId: 'conn-1', phone: PHONE, file: audio, type: 'AUDIO' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    act(() => mocks.sendFile.mock.calls[0][1].onSuccess());
    expect(onSent).toHaveBeenCalled();
  });

  it('se stop() não devolver arquivo (gravação vazia), não envia nada', async () => {
    mocks.recording = true;
    mocks.recorderStop.mockResolvedValue(undefined);
    setup();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('sendVoice'));
    });

    expect(mocks.sendFile).not.toHaveBeenCalled();
  });
});
