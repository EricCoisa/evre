/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import React from 'react'

import { importMap } from './admin/importMap.js'
// ARCHITECTURE: Use custom-refactored.scss (com design tokens)
// ou custom.scss (versão antiga)
import './custom-refactored.scss'

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            if (typeof window === 'undefined') return;
            
            // Sincronização de tema e idioma via postMessage do parent
            window.addEventListener('message', function(event) {
              if (event.origin !== window.location.origin) return;
              
              if (event.data?.type === 'theme-change') {
                var theme = event.data.theme;
                if (theme === 'dark') {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.setAttribute('data-theme', 'light');
                  document.documentElement.classList.remove('dark');
                }
              }
              
              // Safety net: seta o cookie payload-lng imediatamente
              // O componente React (PayloadLanguageSync) fará o refresh suave
              if (event.data?.type === 'locale-change') {
                var locale = event.data.locale;
                if (locale) {
                  document.cookie = 'payload-lng=' + locale + '; path=/; max-age=31536000; SameSite=Lax';
                }
              }
            });
            
            // A nav só ganha transição depois do estado inicial assentar (regra html.nav-ready).
            function releaseNavTransition() {
              requestAnimationFrame(function () {
                document.documentElement.classList.add('nav-ready');
              });
            }

            // 1. O Payload NUNCA deve ser acessado sozinho fora da nossa página /cms.
            // Se aberto diretamente (window.parent === window), redireciona imediatamente para /cms.
            if (window.parent === window) {
              var target = '/cms';
              var current = window.location.pathname + window.location.search + window.location.hash;
              if (current && current !== '/admin' && current !== '/admin/') {
                target += '?path=' + encodeURIComponent(current);
              }
              window.location.replace(target);
              return;
            }

            // 2. Intercepta cliques dentro do iframe: links internos de /admin não devem abrir em nova aba (_blank).
            document.addEventListener('click', function(e) {
              var el = e.target;
              while (el && el.tagName !== 'A') {
                el = el.parentElement;
              }
              if (!el || !el.href) return;
              try {
                var url = new URL(el.href, window.location.origin);
                if (url.origin === window.location.origin && url.pathname.startsWith('/admin')) {
                  if (el.target === '_blank') {
                    el.target = '_self';
                  }
                }
              } catch (err) {}
            }, true);

            // 3. Intercepta window.open dentro do iframe para rotas internas de /admin
            var origOpen = window.open;
            window.open = function(url, target, features) {
              if (typeof url === 'string') {
                try {
                  var resolved = new URL(url, window.location.origin);
                  if (resolved.origin === window.location.origin && resolved.pathname.startsWith('/admin')) {
                    window.location.href = resolved.href;
                    return window;
                  }
                } catch (err) {}
              }
              return origOpen.apply(window, arguments);
            };

            // 4. Notifica a página pai (/cms) quando a rota interna do Payload mudar
            function notifyParentPath() {
              try {
                var currentPath = window.location.pathname + window.location.search;
                window.parent.postMessage({
                  type: 'cms-route-change',
                  path: currentPath
                }, window.location.origin);
              } catch (err) {}
            }

            notifyParentPath();
            var origPushState = history.pushState;
            var origReplaceState = history.replaceState;
            history.pushState = function() {
              var res = origPushState.apply(this, arguments);
              notifyParentPath();
              return res;
            };
            history.replaceState = function() {
              var res = origReplaceState.apply(this, arguments);
              notifyParentPath();
              return res;
            };
            window.addEventListener('popstate', notifyParentPath);

            // 5. Comunicação inicial com a página pai
            window.parent.postMessage({ type: 'request-theme' }, window.location.origin);

            // Reabre a nav do Payload uma vez: dentro do iframe ele a trata como modal pela largura medida.
            var framesLeft = 300; // ~5s; a tela de login do /admin não tem nav, aí desiste.
            (function openNavByDefault() {
              if (framesLeft-- <= 0) {
                releaseNavTransition();
                return;
              }

              var nav = document.querySelector('aside.nav');
              if (!nav || nav.className.indexOf('nav--nav-hydrated') === -1) {
                requestAnimationFrame(openNavByDefault);
                return;
              }

              if (nav.className.indexOf('nav--nav-open') === -1) {
                var toggler = document.querySelector('button.nav-toggler');
                if (toggler) toggler.click();
              }
              releaseNavTransition();
            })();
          })();
        `,
      }}
    />
    {children}
  </RootLayout>
)

export default Layout
