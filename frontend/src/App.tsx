import { InvoiceChat } from './components/InvoiceChat'
import { InvoiceList } from './components/InvoiceList'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            F
          </span>
          <div>
            <p className="app__eyebrow">Fibank</p>
            <h1>Invoice Reader</h1>
          </div>
        </div>
        <p className="app__tagline">
          Upload invoice photos, review extracted data, and ask questions about your invoices.
        </p>
      </header>

      <main className="app__main">
        <div className="app__split">
          <div className="app__pane app__pane--invoices">
            <InvoiceList />
          </div>
          <div className="app__pane app__pane--chat">
            <InvoiceChat />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
