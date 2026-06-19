import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownMessageProps {
  className?: string
  content: string
  fallback?: string
}

const markdownComponents: Components = {
  a({ children, href, node, ...props }) {
    void node

    const opensNewTab = typeof href === 'string' && /^(https?:)?\/\//.test(href)

    return (
      <a
        {...props}
        href={href}
        rel={opensNewTab ? 'noreferrer' : undefined}
        target={opensNewTab ? '_blank' : undefined}
      >
        {children}
      </a>
    )
  },
}

export function MarkdownMessage({ className, content, fallback = '' }: MarkdownMessageProps) {
  const markdown = content.trim() || fallback

  return (
    <div className={className}>
      <ReactMarkdown
        components={markdownComponents}
        disallowedElements={['img']}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
