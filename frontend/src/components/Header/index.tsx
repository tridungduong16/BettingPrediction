import { Bell, Radio } from 'lucide-react'

import styles from './Header.module.scss'

function Brand({ className }: { className?: string }) {
  return (
    <a className={[styles.brand, className].filter(Boolean).join(' ')} aria-label="Trang chủ Worldian" href="/">
      <span className={styles.brandIcon}>
        <img src="/brand/worldian-logo.png" alt="" aria-hidden="true" />
      </span>
      <span className={styles.brandText}>WORLDIAN</span>
    </a>
  )
}

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Brand className={styles.mobileBrand} />

        <div className={styles.centerBrand}>
          <Brand className={styles.navBrand} />
        </div>

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
