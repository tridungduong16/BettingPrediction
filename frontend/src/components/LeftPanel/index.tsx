import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'

import { ROUTES } from '@/constants/routes'

import styles from './LeftPanel.module.scss'

type NavigationItem = {
  to: string
  icon: LucideIcon
  id: 'matches' | 'predictionAnalysis'
  label: string
}

const navigationItems: NavigationItem[] = [
  {
    to: ROUTES.HOME,
    icon: CalendarDays,
    id: 'matches',
    label: 'Trận đấu',
  },
  {
    to: ROUTES.PREDICTION_ANALYSIS,
    icon: Sparkles,
    id: 'predictionAnalysis',
    label: 'Phân tích & dự đoán',
  },
]

interface LeftPanelProps {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

function getActiveSection(pathname: string): NavigationItem['id'] {
  if (typeof window === 'undefined') {
    return 'matches'
  }

  if (pathname === ROUTES.PREDICTION_ANALYSIS) {
    return 'predictionAnalysis'
  }

  return 'matches'
}

export function LeftPanel({ collapsed, onCollapsedChange }: LeftPanelProps) {
  const location = useLocation()
  const [activeSection, setActiveSection] = useState<NavigationItem['id']>(() =>
    getActiveSection(location.pathname),
  )
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  useEffect(() => {
    const syncActiveSection = () => {
      setActiveSection(getActiveSection(location.pathname))
    }

    syncActiveSection()
    window.addEventListener('hashchange', syncActiveSection)

    return () => {
      window.removeEventListener('hashchange', syncActiveSection)
    }
  }, [location.pathname])

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
          const isActive = activeSection === item.id

          return (
            <Link
              key={item.id}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={clsx(styles.item, isActive && styles.active)}
              to={item.to}
              onClick={() => setActiveSection(item.id)}
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
