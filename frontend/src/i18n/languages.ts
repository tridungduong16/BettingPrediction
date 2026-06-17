export type LanguageCode = 'en' | 'vi'

export const defaultLanguage: LanguageCode = 'vi'
export const languageStorageKey = 'worldian-language'

export const supportedLanguages: Array<{
  code: LanguageCode
  label: string
  shortLabel: string
}> = [
  { code: 'vi', label: 'Tiếng Việt', shortLabel: 'VI' },
  { code: 'en', label: 'English', shortLabel: 'EN' },
]

export function isLanguageCode(value: unknown): value is LanguageCode {
  return value === 'en' || value === 'vi'
}

export function localeForLanguage(language: LanguageCode) {
  return language === 'vi' ? 'vi-VN' : 'en-US'
}
