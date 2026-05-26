export type Party = {
  name: string | null
  id: string | null
}

export type LineItem = {
  description: string | null
  category: string | null
  quantity: number | null
  unit_price: number | null
  amount: number | null
}

export type SavedLineItem = LineItem & {
  id: number
}

export type InvoiceExtraction = {
  invoice_number: string | null
  invoice_date: string | null
  issuer: Party
  receiver: Party
  line_items: LineItem[]
  subtotal_amount: number | null
  total_amount: number | null
  currency: string | null
}

export type SavedInvoice = Omit<InvoiceExtraction, 'line_items'> & {
  id: number
  line_items: SavedLineItem[]
}
