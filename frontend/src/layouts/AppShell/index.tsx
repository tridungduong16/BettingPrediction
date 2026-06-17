import { useState, type PropsWithChildren } from 'react'
import clsx from 'clsx'

import { Header } from '@/components/Header'
import { LanguageGate } from '@/components/LanguageGate'
import { LeftPanel } from '@/components/LeftPanel'
import { useI18n } from '@/i18n/I18nProvider'

import styles from './AppShell.module.scss'

export function AppShell({ children }: PropsWithChildren) {
  const { hasSelectedLanguage } = useI18n()
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)

  if (!hasSelectedLanguage) {
    return <LanguageGate />
  }

  return (
    <div className={styles.shell}>
      <Header />
      <div className={clsx(styles.body, isLeftPanelCollapsed && styles.collapsed)}>
        <LeftPanel collapsed={isLeftPanelCollapsed} onCollapsedChange={setIsLeftPanelCollapsed} />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}
