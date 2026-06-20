import type { PropsWithChildren } from 'react'

import { Header } from '@/components/Header'
import { LanguageGate } from '@/components/LanguageGate'
import { useI18n } from '@/i18n/I18nProvider'

import styles from './AppShell.module.scss'

export function AppShell({ children }: PropsWithChildren) {
  const { hasSelectedLanguage } = useI18n()

  if (!hasSelectedLanguage) {
    return <LanguageGate />
  }

  return (
    <div className={styles.shell}>
      <Header />
      <div className={styles.body}>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}
