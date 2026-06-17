import { Bell, Radio } from 'lucide-react'

import { supportedLanguages } from '@/i18n/languages'
import { useI18n } from '@/i18n/I18nProvider'

import styles from './Header.module.scss'

function Brand({ ariaLabel, className }: { ariaLabel: string; className?: string }) {
  return (
    <a className={[styles.brand, className].filter(Boolean).join(' ')} aria-label={ariaLabel} href="/">
      <span className={styles.brandIcon}>
        <img src="/brand/worldian-logo.png" alt="" aria-hidden="true" />
      </span>
      <span className={styles.brandText}>WORLDIAN</span>
    </a>
  )
}

export function Header() {
  const { copy, language, setLanguage } = useI18n()

  function handleGoogleSignIn() {
    // TODO: Connect this to the Google client once OAuth config is available.
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Brand ariaLabel={copy.common.appHomeAria} className={styles.mobileBrand} />

        <div className={styles.centerBrand}>
          <Brand ariaLabel={copy.common.appHomeAria} className={styles.navBrand} />
        </div>

        <div className={styles.actions}>
          <button className={styles.googleButton} type="button" onClick={handleGoogleSignIn}>
            <span className={styles.googleMark} aria-hidden="true">
              G
            </span>
            <span>{copy.header.signInWithGoogle}</span>
          </button>
          <span className={styles.livePill}>
            <Radio size={13} aria-hidden="true" />
            {copy.common.live}
          </span>
          <div className={styles.languageSwitch} aria-label={copy.header.languageLabel}>
            {supportedLanguages.map((item) => (
              <button
                key={item.code}
                aria-pressed={language === item.code}
                className={language === item.code ? styles.activeLanguage : undefined}
                type="button"
                onClick={() => setLanguage(item.code)}
              >
                {item.shortLabel}
              </button>
            ))}
          </div>
          <button className={styles.iconButton} type="button" aria-label={copy.common.notifications}>
            <Bell size={21} aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <button className={styles.avatarButton} type="button" aria-label={copy.common.openProfile}>
            M
          </button>
        </div>
      </div>
    </header>
  )
}
