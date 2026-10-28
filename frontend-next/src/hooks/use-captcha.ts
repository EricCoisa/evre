"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CaptchaConfigDto } from "@/lib/generated/schemas";

/** Hook de widget de captcha, agnóstico de provider (Turnstile, hCaptcha, reCAPTCHA v3). */

interface CaptchaApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
}

interface GrecaptchaApi {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, opts: { action: string }) => Promise<string>;
}

declare global {
  interface Window {
    turnstile?: CaptchaApi;
    hcaptcha?: CaptchaApi;
    grecaptcha?: GrecaptchaApi;
  }
}

/** Cache de um `<script>` por URL, compartilhado por todos os formulários da sessão. */
const scriptPromises = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const cached = scriptPromises.get(src);
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Falhou o download: solta o cache para a próxima montagem tentar de novo.
      scriptPromises.delete(src);
      reject(new Error(`Falha ao carregar ${src}`));
    };
    document.head.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

/** Turnstile e hCaptcha expõem a mesma superfície — só muda o objeto global. */
function widgetApi(
  provider: string | null | undefined,
): CaptchaApi | undefined {
  if (provider === "TURNSTILE") return window.turnstile;
  if (provider === "HCAPTCHA") return window.hcaptcha;
  return undefined;
}

/** Sem isto, uma site key errada deixaria a tela de configuração pendurada. */
const PROBE_TIMEOUT_MS = 30000;

/** Credenciais ad-hoc para a sonda; `scriptUrl` vem de `GET /captcha/providers`. */
export interface CaptchaProbe {
  provider: string;
  siteKey: string;
  scriptUrl: string;
}

/** Resolve um token de captcha com credenciais ad-hoc, fora da configuração salva. */
export async function requestCaptchaToken(
  { provider, siteKey, scriptUrl }: CaptchaProbe,
  container: HTMLElement,
): Promise<string> {
  // A v3 quer o site key na própria URL do script; os outros dois ignoram.
  await loadScript(
    provider === "RECAPTCHA_V3"
      ? `${scriptUrl}${encodeURIComponent(siteKey)}`
      : scriptUrl,
  );

  if (provider === "RECAPTCHA_V3") {
    const grecaptcha = window.grecaptcha;
    if (!grecaptcha) throw new Error("reCAPTCHA não carregou");
    await new Promise<void>((resolve) => grecaptcha.ready(resolve));
    return grecaptcha.execute(siteKey, { action: "config" });
  }

  const api = widgetApi(provider);
  if (!api) throw new Error("Widget de captcha não carregou");

  container.innerHTML = "";

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Tempo esgotado aguardando o captcha")),
      PROBE_TIMEOUT_MS,
    );
    const settle = (fn: () => void) => {
      clearTimeout(timer);
      fn();
    };

    try {
      api.render(container, {
        sitekey: siteKey,
        callback: (token) => settle(() => resolve(token)),
        "error-callback": () =>
          settle(() => reject(new Error("Site key recusada pelo provider"))),
        "expired-callback": () =>
          settle(() => reject(new Error("O desafio expirou"))),
      });
    } catch (err) {
      // Turnstile/hCaptcha lançam sincronamente quando a sitekey é malformada.
      settle(() => reject(err as Error));
    }
  });
}

export interface CaptchaTokenControl {
  /** Token de uso único para mandar no header. `null` quando ainda não resolvido. */
  getToken: () => Promise<string | null>;
  /** Falso quando o captcha está desligado — o formulário não deve exigir token. */
  enabled: boolean;
}

export interface UseCaptcha extends CaptchaTokenControl {
  /** Prenda num `<div>` do formulário. Vazio quando o provider é invisível. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useCaptcha(config?: CaptchaConfigDto | null): UseCaptcha {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tokenRef = useRef<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const enabled = Boolean(
    config?.enabled && config.siteKey && config.scriptUrl,
  );
  const provider = config?.provider;
  const siteKey = config?.siteKey;
  const scriptUrl = config?.scriptUrl;

  useEffect(() => {
    if (!enabled || !scriptUrl || !siteKey) return;

    let cancelled = false;

    loadScript(scriptUrl)
      .then(() => {
        // O v3 não desenha widget: o token só nasce no submit, via execute().
        if (cancelled || provider === "RECAPTCHA_V3") return;

        const api = widgetApi(provider);
        if (!api || !containerRef.current) return;

        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            tokenRef.current = token;
          },
          // Token do widget expira sozinho (~2min). Sem zerar aqui, o submit
          // seguinte mandaria um token morto e o backend devolveria 403.
          "expired-callback": () => {
            tokenRef.current = null;
          },
          "error-callback": () => {
            tokenRef.current = null;
          },
        });
      })
      .catch(() => {
        // O envio permanece bloqueado até que exista um token válido.
        tokenRef.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, provider, siteKey, scriptUrl]);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!enabled || !siteKey) return null;

    if (provider === "RECAPTCHA_V3") {
      const grecaptcha = window.grecaptcha;
      if (!grecaptcha) return null;
      // `ready` garante que o script terminou de inicializar antes do execute.
      await new Promise<void>((resolve) => grecaptcha.ready(resolve));
      return grecaptcha.execute(siteKey, { action: "submit" });
    }

    const token = tokenRef.current;
    // Token é de uso único: zera e pede outro, senão um segundo submit (erro de
    // senha, por exemplo) reenviaria o mesmo token e levaria 403.
    tokenRef.current = null;
    if (token) widgetApi(provider)?.reset(widgetIdRef.current ?? undefined);
    return token;
  }, [enabled, provider, siteKey]);

  return { containerRef, getToken, enabled };
}
