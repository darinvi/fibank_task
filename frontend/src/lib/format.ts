export function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  return String(value)
}

export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) {
    return '—'
  }

  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
      }).format(amount)
    } catch {
      return `${amount.toFixed(2)} ${currency}`
    }
  }

  return amount.toFixed(2)
}

export function formatNumber(value: number | null): string {
  if (value === null) {
    return '—'
  }
  return String(value)
}
