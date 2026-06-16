import { Link } from 'react-router-dom'
import {
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'

import { ROUTES } from '@/constants/routes'

import styles from './LeftPanel.module.scss'

type NavigationItem = {
  to: string
  icon: LucideIcon
  id: 'matches'
  label: string
}

const navigationItems: NavigationItem[] = [
  {
    to: ROUTES.HOME,
    icon: CalendarDays,
    id: 'matches',
    label: 'Trận đấu',
  },
]

interface LeftPanelProps {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

export function LeftPanel({ collapsed, onCollapsedChange }: LeftPanelProps) {
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <aside className={clsx(styles.panel, collapsed && styles.collapsed)} aria-label="Điều hướng chính">
      <div className={styles.panelTop}>
        <span className={styles.title}>Menu</span>
        <button
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Mở menu' : 'Thu gọn menu'}
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

          return (
            <Link
              key={item.id}
              aria-current="page"
              aria-label={item.label}
              className={clsx(styles.item, styles.active)}
              to={item.to}
              title={collapsed ? item.label : undefined}
            >
              <span className={styles.icon} aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
