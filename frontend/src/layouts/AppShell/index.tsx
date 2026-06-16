import { useState, type PropsWithChildren } from 'react'
import clsx from 'clsx'

import { Header } from '@/components/Header'
import { LeftPanel } from '@/components/LeftPanel'

import styles from './AppShell.module.scss'

export function AppShell({ children }: PropsWithChildren) {
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)

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
