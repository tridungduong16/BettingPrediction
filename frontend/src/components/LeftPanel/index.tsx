import { Link } from 'react-router-dom'
import {
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'

import { ROUTES } from '@/constants/routes'
import { useI18n } from '@/i18n/I18nProvider'

import styles from './LeftPanel.module.scss'

type NavigationItem = {
  to: string
  icon: LucideIcon
  id: 'matches'
}

const navigationItems: NavigationItem[] = [
  {
    to: ROUTES.HOME,
    icon: CalendarDays,
    id: 'matches',
  },
]

interface LeftPanelProps {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

export function LeftPanel({ collapsed, onCollapsedChange }: LeftPanelProps) {
  const { copy } = useI18n()
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <aside className={clsx(styles.panel, collapsed && styles.collapsed)} aria-label={copy.common.menu}>
      <div className={styles.panelTop}>
        <span className={styles.title}>{copy.common.menu}</span>
        <button
          aria-expanded={!collapsed}
          aria-label={collapsed ? copy.common.openMenu : copy.common.collapseMenu}
          className={styles.toggleButton}
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <ToggleIcon size={18} aria-hidden="true" />
        </button>
      </div>
      <nav className={styles.nav}>
        {navigationItems.map((item) => {
          const Icon = item.icon
          const label = copy.common.matches

          return (
            <Link
              key={item.id}
              aria-current="page"
              aria-label={label}
              className={clsx(styles.item, styles.active)}
              to={item.to}
              title={collapsed ? label : undefined}
            >
              <span className={styles.icon} aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className={styles.label}>{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
