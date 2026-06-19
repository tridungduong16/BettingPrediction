import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ListChecks,
  Radio,
  ShieldAlert,
} from 'lucide-react'
import { createPortal } from 'react-dom'

import { FloatingAIAssistant } from '@/components/FloatingAIAssistant'
import { env } from '@/config/env'
import { ROUTES } from '@/constants/routes'
import { getDashboardPlaceholder } from '@/data/placeholder'
import { useAppDispatch, useAppSelector } from '@/hooks/store'
import { useI18n } from '@/i18n/I18nProvider'
import {
  selectDashboardActiveMatchId,
  selectDashboardData,
  selectDashboardError,
  selectDashboardLiveStatus,
  selectDashboardStatus,
  selectInsightPredictionStatus,
  selectLastLiveSnapshotAt,
  selectMarketPredictionStatus,
  selectMarketPredictions,
} from '@/store/features/dashboard/selectors'
import { dashboardActions } from '@/store/features/dashboard/slice'

import { FullMatchAnalysis } from './components/FullMatchAnalysis'
import { LiveRail } from './components/LiveRail'
import { MarketPicksSection } from './components/MarketPicksSection'
import { MatchStage } from './components/MatchStage'
import styles from './Home.module.scss'
import { buildFallbackMarketPicks, mapMarketPredictionsToPickCards } from './marketPicks'
import { isMatchMinuteTime } from './timeline'

const showFullMatchAnalysis = false
const showProbabilityMovement = false
const insightTabIds = ['markets', 'live'] as const
type InsightTabId = typeof insightTabIds[number]

export default function Home() {
  const { copy, language } = useI18n()
  const { matchId: routeMatchId } = useParams<{ matchId: string }>()
  const dispatch = useAppDispatch()
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const [activeInsightTab, setActiveInsightTab] = useState<InsightTabId>('markets')
  const activeMatchId = useAppSelector(selectDashboardActiveMatchId)
  const dashboardData = useAppSelector(selectDashboardData)
  const dashboardStatus = useAppSelector(selectDashboardStatus)
  const dashboardError = useAppSelector(selectDashboardError)
  const insightPredictionStatus = useAppSelector(selectInsightPredictionStatus)
  const liveStatus = useAppSelector(selectDashboardLiveStatus)
  const lastLiveSnapshotAt = useAppSelector(selectLastLiveSnapshotAt)
  const marketPredictionStatus = useAppSelector(selectMarketPredictionStatus)
  const marketPredictions = useAppSelector(selectMarketPredictions)
  const matchId = routeMatchId ?? env.defaultMatchId
  const data = dashboardStatus === 'idle' ? getDashboardPlaceholder(language) : dashboardData
  const homeTeamName = data.match.homeTeam.name
  const awayTeamName = data.match.awayTeam.name
  const predictedWinner = data.prediction.winner

  useEffect(() => {
    dispatch(dashboardActions.loadMatchRequested({ language, matchId }))

    return () => {
      dispatch(dashboardActions.stopLivePolling())
    }
  }, [dispatch, language, matchId])

  useEffect(() => {
    if (dashboardStatus !== 'ready') {
      return undefined
    }

    dispatch(dashboardActions.startLivePolling({ language, matchId }))

    return () => {
      dispatch(dashboardActions.stopLivePolling())
    }
  }, [dashboardStatus, dispatch, language, matchId])

  const liveStatusMessage = useMemo(() => {
    if (dashboardStatus === 'error') {
      return copy.home.matchDataUnavailable(dashboardError ?? copy.home.noMatchError)
    }

    if (liveStatus === 'unmapped') {
      return undefined
    }

    if (dashboardError && liveStatus !== 'ready') {
      return dashboardError
    }

    if (lastLiveSnapshotAt && liveStatus !== 'ready') {
      return copy.home.statusProvider(copy.home.liveStatusLabels[liveStatus])
    }

    return undefined
  }, [copy.home, dashboardError, dashboardStatus, lastLiveSnapshotAt, liveStatus])

  const fallbackMarketPicks = useMemo(
    () => buildFallbackMarketPicks(
      homeTeamName,
      awayTeamName,
      predictedWinner,
      language,
      copy.home.confidence,
      copy.home.risk,
    ),
    [awayTeamName, copy.home.confidence, copy.home.risk, homeTeamName, language, predictedWinner],
  )

  const topPicks = useMemo(
    () => {
      const predictions = marketPredictions?.predictions ?? []

      if (!predictions.length) {
        return fallbackMarketPicks
      }

      return mapMarketPredictionsToPickCards(
        predictions,
        copy.home.confidence,
        copy.home.risk,
      )
    },
    [copy.home.confidence, copy.home.risk, fallbackMarketPicks, marketPredictions],
  )

  const hasMatchMinuteTimeline = data.feed.some((item) => isMatchMinuteTime(item.time))
  const timelineItems = hasMatchMinuteTimeline ? [...data.feed].reverse() : data.feed
  const scoreSignalNeedle = language === 'vi' ? 'tỷ số' : 'score'
  const liveScore = data.match.signals.find((signal) => signal.label.toLowerCase().includes(scoreSignalNeedle))?.value ?? '0-0'
  const matchTitle = `${data.match.homeTeam.name} vs ${data.match.awayTeam.name}`
  const liveRailSubtitle =
    liveStatus === 'ready'
      ? copy.home.liveRailSubtitleReady
      : copy.home.liveRailSubtitleStatus
  const isPendingStatus = (status: 'idle' | 'loading' | 'ready' | 'error') =>
    status === 'idle' || status === 'loading'
  const isAnalysisLoading =
    activeMatchId !== matchId ||
    dashboardStatus === 'idle' ||
    dashboardStatus === 'loading' ||
    (
      dashboardStatus === 'ready' &&
      (isPendingStatus(insightPredictionStatus) || isPendingStatus(marketPredictionStatus))
    )
  const shouldShowLoadingOverlay = showLoadingOverlay || isAnalysisLoading
  const handleInsightTabsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return
    }

    event.preventDefault()

    const currentIndex = insightTabIds.indexOf(activeInsightTab)
    const nextTab = (() => {
      if (event.key === 'Home') {
        return insightTabIds[0]
      }

      if (event.key === 'End') {
        return insightTabIds[insightTabIds.length - 1]
      }

      const offset = event.key === 'ArrowRight' ? 1 : -1
      return insightTabIds[(currentIndex + offset + insightTabIds.length) % insightTabIds.length]
    })()

    setActiveInsightTab(nextTab)
    window.requestAnimationFrame(() => {
      document.getElementById(`${nextTab}-insight-tab`)?.focus()
    })
  }

  useEffect(() => {
    if (!isAnalysisLoading) {
      const progressTimeoutId = window.setTimeout(() => {
        setLoadingProgress(100)
      }, 0)
      const timeoutId = window.setTimeout(() => {
        setShowLoadingOverlay(false)
      }, 260)

      return () => {
        window.clearTimeout(progressTimeoutId)
        window.clearTimeout(timeoutId)
      }
    }

    const startTimeoutId = window.setTimeout(() => {
      setShowLoadingOverlay(true)
      setLoadingProgress(0)
    }, 0)
    const intervalId = window.setInterval(() => {
      setLoadingProgress((current) => {
        if (current >= 95) {
          return current
        }

        const step = current < 32 ? 6 : current < 68 ? 4 : 2
        return Math.min(current + step, 95)
      })
    }, 180)

    return () => {
      window.clearTimeout(startTimeoutId)
      window.clearInterval(intervalId)
    }
  }, [isAnalysisLoading, matchId])

  useEffect(() => {
    if (!shouldShowLoadingOverlay) {
      return undefined
    }

    const scrollY = window.scrollY
    const { body, documentElement } = document
    const appRoot = document.getElementById('root')
    const previousBodyOverflow = body.style.overflow
    const previousBodyPosition = body.style.position
    const previousBodyTop = body.style.top
    const previousBodyWidth = body.style.width
    const previousDocumentOverflow = documentElement.style.overflow
    const hadRootInert = appRoot?.hasAttribute('inert') ?? false
    const hadRootAriaHidden = appRoot?.hasAttribute('aria-hidden') ?? false
    const previousRootAriaHidden = appRoot?.getAttribute('aria-hidden') ?? null

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    documentElement.style.overflow = 'hidden'
    appRoot?.setAttribute('inert', '')
    appRoot?.setAttribute('aria-hidden', 'true')

    return () => {
      body.style.overflow = previousBodyOverflow
      body.style.position = previousBodyPosition
      body.style.top = previousBodyTop
      body.style.width = previousBodyWidth
      documentElement.style.overflow = previousDocumentOverflow

      if (appRoot) {
        if (hadRootInert) {
          appRoot.setAttribute('inert', '')
        } else {
          appRoot.removeAttribute('inert')
        }

        if (hadRootAriaHidden && previousRootAriaHidden !== null) {
          appRoot.setAttribute('aria-hidden', previousRootAriaHidden)
        } else {
          appRoot.removeAttribute('aria-hidden')
        }
      }

      window.scrollTo(0, scrollY)
    }
  }, [shouldShowLoadingOverlay])

  const loadingOverlay = shouldShowLoadingOverlay
    ? createPortal(
      <div className={styles.loadingOverlay} role="status" aria-live="polite">
        <div className={styles.loadingCard}>
          <div className={styles.loadingLogoMark} aria-hidden="true">
            <img src="/brand/worldian-logo.png" alt="" />
          </div>
          <div className={styles.loadingCopy}>
            <span>{copy.home.loadingAnalysis}</span>
            <strong>{loadingProgress}%</strong>
          </div>
          <div className={styles.loadingTrack} aria-hidden="true">
            <i style={{ width: `${loadingProgress}%` }} />
          </div>
        </div>
      </div>,
      document.body,
    )
    : null

  return (
    <div className={styles.analysisShell}>
      <div
        aria-hidden={shouldShowLoadingOverlay}
        className={[styles.page, shouldShowLoadingOverlay ? styles.pageBehindLoading : undefined].filter(Boolean).join(' ')}
      >
        <div className={styles.breadcrumbRow}>
          <div className={styles.breadcrumbs} aria-label={copy.home.breadcrumbLabel}>
            <Link className={styles.backLink} to={ROUTES.HOME}>
              <ArrowLeft size={14} aria-hidden="true" />
              {copy.home.backToMatches}
            </Link>
            <ArrowRight size={14} aria-hidden="true" />
            <span>{matchTitle}</span>
          </div>
          <div className={styles.updated}>
            {copy.home.updated}: {data.prediction.lastUpdated}
            <Radio size={15} aria-hidden="true" />
          </div>
        </div>

        {liveStatusMessage ? (
          <div className={styles.liveStatusBanner} data-status={liveStatus}>
            <ShieldAlert size={15} aria-hidden="true" />
            <span>{liveStatusMessage}</span>
          </div>
        ) : null}

        <div className={styles.dashboardLayout}>
          <MatchStage match={data.match} overviewLabel={copy.home.matchOverviewLabel} />

          <div className={styles.mainStack}>
            {showFullMatchAnalysis ? (
              <FullMatchAnalysis
                copy={copy.home}
                data={data}
                liveStatus={liveStatus}
                showProbabilityMovement={showProbabilityMovement}
              />
            ) : null}

            <section className={styles.insightTabs} aria-label={copy.home.marketsLabel}>
              <div
                className={styles.tabList}
                onKeyDown={handleInsightTabsKeyDown}
                role="tablist"
                aria-label={`${copy.home.marketsTitle} / ${copy.home.liveRailLabel}`}
              >
                <button
                  aria-controls="markets-insight-panel"
                  aria-selected={activeInsightTab === 'markets'}
                  id="markets-insight-tab"
                  onClick={() => setActiveInsightTab('markets')}
                  role="tab"
                  tabIndex={activeInsightTab === 'markets' ? 0 : -1}
                  type="button"
                >
                  <ListChecks size={16} aria-hidden="true" />
                  <span>{copy.home.marketsTitle}</span>
                </button>
                <button
                  aria-controls="live-insight-panel"
                  aria-selected={activeInsightTab === 'live'}
                  id="live-insight-tab"
                  onClick={() => setActiveInsightTab('live')}
                  role="tab"
                  tabIndex={activeInsightTab === 'live' ? 0 : -1}
                  type="button"
                >
                  <Radio size={16} aria-hidden="true" />
                  <span>{copy.home.liveRailLabel}</span>
                </button>
              </div>

              <div
                aria-labelledby="markets-insight-tab"
                className={styles.tabPanel}
                hidden={activeInsightTab !== 'markets'}
                id="markets-insight-panel"
                role="tabpanel"
              >
                <MarketPicksSection
                  copy={copy.home}
                  picks={topPicks}
                />
              </div>

              <div
                aria-labelledby="live-insight-tab"
                className={styles.tabPanel}
                hidden={activeInsightTab !== 'live'}
                id="live-insight-panel"
                role="tabpanel"
              >
                <LiveRail
                  copy={copy.home}
                  items={timelineItems}
                  liveScore={liveScore}
                  liveStatus={liveStatus}
                  match={data.match}
                  subtitle={liveRailSubtitle}
                />
              </div>
            </section>
          </div>

          <div className={styles.assistantRail}>
            <FloatingAIAssistant
              disabled={shouldShowLoadingOverlay || dashboardStatus === 'error'}
              initialMessages={data.chat}
              language={language}
              matchId={matchId}
              prompts={data.prompts}
              variant="embedded"
            />
          </div>
        </div>
      </div>

      {loadingOverlay}
    </div>
  )
}
