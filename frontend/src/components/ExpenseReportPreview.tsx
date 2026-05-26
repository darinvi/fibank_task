import {
  EXPENSE_REPORT_LOGO_PATH,
  EXPENSE_REPORT_TAX_RATE,
  buildExpenseReportData,
  formatReportAmount,
  getCategoryColor,
} from '../lib/expenseReport'
import type { SavedInvoice } from '../types/invoice'
import { CategoryPieChart } from './CategoryPieChart'
import './ExpenseReportPreview.css'

type ExpenseReportPreviewProps = {
  invoice: SavedInvoice
}

export function ExpenseReportPreview({ invoice }: ExpenseReportPreviewProps) {
  const report = buildExpenseReportData(invoice)

  return (
    <div className="expense-report">
      <div className="expense-report__logo-wrap">
        <img
          src={EXPENSE_REPORT_LOGO_PATH}
          alt=""
          className="expense-report__logo"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      </div>

      <div className="expense-report__sheet">
        <h3 className="expense-report__title">EXPENSE REPORT</h3>

        <div className="expense-report__meta">
          <p>Vendor: {report.vendor}</p>
          <p>Date: {report.date}</p>
          <p>Invoice#: {report.invoiceNumber}</p>
        </div>

        <table className="expense-report__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Category</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {report.lineItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="expense-report__empty">
                  No line items
                </td>
              </tr>
            ) : (
              report.lineItems.map((row) => (
                <tr key={row.index}>
                  <td>{row.index}</td>
                  <td>{row.item}</td>
                  <td>{row.category}</td>
                  <td>{row.qty}</td>
                  <td>{formatReportAmount(row.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="expense-report__summary">
          <h4>CATEGORY SUMMARY</h4>
          {report.categorySummary.length === 0 ? (
            <p className="expense-report__empty">No categories</p>
          ) : (
            <div className="expense-report__summary-body">
              <CategoryPieChart data={report.categorySummary} />
              <div className="expense-report__summary-rows">
                {report.categorySummary.map((row, index) => (
                  <div className="expense-report__summary-row" key={row.category}>
                    <span
                      className="expense-report__summary-swatch"
                      style={{ backgroundColor: getCategoryColor(index) }}
                      aria-hidden="true"
                    />
                    <span className="expense-report__summary-label">{row.category}</span>
                    <span className="expense-report__summary-dots" aria-hidden="true" />
                    <span className="expense-report__summary-amount">
                      {formatReportAmount(row.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="expense-report__totals">
            <p>Subtotal: {formatReportAmount(report.subtotal)}</p>
            <p>
              Tax ({Math.round(EXPENSE_REPORT_TAX_RATE * 100)}%): {formatReportAmount(report.tax)}
            </p>
            <p className="expense-report__total">TOTAL: {formatReportAmount(report.total)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
