'use client';

import { useRef, useState } from 'react';
import { Mic, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RichTextInput } from '@/components/rich-text-input';
import { isVoiceRecordingSupported, useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useTranslation } from '@/hooks/use-translation';
import { useSendAttachment, useSendMessage, useSendPresence } from '@/lib/actions/messaging/queries';
import type { MessagingCapabilities } from '@/lib/actions/messaging/types';
import { SendMessageDtoType } from '@/lib/generated/schemas';
import { composerAbilities } from '@/lib/messaging/capabilities';
import { MAX_ATTACHMENT_BYTES } from '@/lib/messaging/media';
import { AttachMenu } from './attach-menu';
import { AttachmentPreview, type Attachment } from './attachment-preview';
import { MessageTemplateDialog } from './message-template-dialog';
import { RecordingBar } from './recording-bar';

export type { Attachment };

/** Cadência mínima entre dois avisos de "digitando" — o WhatsApp renova o indicador a cada chamada. */
const TYPING_RESEND_MS = 5000;

/** Validação única para qualquer porta de entrada (menu, colar, arrastar). `null` = recusado. */
export function toAttachment(
  file: File | undefined,
  asDocument: boolean,
  onTooLarge: () => void,
): Attachment | null {
  if (!file) return null;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    onTooLarge();
    return null;
  }
  return { file, asDocument };
}

interface MessageComposerProps {
  connectionId: string;
  phone: string;
  capabilities: MessagingCapabilities | undefined;
  operational: boolean;
  attachment: Attachment | null;
  onAttachmentChange: (attachment: Attachment | null) => void;
  onSent: () => void;
  /** Fora da janela de atendimento do provider: só template envia. */
  outsideServiceWindow?: boolean;
}

function useMessageComposerTyping({
  canNotifyTyping,
  connectionId,
  phone,
}: {
  canNotifyTyping: boolean;
  connectionId: string;
  phone: string;
}) {
  const presence = useSendPresence();
  const typing = useRef({ lastSentAt: 0, active: false });

  const stopTyping = () => {
    if (!typing.current.active) return;
    typing.current.active = false;
    presence.mutate({ connectionId, phone, state: 'PAUSED' });
  };

  const notifyTyping = () => {
    if (!canNotifyTyping) return;
    const now = Date.now();
    if (now - typing.current.lastSentAt < TYPING_RESEND_MS) return;
    typing.current.lastSentAt = now;
    typing.current.active = true;
    presence.mutate({ connectionId, phone, state: 'COMPOSING' });
  };

  return { notifyTyping, stopTyping };
}

function checkCanSend({
  enabled,
  outsideServiceWindow,
  busy,
  hasAttachment,
  trimmedLength,
  allowsText,
}: {
  enabled: boolean;
  outsideServiceWindow: boolean;
  busy: boolean;
  hasAttachment: boolean;
  trimmedLength: number;
  allowsText: boolean;
}) {
  if (!enabled || outsideServiceWindow || busy) return false;
  return hasAttachment || (trimmedLength > 0 && allowsText);
}

function ComposerSendButton({
  showMic,
  canSend,
  onRecord,
  t,
}: {
  showMic: boolean;
  canSend: boolean;
  onRecord: () => void;
  t: (key: string) => string;
}) {
  if (showMic) {
    return (
      <Button type="button" size="icon" variant="ghost" aria-label={t('recordVoice')} onClick={onRecord}>
        <Mic />
      </Button>
    );
  }
  return (
    <Button type="submit" size="icon" aria-label={t('send')} title={t('send')} disabled={!canSend}>
      <Send />
    </Button>
  );
}

function useMessageComposerActions({
  connectionId,
  phone,
  canSend,
  attachment,
  trimmed,
  setText,
  onAttachmentChange,
  onSent,
  stopTyping,
  recorder,
  send,
  sendFile,
  t,
}: {
  connectionId: string;
  phone: string;
  canSend: boolean;
  attachment: Attachment | null;
  trimmed: string;
  setText: (s: string) => void;
  onAttachmentChange: (a: Attachment | null) => void;
  onSent: () => void;
  stopTyping: () => void;
  recorder: ReturnType<typeof useVoiceRecorder>;
  send: ReturnType<typeof useSendMessage>;
  sendFile: ReturnType<typeof useSendAttachment>;
  t: (k: string) => string;
}) {
  const sent = () => {
    setText('');
    stopTyping();
    onAttachmentChange(null);
    onSent();
  };

  const submit = () => {
    if (!canSend) return;
    if (!attachment) {
      send.mutate({ connectionId, phone, type: SendMessageDtoType.TEXT, text: trimmed }, { onSuccess: sent });
      return;
    }
    sendFile.mutate(
      {
        connectionId,
        phone,
        file: attachment.file,
        caption: trimmed || undefined,
        type: attachment.asDocument ? 'DOCUMENT' : undefined,
      },
      { onSuccess: sent },
    );
  };

  const startRecording = async () => {
    try {
      await recorder.start();
    } catch {
      toast.error(t('micDenied'));
    }
  };

  const sendRecording = async () => {
    const file = await recorder.stop();
    if (file) sendFile.mutate({ connectionId, phone, file, type: 'AUDIO' }, { onSuccess: onSent });
  };

  return { submit, startRecording, sendRecording };
}

function useMessageComposerShortcuts({
  enabled,
  outsideServiceWindow,
  submit,
  pick,
}: {
  enabled: boolean;
  outsideServiceWindow: boolean;
  submit: () => void;
  pick: (file: File | undefined, asDocument: boolean) => void;
}) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const file = event.clipboardData.files[0];
    if (!file || !enabled || outsideServiceWindow) return;
    event.preventDefault();
    pick(file, false);
  };

  return { onKeyDown, onPaste };
}

function useMessageComposerState(props: MessageComposerProps) {
  const {
    connectionId,
    phone,
    capabilities,
    operational,
    attachment,
    onAttachmentChange,
    onSent,
    outsideServiceWindow = false,
  } = props;
  const { t } = useTranslation('messaging');
  const send = useSendMessage();
  const sendFile = useSendAttachment();
  const recorder = useVoiceRecorder();
  const [text, setText] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);

  const abilities = composerAbilities(capabilities, isVoiceRecordingSupported(), outsideServiceWindow);
  const enabled = operational && Boolean(capabilities);
  const busy = send.isPending || sendFile.isPending;
  const trimmed = text.trim();
  const hasContent = Boolean(attachment) || trimmed.length > 0;
  const canSend = checkCanSend({
    enabled,
    outsideServiceWindow,
    busy,
    hasAttachment: Boolean(attachment),
    trimmedLength: trimmed.length,
    allowsText: abilities.text,
  });

  const { notifyTyping, stopTyping } = useMessageComposerTyping({
    canNotifyTyping: enabled && Boolean(capabilities?.typing.outbound),
    connectionId,
    phone,
  });

  const pick = (file: File | undefined, asDocument: boolean) => {
    const next = toAttachment(file, asDocument, () => toast.error(t('fileTooLarge')));
    if (next) onAttachmentChange(next);
  };

  const { submit, startRecording, sendRecording } = useMessageComposerActions({
    connectionId,
    phone,
    canSend,
    attachment,
    trimmed,
    setText,
    onAttachmentChange,
    onSent,
    stopTyping,
    recorder,
    send,
    sendFile,
    t,
  });

  const { onKeyDown, onPaste } = useMessageComposerShortcuts({
    enabled,
    outsideServiceWindow,
    submit,
    pick,
  });

  return {
    t,
    text,
    setText,
    templateOpen,
    setTemplateOpen,
    abilities,
    enabled,
    busy,
    hasContent,
    canSend,
    submit,
    startRecording,
    sendRecording,
    onKeyDown,
    onPaste,
    pick,
    recorder,
    notifyTyping,
    stopTyping,
    send,
  };
}

function MessageTemplateDialogSection({
  capabilities,
  templateOpen,
  setTemplateOpen,
  connectionId,
  phone,
  send,
  onSent,
}: {
  capabilities: MessageComposerProps['capabilities'];
  templateOpen: boolean;
  setTemplateOpen: (open: boolean) => void;
  connectionId: string;
  phone: string;
  send: ReturnType<typeof useSendMessage>;
  onSent: () => void;
}) {
  if (!capabilities) return null;
  return (
    <MessageTemplateDialog
      open={templateOpen}
      onOpenChange={setTemplateOpen}
      connectionId={connectionId}
      template={capabilities.template}
      pending={send.isPending}
      onSubmit={(draft) =>
        send.mutate(
          { connectionId, phone, type: SendMessageDtoType.TEMPLATE, ...draft },
          {
            onSuccess: () => {
              setTemplateOpen(false);
              onSent();
            },
          },
        )
      }
    />
  );
}

/** Campo de envio: texto (Enter envia, Shift+Enter quebra linha), anexo, voz e template. */
export function MessageComposer(props: MessageComposerProps) {
  const {
    connectionId,
    phone,
    capabilities,
    attachment,
    onAttachmentChange,
    onSent,
    outsideServiceWindow = false,
  } = props;
  const state = useMessageComposerState(props);
  const {
    t,
    text,
    setText,
    templateOpen,
    setTemplateOpen,
    abilities,
    enabled,
    busy,
    hasContent,
    canSend,
    submit,
    startRecording,
    sendRecording,
    onKeyDown,
    onPaste,
    pick,
    recorder,
    notifyTyping,
    stopTyping,
    send,
  } = state;

  if (recorder.recording) {
    return (
      <RecordingBar
        seconds={recorder.seconds}
        busy={busy}
        onCancel={recorder.cancel}
        onSend={() => void sendRecording()}
      />
    );
  }

  const showMic = enabled && abilities.voice && !hasContent;
  const placeholder = attachment ? t('captionPlaceholder') : t('messagePlaceholder');

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="border-t bg-muted/40 p-2"
      >
        {attachment && <AttachmentPreview attachment={attachment} onRemove={() => onAttachmentChange(null)} />}

        <div className="flex items-end gap-1.5">
          <AttachMenu
            canPickDocument={abilities.pickDocument}
            canPickMedia={abilities.pickMedia}
            canTemplate={abilities.template}
            disabled={!enabled}
            onPick={pick}
            onTemplate={() => setTemplateOpen(true)}
          />

          <RichTextInput
            ariaLabel={t('messageText')}
            placeholder={placeholder}
            value={text}
            onChange={(value) => {
              setText(value);
              if (value.trim()) notifyTyping();
              else stopTyping();
            }}
            disabled={!enabled || outsideServiceWindow}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            className="flex-1"
            formatLabels={{
              bold: t('formatBold'),
              italic: t('formatItalic'),
              strikethrough: t('formatStrikethrough'),
              code: t('formatCode'),
            }}
          />

          <ComposerSendButton
            showMic={showMic}
            canSend={canSend}
            onRecord={() => void startRecording()}
            t={t}
          />
        </div>
      </form>

      <MessageTemplateDialogSection
        capabilities={capabilities}
        templateOpen={templateOpen}
        setTemplateOpen={setTemplateOpen}
        connectionId={connectionId}
        phone={phone}
        send={send}
        onSent={onSent}
      />
    </>
  );
}
