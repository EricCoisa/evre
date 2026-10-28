import { useCallback, useEffect, useRef, useState } from 'react';

/** O melhor formato que o navegador sabe gravar; Safari só faz MP4, Firefox OGG, Chrome WebM. */
const PREFERRED_MIME_TYPES = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4'];

function pickMimeType(): string | undefined {
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

const extensionOf = (mimeType: string) => mimeType.split('/')[1]?.split(';')[0] ?? 'webm';

export const isVoiceRecordingSupported = () =>
  typeof window !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia;

/** Grava áudio do microfone, como o botão de voz do WhatsApp Web. */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    recorder.current = null;
    chunks.current = [];
    setRecording(false);
    setSeconds(0);
  }, []);

  // Fechar a janela no meio da gravação não pode deixar o microfone aberto.
  useEffect(() => () => {
    if (recorder.current) recorder.current.onstop = null;
    release();
  }, [release]);

  /** Lança se o usuário negar o microfone — quem chama decide a mensagem. */
  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    const instance = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    instance.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    instance.start();
    recorder.current = instance;
    setRecording(true);
    timer.current = setInterval(() => setSeconds((value) => value + 1), 1000);
  }, []);

  /** Encerra e devolve o áudio gravado. */
  const stop = useCallback(
    () =>
      new Promise<File | null>((resolve) => {
        const instance = recorder.current;
        if (!instance) return resolve(null);
        instance.onstop = () => {
          const type = instance.mimeType || 'audio/webm';
          const file = chunks.current.length
            ? new File(chunks.current, `voice.${extensionOf(type)}`, { type })
            : null;
          release();
          resolve(file);
        };
        instance.stop();
      }),
    [release],
  );

  const cancel = useCallback(() => {
    if (recorder.current) recorder.current.onstop = null;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    release();
  }, [release]);

  return { recording, seconds, start, stop, cancel };
}
