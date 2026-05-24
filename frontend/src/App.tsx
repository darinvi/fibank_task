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
          Upload invoice photos, adjust them for clarity, and extract structured data automatically.
        </p>
      </header>

      <main className="app__main">
        <InvoiceList />
      </main>
    </div>
  )
}

export default App
