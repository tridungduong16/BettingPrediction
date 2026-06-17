import { Check, Languages } from 'lucide-react'

import { supportedLanguages } from '@/i18n/languages'
import { useI18n } from '@/i18n/I18nProvider'

import styles from './LanguageGate.module.scss'

export function LanguageGate() {
  const { setLanguage } = useI18n()

  return (
    <main className={styles.gate} aria-labelledby="language-gate-title">
      <section className={styles.panel}>
        <div className={styles.brand}>
          <img src="/brand/worldian-logo.png" alt="" aria-hidden="true" />
          <span>WORLDIAN</span>
        </div>

        <div className={styles.heading}>
          <span>
            <Languages size={17} aria-hidden="true" />
            Language / Ngôn ngữ
          </span>
          <h1 id="language-gate-title">Choose your language</h1>
          <p>Chọn English hoặc Tiếng Việt để toàn bộ trang, prompt và phản hồi Worldian dùng đúng ngôn ngữ.</p>
        </div>

        <div className={styles.options} role="list" aria-label="Language options">
          {supportedLanguages.map((language) => (
            <button key={language.code} type="button" onClick={() => setLanguage(language.code)}>
              <span>{language.label}</span>
              <Check size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
