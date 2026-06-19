import { useEffect, useId, useRef, useState } from 'react'
import { Bot, Loader2, MessageCircle, Send, X } from 'lucide-react'

import { streamMatchChat } from '@/api/predictions'
import type { LanguageCode } from '@/i18n/languages'
import type { ChatMessage } from '@/store/features/dashboard/types'

import styles from './FloatingAIAssistant.module.scss'

type AssistantStatus = 'error' | 'idle' | 'streaming'

interface FloatingAIAssistantProps {
  disabled?: boolean
  initialMessages: ChatMessage[]
  language: LanguageCode
  matchId: string
  prompts: string[]
}

function assistantCopy(language: LanguageCode) {
  if (language === 'en') {
    return {
      close: 'Close assistant',
      error: 'The analyst stream is unavailable right now.',
      input: 'Ask anything...',
      label: 'AI Analyst',
      open: 'Open AI analyst',
      panelTitle: 'AI Match Assistant',
      send: 'Send',
      status: 'Reading match context...',
      typing: 'AI Analyst is writing',
    }
  }

  return {
    close: 'Đóng trợ lý',
    error: 'Chưa kết nối được luồng phân tích.',
    input: 'Hỏi bất cứ điều gì...',
    label: 'AI Analyst',
    open: 'Mở AI Analyst',
    panelTitle: 'AI Match Assistant',
    send: 'Gửi',
    status: 'Đang đọc context trận...',
    typing: 'AI Analyst đang trả lời',
  }
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

export function FloatingAIAssistant({
  disabled = false,
  initialMessages,
  language,
  matchId,
  prompts,
}: FloatingAIAssistantProps) {
  const copy = assistantCopy(language)
  const panelId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const [draft, setDraft] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [status, setStatus] = useState<AssistantStatus>('idle')

  useEffect(() => {
    setMessages(initialMessages)
    setDraft('')
    setStatus('idle')
    streamAbortRef.current?.abort()
  }, [initialMessages, matchId])

  useEffect(() => () => streamAbortRef.current?.abort(), [])

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [isOpen])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      behavior: 'smooth',
      top: scrollRef.current.scrollHeight,
    })
  }, [messages, status])

  const askQuestion = async (question: string) => {
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion || status === 'streaming' || disabled) {
      return
    }

    const assistantMessageId = messageId('ai')
    const controller = new AbortController()
    streamAbortRef.current?.abort()
    streamAbortRef.current = controller
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

    try {
      await streamMatchChat(
        matchId,
        {
          message: trimmedQuestion,
          thread_id: matchId,
        },
        (event) => {
          if (event.type === 'text_delta' || event.type === 'text_full') {
            const nextText = textContent(event.content)

            setMessages((current) => current.map((message) => {
              if (message.id !== assistantMessageId) {
                return message
              }

              return {
                ...message,
                message: event.type === 'text_delta' ? `${message.message}${nextText}` : nextText,
              }
            }))
          }

          if (event.type === 'done') {
            const finalText = textContent(event.content)

            if (finalText) {
              setMessages((current) => current.map((message) => (
                message.id === assistantMessageId
                  ? { ...message, message: finalText }
                  : message
              )))
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
      setMessages((current) => current.map((message) => (
        message.id === assistantMessageId
          ? { ...message, message: error instanceof Error ? error.message : copy.error }
          : message
      )))
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

  return (
    <aside className={styles.assistant} aria-label={copy.panelTitle}>
      {isOpen ? (
        <section className={styles.panel} id={panelId}>
          <div className={styles.header}>
            <div className={styles.titleGroup}>
              <span className={styles.iconShell} aria-hidden="true">
                <Bot size={18} />
              </span>
              <div>
                <p>{copy.label}</p>
                <h2>{copy.panelTitle}</h2>
              </div>
            </div>
            <button
              aria-label={copy.close}
              className={styles.iconButton}
              onClick={closeAssistant}
              type="button"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.promptGrid} aria-label={copy.open}>
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

          <div className={styles.messages} ref={scrollRef} aria-live="polite">
            {messages.map((message) => (
              <article
                className={styles.message}
                data-sender={message.sender}
                key={message.id}
              >
                <p>
                  {message.message || (message.sender === 'ai' && status === 'streaming' ? copy.status : '')}
                </p>
              </article>
            ))}
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <input
              aria-label={copy.input}
              disabled={disabled || status === 'streaming'}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={copy.input}
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
        </section>
      ) : null}

      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-label={copy.open}
        className={styles.trigger}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <MessageCircle size={19} aria-hidden="true" />
        <span>{copy.label}</span>
      </button>
    </aside>
  )
}
