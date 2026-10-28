'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useSidebar } from '@/components/ui/sidebar';
import { ErrorState } from '@/components/ui/error-state';
import { APINEXT } from '@/lib/api/apiNext';
import { cn } from '@/lib/cn';
import i18n from '../../../../../i18n';
import { CmsSkeleton } from './components/cms-skeleton';

/** O Payload usa `pt`; o app usa `pt-BR`. */
const toPayloadLocale = (language: string) => (language === 'pt-BR' ? 'pt' : language);

/** Reflete a rota atual do Payload (dentro do iframe) na URL do navegador. */
function syncRouteFromPayload(payloadPath: string) {
  const newUrl =
    payloadPath && payloadPath !== '/admin' && payloadPath !== '/admin/'
      ? `/cms?path=${encodeURIComponent(payloadPath)}`
      : '/cms';

  const currentUrl = window.location.pathname + window.location.search;
  if (currentUrl !== newUrl) {
    window.history.replaceState(null, '', newUrl);
  }
}

export default function CMS() {
  const searchParams = useSearchParams();
  const rawPath = searchParams.get('path');
  const initialAdminPath = rawPath && rawPath.startsWith('/admin') ? rawPath : '/admin';

  const [authReady, setAuthReady] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  // Incrementar re-dispara o efeito de autenticação — é o botão "tentar novamente".
  const [attempt, setAttempt] = useState(0);
  const [frameReady, setFrameReady] = useState(false);
  const { setOpen } = useSidebar();
  const { theme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // O iframe só pode montar depois deste POST: é ele que grava o cookie de sessão do
  // Payload. Montar antes carregaria a tela de login do /admin dentro do iframe.
  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      try {
        await APINEXT.POST('/auth/cms');
        if (!cancelled) setAuthReady(true);
      } catch {
        // Sem isto o skeleton ficaria girando para sempre quando o login falha.
        if (!cancelled) setAuthFailed(true);
      }
    }

    // O admin do Payload já tem a própria navegação; duas sidebars competindo é ruído.
    setOpen(false);
    authenticate();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const syncPreferences = useCallback(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;

    if (theme) {
      frame.postMessage({ type: 'theme-change', theme }, window.location.origin);
    }
    frame.postMessage(
      { type: 'locale-change', locale: toPayloadLocale(i18n.language) },
      window.location.origin,
    );
  }, [theme]);

  // Só a partir do `load`: antes disso o listener do lado do Payload ainda não existe e a
  // mensagem se perde — era o que o setTimeout de 100ms tentava cobrir por tentativa e erro.
  useEffect(() => {
    if (frameReady) syncPreferences();
  }, [frameReady, syncPreferences]);

  useEffect(() => {
    // O Payload pede o tema quando monta, caso a mensagem tenha chegado antes dele.
    const handleRequest = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'request-theme' || event.data?.type === 'request-locale') {
        syncPreferences();
      }

      // Sincroniza a URL do navegador com a rota atual do Payload no iframe
      if (event.data?.type === 'cms-route-change' && typeof event.data.path === 'string') {
        syncRouteFromPayload(event.data.path);
      }
    };
    const handleLanguageChanged = () => syncPreferences();

    window.addEventListener('message', handleRequest);
    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      window.removeEventListener('message', handleRequest);
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [syncPreferences]);

  if (authFailed) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <ErrorState
          onRetry={() => {
            setAuthFailed(false);
            setAttempt((value) => value + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Montado assim que a sessão existe, mas invisível: é estando no DOM que ele baixa o
          bundle do Payload. Esperar o `load` para montar dobraria o tempo de tela vazia. */}
      {authReady && (
        <iframe
          ref={iframeRef}
          src={initialAdminPath}
          title="Payload CMS"
          onLoad={() => setFrameReady(true)}
          className={cn('h-full w-full border-0', !frameReady && 'invisible')}
        />
      )}
      {!frameReady && <CmsSkeleton />}
    </div>
  );
}
