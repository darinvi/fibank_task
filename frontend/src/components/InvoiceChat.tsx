import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { askAboutInvoices } from '../lib/api'
import './InvoiceChat.css'
import './Modal.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const EXAMPLE_PROMPTS = [
  'What is the total amount across all invoices?',
  'Which issuer appears most often?',
  'Show invoices from the last month.',
]

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function InvoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) {
      return
    }

    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) {
      return
    }

    setError(null)
    setInput('')
    setMessages((current) => [
      ...current,
      { id: createMessageId(), role: 'user', content: trimmed },
    ])
    setIsLoading(true)

    try {
      const response = await askAboutInvoices(trimmed, sessionId)
      setSessionId(response.session_id)
      setMessages((current) => [
        ...current,
        { id: createMessageId(), role: 'assistant', content: response.reply },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get a reply')
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void sendMessage(input)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(input)
    }
  }

  const handleNewConversation = () => {
    setMessages([])
    setSessionId(null)
    setError(null)
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <section className="invoice-chat" aria-label="Invoice assistant chat">
      <div className="invoice-chat__header">
        <div>
          <h2>Invoice assistant</h2>
          <p>Ask questions about your stored invoices and line items.</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost invoice-chat__new"
            onClick={handleNewConversation}
            disabled={isLoading}
          >
            New chat
          </button>
        )}
      </div>

      <div ref={messagesContainerRef} className="invoice-chat__messages">
        {messages.length === 0 && !isLoading && (
          <div className="invoice-chat__empty">
            <p>Try asking about totals, issuers, dates, or line items.</p>
            <ul className="invoice-chat__prompts">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <li key={prompt}>
                  <button
                    type="button"
                    className="invoice-chat__prompt"
                    onClick={() => void sendMessage(prompt)}
                  >
                    {prompt}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`invoice-chat__message invoice-chat__message--${message.role}`}
          >
            <span className="invoice-chat__message-label">
              {message.role === 'user' ? 'You' : 'Assistant'}
            </span>
            <div className="invoice-chat__bubble">{message.content}</div>
          </div>
        ))}

        {isLoading && (
          <div className="invoice-chat__message invoice-chat__message--assistant">
            <span className="invoice-chat__message-label">Assistant</span>
            <div className="invoice-chat__bubble invoice-chat__bubble--loading">Thinking…</div>
          </div>
        )}

      </div>

      {error && <p className="invoice-chat__error">{error}</p>}

      <form className="invoice-chat__form" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="invoice-chat__input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your invoices…"
          rows={2}
          disabled={isLoading}
          aria-label="Message"
        />
        <button type="submit" className="btn btn--primary" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  )
}
