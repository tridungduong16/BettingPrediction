import { useState, type PropsWithChildren } from 'react'
import clsx from 'clsx'
import { useLocation } from 'react-router-dom'

import { Header } from '@/components/Header'
import { LanguageGate } from '@/components/LanguageGate'
import { LeftPanel } from '@/components/LeftPanel'
import { ROUTES } from '@/constants/routes'
import { useI18n } from '@/i18n/I18nProvider'

import styles from './AppShell.module.scss'

export function AppShell({ children }: PropsWithChildren) {
  const { hasSelectedLanguage } = useI18n()
  const location = useLocation()
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)
  const hideLeftPanel = location.pathname === ROUTES.HOME

  if (!hasSelectedLanguage) {
    return <LanguageGate />
  }

  return (
    <div className={styles.shell}>
      <Header />
      <div className={clsx(styles.body, hideLeftPanel ? styles.fullWidth : isLeftPanelCollapsed && styles.collapsed)}>
        {hideLeftPanel ? null : (
          <LeftPanel collapsed={isLeftPanelCollapsed} onCollapsedChange={setIsLeftPanelCollapsed} />
        )}
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}
