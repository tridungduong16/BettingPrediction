import type { PropsWithChildren } from 'react'

import { Header } from '@/components/Header'

import styles from './AppShell.module.scss'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
