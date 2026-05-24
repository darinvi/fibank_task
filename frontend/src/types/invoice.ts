export type Party = {
  name: string | null
  id: string | null
}

export type LineItem = {
  description: string | null
  quantity: number | null
  unit_price: number | null
  amount: number | null
}

export type InvoiceExtraction = {
  invoice_number: string | null
  invoice_date: string | null
  issuer: Party
  receiver: Party
  line_items: LineItem[]
  total_amount: number | null
  currency: string | null
}
