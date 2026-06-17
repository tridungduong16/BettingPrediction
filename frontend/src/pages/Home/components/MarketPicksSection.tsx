import type { CSSProperties } from 'react'
import type { TranslationCopy } from '@/i18n/translations'

import type { PickCard } from '../types'

import styles from './MarketPicksSection.module.scss'

interface MarketPicksSectionProps {
  copy: TranslationCopy['home']
  picks: PickCard[]
}

function splitMarketTitle(title: string) {
  const separatorIndex = title.indexOf(':')

  if (separatorIndex < 0) {
    return {
      description: title,
      market: title,
    }
  }

  return {
    description: title.slice(separatorIndex + 1).trim(),
    market: title.slice(0, separatorIndex).trim(),
  }
}

function confidenceScoreForPick(pick: PickCard) {
  return pick.confidenceScore ?? 0
}

export function MarketPicksSection({
  copy,
  picks,
}: MarketPicksSectionProps) {
  return (
    <section className={styles.marketsSection} id="markets" aria-label={copy.marketsLabel}>
      <div className={styles.sectionIntro}>
        <h2>{copy.marketsTitle}</h2>
        <p>{copy.marketsIntro}</p>
      </div>

      <div className={styles.tableShell}>
        <table className={styles.opportunitiesTable}>
          <thead>
            <tr>
              <th scope="col">{copy.marketsTable.market}</th>
              <th scope="col">{copy.marketsTable.description}</th>
              <th scope="col">{copy.marketsTable.confidence}</th>
              <th scope="col">{copy.marketsTable.decision}</th>
              <th scope="col">{copy.marketsTable.reasoning}</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((pick) => {
              const Icon = pick.icon
              const titleParts = splitMarketTitle(pick.title)
              const confidenceScore = confidenceScoreForPick(pick)
              const confidenceStyle = {
                '--confidence-score': `${confidenceScore}%`,
              } as CSSProperties

              return (
                <tr key={pick.id} className={styles[`pick${pick.tone}`]}>
                  <td data-label={copy.marketsTable.market}>
                    <div className={styles.marketCell}>
                      <span className={styles.pickIconBadge}>
                        {pick.iconImage ? (
                          <img className={styles.pickIconImage} src={pick.iconImage} alt="" aria-hidden="true" />
                        ) : (
                          <Icon size={18} aria-hidden="true" />
                        )}
                      </span>
                      <div className={styles.marketIdentity}>
                        <span className={styles.pickRank}>{pick.rank}</span>
                        <strong>{titleParts.market}</strong>
                        <span className={styles.pickLabel}>{copy.aiPick}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label={copy.marketsTable.description}>
                    <div className={styles.descriptionCell}>
                      <span>{titleParts.description}</span>
                      <div className={styles.pickMeta}>
                        {pick.risk ? <span>{pick.risk}</span> : null}
                      </div>
                    </div>
                  </td>
                  <td data-label={copy.marketsTable.confidence}>
                    <div
                      aria-label={`${copy.confidenceLabel}: ${confidenceScore}%${pick.confidence ? `, ${pick.confidence}` : ''}`}
                      className={styles.confidenceCell}
                      style={confidenceStyle}
                    >
                      <span className={styles.confidenceMeter} aria-hidden="true">
                        <i />
                      </span>
                      <span className={styles.confidenceInfo}>
                        <strong>{confidenceScore}%</strong>
                        {pick.confidence ? <span>{pick.confidence}</span> : null}
                      </span>
                    </div>
                  </td>
                  <td data-label={copy.marketsTable.decision}>
                    <strong className={styles.decision}>{pick.selection}</strong>
                  </td>
                  <td data-label={copy.marketsTable.reasoning}>
                    <p className={styles.reasoning}>{pick.reasoning}</p>
                    {pick.confidenceRationale ? (
                      <span className={styles.confidenceNote}>
                        {copy.confidenceLabel}: {pick.confidenceRationale}
                      </span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
