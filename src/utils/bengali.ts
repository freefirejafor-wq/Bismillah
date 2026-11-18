import type { Customer, NumeralFormat } from '../types.ts';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

export function toBnDigits(input: string | number): string {
  const str = String(input);
  return str.replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function toEnDigits(input: string): string {
  return input.replace(/[০-৯]/g, (ch) => {
    const idx = BN_DIGITS.indexOf(ch as (typeof BN_DIGITS)[number]);
    return idx >= 0 ? String(idx) : ch;
  });
}

export function parseFlexibleNumber(input: string | number): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.max(0, input) : 0;
  }
  const normalized = toEnDigits(input).replace(/[,/\-\s৳তকাবাকি=]/g, '').trim();
  const match = normalized.match(/\d+(\.\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

/**
 * Formats integer amounts with South Asian Lakh/Crore comma grouping (e.g. 1,59,723 -> ১,৫৯,৭২৩)
 */
export function formatIndianComma(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const sign = rounded < 0 ? '-' : '';
  const absStr = String(Math.abs(rounded));
  if (absStr.length <= 3) return `${sign}${absStr}`;
  const lastThree = absStr.slice(-3);
  const rest = absStr.slice(0, -3);
  const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}${groupedRest},${lastThree}`;
}

export function formatAmount(amount: number, format: NumeralFormat = 'bn'): string {
  const formatted = formatIndianComma(amount);
  return format === 'bn' ? toBnDigits(formatted) : formatted;
}

export function formatNumberText(value: string | number, format: NumeralFormat = 'bn'): string {
  const str = String(value);
  return format === 'bn' ? toBnDigits(str) : toEnDigits(str);
}

export function formatSerial(serialNo: number, format: NumeralFormat = 'bn'): string {
  const padded = String(serialNo).padStart(2, '0');
  return format === 'bn' ? toBnDigits(padded) : padded;
}

export function getRemainingBalance(customer: Pick<Customer, 'totalDue' | 'cashPaid' | 'bankPaid'>): number {
  return Math.max(0, Math.round(customer.totalDue - customer.cashPaid - customer.bankPaid));
}

export function getCustomerStatus(customer: Pick<Customer, 'totalDue' | 'cashPaid' | 'bankPaid'>): 'paid' | 'partial' | 'unpaid' {
  const paid = customer.cashPaid + customer.bankPaid;
  const remaining = getRemainingBalance(customer);
  if (customer.totalDue === 0 || remaining === 0) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

export function getTodayDateLabel(format: NumeralFormat = 'bn'): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const label = `${dd}.${mm}.${yy}`;
  return format === 'bn' ? toBnDigits(label) : label;
}

export function buildWhatsAppReminderUrl(
  customer: Customer,
  shopName: string,
  dateLabel: string
): string | null {
  const digits = toEnDigits(customer.mobile).replace(/\D/g, '');
  if (digits.length < 10) return null;
  let phone = digits;
  if (phone.startsWith('01') && phone.length === 11) {
    phone = `88${phone}`;
  } else if (phone.length === 10 && phone.startsWith('1')) {
    phone = `880${phone}`;
  }
  const paid = customer.cashPaid + customer.bankPaid;
  const remaining = getRemainingBalance(customer);
  const message =
    `আসসালামু আলাইকুম ${customer.name},\n` +
    `${shopName}-এর হালখাতা (${toBnDigits(dateLabel)}) অনুযায়ী আপনার হিসাব:\n` +
    `• মোট পাওনা: ${formatAmount(customer.totalDue, 'bn')} টাকা\n` +
    `• মোট জমা: ${formatAmount(paid, 'bn')} টাকা\n` +
    `• অবশিষ্ট বাকি: ${formatAmount(remaining, 'bn')} টাকা\n` +
    `ধন্যবাদ।`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function getTelHref(mobile: string): string | null {
  const digits = toEnDigits(mobile).replace(/\D/g, '');
  if (digits.length < 6) return null;
  return `tel:${digits}`;
}
