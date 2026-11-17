import { useEffect, useState } from 'react'

export type Lang = 'en' | 'es'

const STORAGE_KEY = 'syncseinen_lang'
const EVENT_NAME = 'syncseinen-lang-change'

export function getLang(): Lang {
  try {
    const val = window.localStorage?.getItem(STORAGE_KEY)
    if (val === 'es' || val === 'en') return val
  } catch {
    // ignore
  }
  return 'en'
}

export function setLang(next: Lang): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, next)
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }))
}

export function useLang(): [Lang, (next: Lang) => void, (en: string, es: string) => string] {
  const [lang, setLangState] = useState<Lang>(getLang)

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<Lang>)?.detail
      setLangState(detail === 'es' || detail === 'en' ? detail : getLang())
    }
    window.addEventListener(EVENT_NAME, handler)
    return () => window.removeEventListener(EVENT_NAME, handler)
  }, [])

  const updateLang = (next: Lang) => {
    setLang(next)
    setLangState(next)
  }

  const tr = (en: string, es: string) => (lang === 'es' ? es : en)

  return [lang, updateLang, tr]
}
