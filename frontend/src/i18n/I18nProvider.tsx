import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import {
  defaultLanguage,
  isLanguageCode,
  languageStorageKey,
  type LanguageCode,
} from '@/i18n/languages'
import { translations, type TranslationCopy } from '@/i18n/translations'

interface I18nContextValue {
  copy: TranslationCopy
  hasSelectedLanguage: boolean
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

function readInitialLanguage() {
  if (typeof window === 'undefined') {
    return {
      hasSelectedLanguage: false,
      language: defaultLanguage,
    }
  }

  const storedLanguage = window.sessionStorage.getItem(languageStorageKey)

  return {
    hasSelectedLanguage: isLanguageCode(storedLanguage),
    language: isLanguageCode(storedLanguage) ? storedLanguage : defaultLanguage,
  }
}

export function I18nProvider({ children }: PropsWithChildren) {
  const initialLanguage = useMemo(readInitialLanguage, [])
  const [language, setLanguageState] = useState<LanguageCode>(initialLanguage.language)
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(initialLanguage.hasSelectedLanguage)

  const setLanguage = useCallback((nextLanguage: LanguageCode) => {
    window.sessionStorage.setItem(languageStorageKey, nextLanguage)
    setLanguageState(nextLanguage)
    setHasSelectedLanguage(true)
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<I18nContextValue>(
    () => ({
      copy: translations[language],
      hasSelectedLanguage,
      language,
      setLanguage,
    }),
    [hasSelectedLanguage, language, setLanguage],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }

  return context
}
