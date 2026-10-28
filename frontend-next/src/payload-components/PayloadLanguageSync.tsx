'use client'

import React, { useEffect, useRef } from 'react'
import { useTranslation } from '@payloadcms/ui'
import type { SupportedLanguages } from '@payloadcms/translations'

export default function PayloadLanguageSync({ children }: { children: React.ReactNode }) {
  const { i18n, switchLanguage } = useTranslation()

  // Refs para evitar closures stale no listener
  const switchLanguageRef = useRef(switchLanguage)
  const i18nRef = useRef(i18n)

  // Manter refs atualizados a cada render
  useEffect(() => {
    switchLanguageRef.current = switchLanguage
    i18nRef.current = i18n
  })

  // Listener estável — montado uma vez no root, nunca desmonta
  useEffect(() => {
    if (window.parent === window) return

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'locale-change') return

      const newLocale = event.data.locale as string
      if (!newLocale || newLocale === i18nRef.current.language) return

      if (switchLanguageRef.current) {
        await switchLanguageRef.current(newLocale as keyof SupportedLanguages)
      } else {
        // Cookie já foi setado pelo layout script, só faz reload
        window.location.reload()
      }
    }

    window.addEventListener('message', handleMessage)

    // Pedir idioma atual ao parent (msg inicial pode ter chegado antes do mount)
    window.parent.postMessage({ type: 'request-locale' }, window.location.origin)

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return <>{children}</>
}
