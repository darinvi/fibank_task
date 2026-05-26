import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { askAboutInvoices } from '../lib/api'
import './InvoiceChat.css'
import './Modal.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type ChatTab = {
  id: string
  title: string
  messages: ChatMessage[]
  sessionId: string | null
  input: string
  error: string | null
  isLoading: boolean
}

const MAX_TABS = 5
const DEFAULT_TAB_TITLE = 'New chat'
const TAB_TITLE_MAX_LENGTH = 28

const EXAMPLE_PROMPTS = [
  'What is the total amount across all invoices?',
  'Which issuer appears most often?',
  'Show invoices from the last month.',
]

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function createTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function createTab(): ChatTab {
  return {
    id: createTabId(),
    title: DEFAULT_TAB_TITLE,
    messages: [],
    sessionId: null,
    input: '',
    error: null,
    isLoading: false,
  }
}

function titleFromMessage(text: string): string {
  const singleLine = text.replace(/\s+/g, ' ').trim()
  if (!singleLine) {
    return DEFAULT_TAB_TITLE
  }
  if (singleLine.length <= TAB_TITLE_MAX_LENGTH) {
    return singleLine
  }
  return `${singleLine.slice(0, TAB_TITLE_MAX_LENGTH - 1)}…`
}

function updateTabById(
  tabs: ChatTab[],
  tabId: string,
  updater: (tab: ChatTab) => ChatTab,
): ChatTab[] {
  return tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab))
}

export function InvoiceChat() {
  const [tabs, setTabs] = useState<ChatTab[]>(() => [createTab()])
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const canAddTab = tabs.length < MAX_TABS

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) {
      return
    }

    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [activeTab.messages, activeTab.isLoading])

  useEffect(() => {
    inputRef.current?.focus()
  }, [activeTabId])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || activeTab.isLoading) {
      return
    }

    const tabId = activeTab.id
    let sessionId: string | null = activeTab.sessionId

    setTabs((current) => {
      const tab = current.find((item) => item.id === tabId)
      sessionId = tab?.sessionId ?? null
      return updateTabById(current, tabId, (item) => ({
        ...item,
        error: null,
        input: '',
        title: item.messages.length === 0 ? titleFromMessage(trimmed) : item.title,
        messages: [...item.messages, { id: createMessageId(), role: 'user', content: trimmed }],
        isLoading: true,
      }))
    })

    try {
      const response = await askAboutInvoices(trimmed, sessionId)
      setTabs((current) =>
        updateTabById(current, tabId, (item) => ({
          ...item,
          sessionId: response.session_id,
          messages: [
            ...item.messages,
            { id: createMessageId(), role: 'assistant', content: response.reply },
          ],
          isLoading: false,
        })),
      )
    } catch (err) {
      setTabs((current) =>
        updateTabById(current, tabId, (tab) => ({
          ...tab,
          error: err instanceof Error ? err.message : 'Failed to get a reply',
          isLoading: false,
        })),
      )
    } finally {
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void sendMessage(activeTab.input)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(activeTab.input)
    }
  }

  const handleNewTab = () => {
    if (!canAddTab) {
      return
    }

    const tab = createTab()
    setTabs((current) => [...current, tab])
    setActiveTabId(tab.id)
  }

  const handleCloseTab = (tabId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (tabs.length === 1) {
      const resetTab = createTab()
      setTabs([resetTab])
      setActiveTabId(resetTab.id)
      return
    }

    const closingIndex = tabs.findIndex((tab) => tab.id === tabId)
    const nextTabs = tabs.filter((tab) => tab.id !== tabId)

    if (tabId === activeTabId) {
      const nextActive = nextTabs[Math.min(closingIndex, nextTabs.length - 1)]
      setActiveTabId(nextActive.id)
    }

    setTabs(nextTabs)
  }

  const handleSelectTab = (tabId: string) => {
    setActiveTabId(tabId)
  }

  const handleInputChange = (value: string) => {
    setTabs((current) =>
      updateTabById(current, activeTabId, (tab) => ({
        ...tab,
        input: value,
      })),
    )
  }

  return (
    <section className="invoice-chat" aria-label="Invoice assistant chat">
      <div className="invoice-chat__header">
        <div>
          <h2>Invoice assistant</h2>
          <p>Ask questions about your stored invoices and line items.</p>
        </div>
        <div className="invoice-chat__header-actions">
          <span
            className="invoice-chat__tab-count"
            aria-label={`${tabs.length} of ${MAX_TABS} chats open`}
          >
            {tabs.length}/{MAX_TABS}
          </span>
          <button
            type="button"
            className="btn btn--ghost invoice-chat__new"
            onClick={handleNewTab}
            disabled={!canAddTab}
            title={canAddTab ? 'Open a new chat tab' : `Maximum of ${MAX_TABS} chats`}
          >
            New chat
          </button>
        </div>
      </div>

      <div className="invoice-chat__tab-bar" role="tablist" aria-label="Chat sessions">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              className={`invoice-chat__tab${isActive ? ' invoice-chat__tab--active' : ''}${
                tab.isLoading ? ' invoice-chat__tab--loading' : ''
              }`}
              role="presentation"
            >
              <button
                type="button"
                role="tab"
                id={`invoice-chat-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`invoice-chat-panel-${tab.id}`}
                className="invoice-chat__tab-select"
                onClick={() => handleSelectTab(tab.id)}
                title={tab.title}
              >
                <span className="invoice-chat__tab-title">{tab.title}</span>
              </button>
              <button
                type="button"
                className="invoice-chat__tab-close"
                onClick={(event) => handleCloseTab(tab.id, event)}
                aria-label={`Close ${tab.title}`}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div
        ref={messagesContainerRef}
        id={`invoice-chat-panel-${activeTab.id}`}
        role="tabpanel"
        aria-labelledby={`invoice-chat-tab-${activeTab.id}`}
        className="invoice-chat__messages"
      >
        {activeTab.messages.length === 0 && !activeTab.isLoading && (
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

        {activeTab.messages.map((message) => (
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

        {activeTab.isLoading && (
          <div className="invoice-chat__message invoice-chat__message--assistant">
            <span className="invoice-chat__message-label">Assistant</span>
            <div className="invoice-chat__bubble invoice-chat__bubble--loading">Thinking…</div>
          </div>
        )}
      </div>

      {activeTab.error && <p className="invoice-chat__error">{activeTab.error}</p>}

      <form className="invoice-chat__form" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="invoice-chat__input"
          value={activeTab.input}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your invoices…"
          rows={2}
          disabled={activeTab.isLoading}
          aria-label="Message"
        />
        <button
          type="submit"
          className="btn btn--primary"
          disabled={activeTab.isLoading || !activeTab.input.trim()}
        >
          Send
        </button>
      </form>
    </section>
  )
}
