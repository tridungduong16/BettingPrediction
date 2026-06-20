import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, Send, X } from 'lucide-react'

import { getRecommendedChatQuestions, streamMatchChat } from '@/api/predictions'
import type { LanguageCode } from '@/i18n/languages'
import type { PredictionChatStreamEvent } from '@/store/features/dashboard/apiTypes'
import type { ChatMessage } from '@/store/features/dashboard/types'

import styles from './FloatingAIAssistant.module.scss'
import { MarkdownMessage } from './MarkdownMessage'

type AssistantStatus = 'error' | 'idle' | 'streaming'

const ASSISTANT_LOGO_SRC = '/brand/okasian-logo.svg'
export const ENABLE_RESPONSE_FOLLOW_UPS = true
const ASSISTANT_CLIENT_SESSION_KEY = 'worldian-assistant-client-session-id'

type AssistantThreadStorage = Pick<Storage, 'getItem' | 'setItem'>

interface AssistantThreadIdOptions {
  createId?: () => string
  storage?: AssistantThreadStorage | null
}

interface FloatingAIAssistantProps {
  disabled?: boolean
  initialMessages: ChatMessage[]
  language: LanguageCode
  matchId: string
  prompts: string[]
  variant?: 'embedded' | 'floating'
}

export function assistantCopy(language: LanguageCode) {
  if (language === 'en') {
    return {
      close: 'Close assistant',
      error: 'The analyst stream is unavailable right now.',
      followUps: 'Recommended follow-up questions',
      initialHeadline: 'What do you want to analyze?',
      inputLabel: 'Ask Okasian',
      open: 'Open Okasian',
      panelTitle: 'Okasian',
      send: 'Send',
      status: 'Thinking...',
      typing: 'Okasian is writing',
    }
  }

  return {
    close: 'Đóng trợ lý',
    error: 'Chưa kết nối được luồng phân tích.',
    followUps: 'Câu hỏi gợi ý tiếp theo',
    initialHeadline: 'Bạn muốn phân tích gì?',
    inputLabel: 'Nhập câu hỏi cho Okasian',
    open: 'Mở Okasian',
    panelTitle: 'Okasian',
    send: 'Gửi',
    status: 'Đang suy nghĩ...',
    typing: 'Okasian đang trả lời',
  }
}

function defaultAssistantSessionStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function createAssistantClientSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function assistantThreadId(matchId: string, options: AssistantThreadIdOptions = {}) {
  const storage = options.storage === undefined ? defaultAssistantSessionStorage() : options.storage
  const createId = options.createId ?? createAssistantClientSessionId
  let clientSessionId = ''

  if (storage) {
    try {
      clientSessionId = storage.getItem(ASSISTANT_CLIENT_SESSION_KEY)?.trim() ?? ''

      if (!clientSessionId) {
        clientSessionId = createId()
        storage.setItem(ASSISTANT_CLIENT_SESSION_KEY, clientSessionId)
      }
    } catch {
      clientSessionId = createId()
    }
  } else {
    clientSessionId = createId()
  }

  return `${matchId.trim()}:${clientSessionId}`
}

export function assistantToolActivityMessage(
  event: PredictionChatStreamEvent,
  language: LanguageCode,
) {
  if (event.type !== 'tool_call' || !isRecord(event.content)) {
    return undefined
  }

  if (event.content.name !== 'search_latest_information') {
    return undefined
  }

  const query = toolActivityQuery(event.content)

  if (!query) {
    return language === 'en'
      ? 'Search latest information...'
      : 'Đang tìm thông tin mới nhất...'
  }

  return language === 'en'
    ? `Search latest information about ${query}`
    : `Đang tìm thông tin mới nhất về ${query}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toolActivityQuery(content: Record<string, unknown>) {
  const args = content.args

  if (!isRecord(args) || typeof args.query !== 'string') {
    return ''
  }

  return args.query.trim()
}

function updateAssistantMessage(
  currentMessages: ChatMessage[],
  assistantMessageId: string,
  update: (message: ChatMessage) => ChatMessage,
) {
  return currentMessages.map((message) => (
    message.id === assistantMessageId ? update(message) : message
  ))
}

export function assistantStreamAnswerMessage(
  currentMessage: string,
  event: PredictionChatStreamEvent,
  hasAnswerText: boolean,
) {
  if (event.type !== 'text_delta' && event.type !== 'text_full' && event.type !== 'done') {
    return undefined
  }

  const nextText = textContent(event.content)

  if (event.type === 'text_delta') {
    return hasAnswerText ? `${currentMessage}${nextText}` : nextText
  }

  return nextText || currentMessage
}

export function assistantMessageFallback(
  message: ChatMessage,
  _messages: ChatMessage[],
  status: AssistantStatus,
  fallback: string,
) {
  if (status !== 'streaming' || message.sender !== 'ai' || message.message.trim()) {
    return ''
  }

  return fallback
}

function messageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function textContent(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

export function assistantNextPrompts(questions: string[], excludedQuestion: string) {
  const excluded = excludedQuestion.trim().toLowerCase()
  const seen = new Set<string>(excluded ? [excluded] : [])
  const prompts: string[] = []

  for (const question of questions) {
    const trimmed = question.trim()
    const key = trimmed.toLowerCase()

    if (!trimmed || seen.has(key)) {
      continue
    }

    prompts.push(trimmed)
    seen.add(key)

    if (prompts.length === 2) {
      break
    }
  }

  return prompts
}

export function FloatingAIAssistant({
  disabled = false,
  initialMessages,
  language,
  matchId,
  prompts,
  variant = 'floating',
}: FloatingAIAssistantProps) {
  const copy = assistantCopy(language)
  const panelId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const recommendationRequestRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const threadIdRef = useRef<{ matchId: string; threadId: string } | null>(null)
  const [draft, setDraft] = useState('')
  const [followUpPrompts, setFollowUpPrompts] = useState<string[]>([])
  const [hasAskedQuestion, setHasAskedQuestion] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [status, setStatus] = useState<AssistantStatus>('idle')

  useEffect(() => {
    recommendationRequestRef.current += 1
    setFollowUpPrompts([])
    setHasAskedQuestion(false)
    setMessages(initialMessages)
    setDraft('')
    setStatus('idle')
    streamAbortRef.current?.abort()
    threadIdRef.current = null
  }, [initialMessages, matchId])

  useEffect(() => () => {
    recommendationRequestRef.current += 1
    streamAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (variant === 'floating' && isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [isOpen, variant])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      behavior: 'smooth',
      top: scrollRef.current.scrollHeight,
    })
  }, [messages, status])

  const loadFollowUpPrompts = async (answeredQuestion: string) => {
    const requestId = recommendationRequestRef.current + 1
    recommendationRequestRef.current = requestId
    const fallbackPrompts = assistantNextPrompts(prompts, answeredQuestion)
    setFollowUpPrompts(fallbackPrompts)

    try {
      const response = await getRecommendedChatQuestions(matchId, {
        includeLive: true,
        includeNews: true,
        language,
      })

      if (recommendationRequestRef.current === requestId) {
        setFollowUpPrompts(assistantNextPrompts(response.questions, answeredQuestion))
      }
    } catch {
      if (recommendationRequestRef.current === requestId) {
        setFollowUpPrompts(fallbackPrompts)
      }
    }
  }

  const askQuestion = async (question: string) => {
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion || status === 'streaming' || disabled) {
      return
    }

    const assistantMessageId = messageId('ai')
    const controller = new AbortController()
    streamAbortRef.current?.abort()
    streamAbortRef.current = controller
    recommendationRequestRef.current += 1
    setFollowUpPrompts([])
    setHasAskedQuestion(true)
    setStatus('streaming')
    setDraft('')
    setMessages((current) => [
      ...current,
      {
        id: messageId('user'),
        message: trimmedQuestion,
        sender: 'user',
      },
      {
        id: assistantMessageId,
        message: '',
        sender: 'ai',
      },
    ])

    const currentThread = threadIdRef.current
    const threadId = currentThread?.matchId === matchId
      ? currentThread.threadId
      : assistantThreadId(matchId)
    threadIdRef.current = { matchId, threadId }

    try {
      let hasAnswerText = false

      await streamMatchChat(
        matchId,
        {
          message: trimmedQuestion,
          thread_id: threadId,
        },
        (event) => {
          const toolActivityMessage = assistantToolActivityMessage(event, language)

          if (toolActivityMessage && !hasAnswerText) {
            setMessages((current) => updateAssistantMessage(
              current,
              assistantMessageId,
              (message) => ({ ...message, message: toolActivityMessage }),
            ))
          }

          if (event.type === 'text_delta' || event.type === 'text_full') {
            setMessages((current) => updateAssistantMessage(
              current,
              assistantMessageId,
              (message) => ({
                ...message,
                message: assistantStreamAnswerMessage(
                  message.message,
                  event,
                  hasAnswerText,
                ) ?? message.message,
              }),
            ))
            hasAnswerText = true
          }

          if (event.type === 'done') {
            const finalText = assistantStreamAnswerMessage('', event, hasAnswerText)

            if (finalText) {
              setMessages((current) => updateAssistantMessage(
                current,
                assistantMessageId,
                (message) => ({ ...message, message: finalText }),
              ))
              hasAnswerText = true
            }

            if (ENABLE_RESPONSE_FOLLOW_UPS) {
              void loadFollowUpPrompts(trimmedQuestion)
            }
          }

          if (event.type === 'error') {
            throw new Error(textContent(event.content) || copy.error)
          }
        },
        {
          includeLive: true,
          includeNews: true,
          language,
          signal: controller.signal,
        },
      )
      setStatus('idle')
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      setStatus('error')
      setMessages((current) => updateAssistantMessage(
        current,
        assistantMessageId,
        (message) => ({ ...message, message: error instanceof Error ? error.message : copy.error }),
      ))
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null
      }
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void askQuestion(draft)
  }

  const closeAssistant = () => {
    setIsOpen(false)
  }

  const isEmbedded = variant === 'embedded'
  const shouldRenderPanel = isEmbedded || isOpen
  const shouldShowInitialComposer = !hasAskedQuestion && messages.length === 0
  const shouldShowInitialPrompts = !hasAskedQuestion && prompts.length > 0
  const rootClassName = [
    styles.assistant,
    isEmbedded ? styles.embedded : undefined,
  ].filter(Boolean).join(' ')
  const panelClassName = [
    styles.panel,
    isEmbedded ? styles.panelEmbedded : undefined,
    shouldShowInitialComposer ? styles.panelInitial : undefined,
  ].filter(Boolean).join(' ')

  return (
    <aside className={rootClassName} aria-label={copy.panelTitle}>
      {shouldRenderPanel ? (
        <section className={panelClassName} id={panelId}>
          {shouldShowInitialComposer ? (
            <div className={styles.initialComposer}>
              {!isEmbedded ? (
                <button
                  aria-label={copy.close}
                  className={styles.initialCloseButton}
                  onClick={closeAssistant}
                  type="button"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              ) : null}

              <span className={styles.initialLogoShell} aria-hidden="true">
                <img
                  alt=""
                  className={styles.assistantLogo}
                  draggable={false}
                  src={ASSISTANT_LOGO_SRC}
                />
              </span>

              <h2>{copy.initialHeadline}</h2>

              <form className={styles.initialForm} onSubmit={handleSubmit}>
                <input
                  aria-label={copy.inputLabel}
                  disabled={disabled || status === 'streaming'}
                  onChange={(event) => setDraft(event.target.value)}
                  ref={inputRef}
                  value={draft}
                />
                <button
                  aria-label={status === 'streaming' ? copy.typing : copy.send}
                  disabled={disabled || status === 'streaming' || !draft.trim()}
                  type="submit"
                >
                  {status === 'streaming' ? (
                    <Loader2 className={styles.spin} size={17} aria-hidden="true" />
                  ) : (
                    <Send size={17} aria-hidden="true" />
                  )}
                </button>
              </form>

              {shouldShowInitialPrompts ? (
                <div className={styles.initialPrompts} aria-label={copy.open}>
                  {prompts.slice(0, 3).map((prompt) => (
                    <button
                      disabled={disabled || status === 'streaming'}
                      key={prompt}
                      onClick={() => {
                        void askQuestion(prompt)
                      }}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}

              {status === 'error' ? <p className={styles.error}>{copy.error}</p> : null}
            </div>
          ) : (
            <>
              <div className={styles.header}>
                <div className={styles.titleGroup}>
                  <span className={styles.iconShell} aria-hidden="true">
                    <img
                      alt=""
                      className={styles.assistantLogo}
                      draggable={false}
                      src={ASSISTANT_LOGO_SRC}
                    />
                  </span>
                  <h2>{copy.panelTitle}</h2>
                </div>
                {!isEmbedded ? (
                  <button
                    aria-label={copy.close}
                    className={styles.iconButton}
                    onClick={closeAssistant}
                    type="button"
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <div className={styles.messages} ref={scrollRef} aria-live="polite">
                {messages.map((message) => (
                  <article
                    className={styles.message}
                    data-sender={message.sender}
                    key={message.id}
                  >
                    {message.sender === 'ai' ? (
                      <MarkdownMessage
                        className={styles.markdownMessage}
                        content={message.message}
                        fallback={assistantMessageFallback(message, messages, status, copy.status)}
                      />
                    ) : (
                      <p>{message.message}</p>
                    )}
                  </article>
                ))}
              </div>

              {ENABLE_RESPONSE_FOLLOW_UPS && followUpPrompts.length ? (
                <div className={styles.followUps} aria-label={copy.followUps}>
                  {followUpPrompts.map((prompt) => (
                    <button
                      disabled={disabled || status === 'streaming'}
                      key={prompt}
                      onClick={() => {
                        void askQuestion(prompt)
                      }}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}

              <form className={styles.form} onSubmit={handleSubmit}>
                <input
                  aria-label={copy.inputLabel}
                  disabled={disabled || status === 'streaming'}
                  onChange={(event) => setDraft(event.target.value)}
                  ref={inputRef}
                  value={draft}
                />
                <button
                  aria-label={status === 'streaming' ? copy.typing : copy.send}
                  disabled={disabled || status === 'streaming' || !draft.trim()}
                  type="submit"
                >
                  {status === 'streaming' ? (
                    <Loader2 className={styles.spin} size={17} aria-hidden="true" />
                  ) : (
                    <Send size={17} aria-hidden="true" />
                  )}
                </button>
              </form>

              {status === 'error' ? <p className={styles.error}>{copy.error}</p> : null}
            </>
          )}
        </section>
      ) : null}

      {!isEmbedded ? (
        <button
          aria-controls={panelId}
          aria-expanded={isOpen}
          aria-label={copy.open}
          className={styles.trigger}
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span className={styles.triggerLogo} aria-hidden="true">
            <img
              alt=""
              className={styles.assistantLogo}
              draggable={false}
              src={ASSISTANT_LOGO_SRC}
            />
          </span>
          <span>{copy.panelTitle}</span>
        </button>
      ) : null}
    </aside>
  )
}
