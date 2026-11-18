import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Customer, NumeralFormat, TransactionType } from '../types.ts';
import {
  formatAmount,
  getRemainingBalance,
  getTodayDateLabel,
  parseFlexibleNumber,
} from '../utils/bengali.ts';

interface PaymentModalProps {
  open: boolean;
  customer: Customer | null;
  numeralFormat: NumeralFormat;
  onClose: () => void;
  onSubmit: (payload: {
    customer: Customer;
    type: TransactionType;
    amount: number;
    dateStr: string;
    note: string;
  }) => Promise<void>;
}

export function PaymentModal({
  open,
  customer,
  numeralFormat,
  onClose,
  onSubmit,
}: PaymentModalProps) {
  const [type, setType] = useState<TransactionType>('cash');
  const [amountText, setAmountText] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !customer) return;
    setType('cash');
    setAmountText('');
    setDateStr(getTodayDateLabel(numeralFormat));
    setNote('');
    setError(null);
  }, [open, customer, numeralFormat]);

  if (!open || !customer) return null;

  const currentRemaining = getRemainingBalance(customer);
  const parsedAmount = parseFlexibleNumber(amountText);

  const previewRemaining =
    type === 'due_added'
      ? currentRemaining + parsedAmount
      : Math.max(0, currentRemaining - parsedAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      setError('সঠিক টাকার পরিমাণ লিখুন (০-এর বেশি)।');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        customer,
        type,
        amount: parsedAmount,
        dateStr: (dateStr.trim() || getTodayDateLabel(numeralFormat)).slice(0, 40),
        note: note.trim().slice(0, 200),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'লেনদেন সেভ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">জমা / বকেয়া এন্ট্রি</h2>
            <p className="text-xs text-slate-500">
              {customer.name} {customer.address ? `· ${customer.address}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <div>
              <p className="text-xs text-slate-500">মোট পাওনা</p>
              <p className="text-sm font-semibold text-slate-900 font-mono-num">
                {formatAmount(customer.totalDue, numeralFormat)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">মোট জমা</p>
              <p className="text-sm font-semibold text-emerald-700 font-mono-num">
                {formatAmount(customer.cashPaid + customer.bankPaid, numeralFormat)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">বর্তমান বাকি</p>
              <p className="text-sm font-semibold text-red-700 font-mono-num">
                {formatAmount(currentRemaining, numeralFormat)}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">লেনদেনের ধরন</label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setType('cash')}
                className={`py-2 px-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  type === 'cash'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                জমা নগদ
              </button>
              <button
                type="button"
                onClick={() => setType('bank')}
                className={`py-2 px-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  type === 'bank'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                জমা ব্যাংক/বিকাশ
              </button>
              <button
                type="button"
                onClick={() => setType('due_added')}
                className={`py-2 px-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  type === 'due_added'
                    ? 'bg-white text-red-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                নতুন বাকি যোগ
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">টাকার পরিমাণ</label>
              <input
                type="text"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="যেমন: ৫০০০"
                autoFocus
                className="w-full px-3 py-2.5 text-base font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono-num"
              />
              {type !== 'due_added' && currentRemaining > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountText(String(currentRemaining))}
                  className="mt-1.5 text-xs text-emerald-700 hover:underline cursor-pointer"
                >
                  সম্পূর্ণ বাকি ({formatAmount(currentRemaining, numeralFormat)}) বসান
                </button>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">তারিখ</label>
              <input
                type="text"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                placeholder="১৮/১১/২৬"
                maxLength={40}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono-num"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">নোট (ঐচ্ছিক)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="যেমন: বিকাশ / ব্যাংক রসিদ / হালখাতা জমা"
              maxLength={200}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-medium text-slate-600">এই এন্ট্রির পর অবশিষ্ট বাকি:</span>
            <span className="text-base font-bold text-slate-900 font-mono-num">
              {formatAmount(previewRemaining, numeralFormat)} টাকা
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              {saving ? 'জমা হচ্ছে...' : 'নিশ্চিত করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
