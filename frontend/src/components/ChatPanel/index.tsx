import { useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import clsx from 'clsx'

import type { ChatMessage } from '@/store/features/dashboard/types'

import styles from './ChatPanel.module.scss'

interface ChatPanelProps {
  messages: ChatMessage[]
  prompts: string[]
}

export function ChatPanel({ messages, prompts }: ChatPanelProps) {
  const [chatMessages, setChatMessages] = useState(messages)
  const [draft, setDraft] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedDraft = draft.trim()

    if (!trimmedDraft) {
      return
    }

    setChatMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        message: trimmedDraft,
      },
      {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        message:
          'Đánh giá hiện tại: Brazil tăng xác suất vì chất lượng dứt điểm trung lộ cải thiện, còn bất định đội hình của Pháp vẫn chưa được giải quyết.',
      },
    ])
    setDraft('')
  }

  return (
    <section className={styles.panel} aria-labelledby="chat-title">
      <div className={styles.header}>
        <div>
          <span>Chat AI</span>
          <h2 id="chat-title">Hỏi về trận đấu này</h2>
        </div>
        <Sparkles size={18} aria-hidden="true" />
      </div>

      <div className={styles.messages}>
        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={clsx(styles.message, styles[message.sender])}
          >
            <p>{message.message}</p>
          </div>
        ))}
      </div>

      <div className={styles.prompts}>
        {prompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => setDraft(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          aria-label="Hỏi Worldian AI"
          placeholder="Hỏi điều gì vừa thay đổi..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" aria-label="Gửi tin nhắn">
          <Send size={17} aria-hidden="true" />
        </button>
      </form>
    </section>
  )
}
