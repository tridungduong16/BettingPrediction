import { Bell, Radio, Trophy } from 'lucide-react'

import styles from './Header.module.scss'

const navItems = [
  { label: 'Trận đấu', href: '#matches' },
  { label: 'Dự đoán', href: '#predictions', isActive: true },
  { label: 'Phân tích', href: '#insights' },
  { label: 'Bảng xếp hạng', href: '#leaderboard' },
]

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a className={styles.brand} aria-label="Trang chủ Worldian" href="/">
          <span className={styles.brandIcon}>
            <Trophy size={25} aria-hidden="true" />
          </span>
          <span className={styles.brandText}>WORLDIAN</span>
          <span className={styles.beta}>Beta</span>
        </a>

        <nav className={styles.nav} aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <a key={item.href} className={item.isActive ? styles.activeNav : undefined} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.actions}>
          <span className={styles.livePill}>
            <Radio size={13} aria-hidden="true" />
            Trực tiếp
          </span>
          <button className={styles.iconButton} type="button" aria-label="Thông báo">
            <Bell size={21} aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <button className={styles.avatarButton} type="button" aria-label="Mở hồ sơ">
            M
          </button>
        </div>
      </div>
    </header>
  )
}
