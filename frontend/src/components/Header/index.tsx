import { Bell, LogOut, Radio } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { ROUTES } from '@/constants/routes'
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

function avatarInitial(value: string | null | undefined) {
  return value?.trim().charAt(0).toUpperCase() || 'M'
}

export function Header() {
  const { copy, language, setLanguage } = useI18n()
  const { signInWithGoogle, signOut, status, user } = useAuth()
  const isAuthenticated = status === 'authenticated' && Boolean(user)

  function handleGoogleSignIn() {
    signInWithGoogle()
  }

  function handleAvatarClick() {
    if (isAuthenticated) {
      void signOut()
      return
    }

    handleGoogleSignIn()
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Brand ariaLabel={copy.common.appHomeAria} className={styles.mobileBrand} />
        <nav className={styles.primaryNav} aria-label={copy.common.menu}>
          <NavLink className={({ isActive }) => (isActive ? styles.activeNavLink : undefined)} to={ROUTES.HOME}>
            {copy.common.matches}
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? styles.activeNavLink : undefined)}
            to={ROUTES.SIMULATION}
          >
            {copy.common.simulation}
          </NavLink>
        </nav>

        <div className={styles.centerBrand}>
          <Brand ariaLabel={copy.common.appHomeAria} className={styles.navBrand} />
        </div>

        <div className={styles.actions}>
          {!isAuthenticated ? (
            <button
              className={styles.googleButton}
              type="button"
              disabled={status === 'loading'}
              onClick={handleGoogleSignIn}
            >
              <span className={styles.googleMark} aria-hidden="true">
                G
              </span>
              <span>{copy.header.signInWithGoogle}</span>
            </button>
          ) : null}
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
          <button
            className={styles.avatarButton}
            type="button"
            aria-label={isAuthenticated ? copy.header.signOut : copy.common.openProfile}
            title={
              isAuthenticated && user?.email
                ? `${copy.header.signedInAs} ${user.email}`
                : undefined
            }
            onClick={handleAvatarClick}
          >
            {isAuthenticated && user?.picture ? (
              <img src={user.picture} alt="" referrerPolicy="no-referrer" />
            ) : (
              avatarInitial(user?.name ?? user?.email)
            )}
            {isAuthenticated ? (
              <span className={styles.signOutHint} aria-hidden="true">
                <LogOut size={13} />
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  )
}
