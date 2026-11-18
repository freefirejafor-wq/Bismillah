import { useMemo, useState } from 'react';
import type { NumeralFormat, Transaction, TransactionType } from '../types.ts';
import { formatAmount, formatNumberText } from '../utils/bengali.ts';

interface TransactionsViewProps {
  transactions: Transaction[];
  numeralFormat: NumeralFormat;
}

export function TransactionsView({ transactions, numeralFormat }: TransactionsViewProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (q) {
        const hit =
          t.customerName.toLowerCase().includes(q) ||
          t.note.toLowerCase().includes(q) ||
          t.dateStr.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, search]);

  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, t) => {
        if (t.type === 'cash') acc.cash += t.amount;
        else if (t.type === 'bank') acc.bank += t.amount;
        else acc.dueAdded += t.amount;
        return acc;
      },
      { cash: 0, bank: 0, dueAdded: 0 }
    );
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
                typeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              সব লেনদেন
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('cash')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
                typeFilter === 'cash' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              নগদ জমা
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('bank')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
                typeFilter === 'bank' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              ব্যাংক/বিকাশ জমা
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('due_added')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
                typeFilter === 'due_added'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              নতুন বাকি
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম, তারিখ বা নোট খুঁজুন..."
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-5 text-xs">
          <div>
            <span className="text-slate-500">নগদ আদায়: </span>
            <span className="font-bold text-emerald-700 font-mono-num">
              {formatAmount(summary.cash, numeralFormat)} ৳
            </span>
          </div>
          <div>
            <span className="text-slate-500">ব্যাংক আদায়: </span>
            <span className="font-bold text-emerald-700 font-mono-num">
              {formatAmount(summary.bank, numeralFormat)} ৳
            </span>
          </div>
          <div>
            <span className="text-slate-500">নতুন বাকি: </span>
            <span className="font-bold text-red-700 font-mono-num">
              {formatAmount(summary.dueAdded, numeralFormat)} ৳
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            এখনো কোনো লেনদেন রেকর্ড করা হয়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  <th className="py-3 px-4 text-left">তারিখ</th>
                  <th className="py-3 px-4 text-left">কাস্টমারের নাম</th>
                  <th className="py-3 px-4 text-left">ধরন</th>
                  <th className="py-3 px-4 text-left">নোট</th>
                  <th className="py-3 px-4 text-right">পরিমাণ (টাকা)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono-num text-slate-700">
                      {formatNumberText(tx.dateStr, numeralFormat)}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{tx.customerName}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-xs font-medium ${
                          tx.type === 'cash'
                            ? 'text-emerald-700'
                            : tx.type === 'bank'
                            ? 'text-sky-700'
                            : 'text-red-700'
                        }`}
                      >
                        {tx.type === 'cash'
                          ? 'জমা নগদ'
                          : tx.type === 'bank'
                          ? 'জমা ব্যাংক/বিকাশ'
                          : 'নতুন বাকি'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">{tx.note || '—'}</td>
                    <td className="py-2.5 px-4 text-right font-semibold font-mono-num text-slate-900">
                      {formatAmount(tx.amount, numeralFormat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
