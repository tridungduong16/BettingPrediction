import type { ReactNode } from 'react'

import styles from './SectionHeader.module.scss'

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.copy}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
