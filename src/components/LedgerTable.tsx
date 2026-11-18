import {
  FileText,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { Customer, HalkhataSession, NumeralFormat, ShopProfile } from '../types.ts';
import {
  buildWhatsAppReminderUrl,
  formatAmount,
  formatNumberText,
  formatSerial,
  getCustomerStatus,
  getRemainingBalance,
  getTelHref,
} from '../utils/bengali.ts';

interface LedgerTableProps {
  customers: Customer[];
  totalCustomersCount: number;
  shop: ShopProfile;
  halkhata: HalkhataSession;
  isClosed: boolean;
  seeding?: boolean;
  onAddFirst: () => void;
  onSeedInitial?: () => Promise<void>;
  onQuickPay: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customer: Customer) => void;
  onShowReceipt: (customer: Customer) => void;
}

export function LedgerTable({
  customers,
  totalCustomersCount,
  shop,
  halkhata,
  isClosed,
  seeding,
  onAddFirst,
  onSeedInitial,
  onQuickPay,
  onEditCustomer,
  onDeleteCustomer,
  onShowReceipt,
}: LedgerTableProps) {
  const fmt: NumeralFormat = shop.numeralFormat;

  const totals = customers.reduce(
    (acc, c) => {
      acc.totalDue += c.totalDue;
      acc.cashPaid += c.cashPaid;
      acc.bankPaid += c.bankPaid;
      acc.remaining += getRemainingBalance(c);
      return acc;
    },
    { totalDue: 0, cashPaid: 0, bankPaid: 0, remaining: 0 }
  );

  if (customers.length === 0) {
    return (
      <div className="bg-white border border-emerald-200 rounded-2xl p-8 sm:p-12 text-center space-y-4">
        <p className="text-base sm:text-lg font-bold text-slate-900">
          {totalCustomersCount === 0
            ? 'এই হালখাতায় এখনো কোনো কাস্টমার যোগ করা হয়নি'
            : 'খোঁজা বা ফিল্টার অনুযায়ী কোনো কাস্টমার পাওয়া যায়নি'}
        </p>
        <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          {totalCustomersCount === 0
            ? onSeedInitial
              ? 'নতুন কাস্টমার যোগ করুন, অথবা আপনার পাঠানো ছবির ২২ জন কাস্টমারের হিসাব এক ক্লিকে লোড করে নিন।'
              : 'উপরের "নতুন কাস্টমার" বাটনে ক্লিক করে আপনার প্রথম কাস্টমারের হিসাব যোগ করুন।'
            : 'অন্য নাম, পৃষ্ঠা নম্বর বা ফিল্টার দিয়ে আবার চেষ্টা করুন।'}
        </p>
        {!isClosed && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {totalCustomersCount === 0 && onSeedInitial && (
              <button
                type="button"
                onClick={onSeedInitial}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 disabled:opacity-60 rounded-xl cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>
                  {seeding
                    ? 'লোড হচ্ছে...'
                    : 'ছবির ২২ জন কাস্টমার লোড করুন (১৪.১২.২৫)'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onAddFirst}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন কাস্টমার যোগ করুন</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="text-white text-xs sm:text-[13px] font-bold">
              <th className="py-3 px-2.5 text-center w-12 bg-emerald-900 border-r border-emerald-700/70 whitespace-nowrap">
                নং
              </th>
              <th className="py-3 px-2.5 text-center w-16 bg-emerald-900 border-r border-emerald-700/70 whitespace-nowrap">
                পৃষ্ঠা
              </th>
              <th className="py-3 px-3 text-left min-w-[220px] bg-emerald-900 border-r border-emerald-700/70 whitespace-nowrap">
                নাম
              </th>
              <th className="py-3 px-3 text-left min-w-[130px] bg-emerald-900 border-r border-emerald-700/70 whitespace-nowrap">
                ঠিকানা
              </th>
              <th className="py-3 px-3 text-left min-w-[120px] bg-emerald-900 border-r border-emerald-700/70 whitespace-nowrap">
                মোবাইল
              </th>
              <th className="py-3 px-3 text-right min-w-[105px] bg-indigo-900 border-r border-indigo-700/70 whitespace-nowrap">
                টাকা (পাওনা)
              </th>
              <th className="py-3 px-3 text-right min-w-[95px] bg-emerald-700 border-r border-emerald-600 whitespace-nowrap">
                জমা নগদ
              </th>
              <th className="py-3 px-3 text-right min-w-[95px] bg-sky-800 border-r border-sky-700 whitespace-nowrap">
                জমা ব্যাংক
              </th>
              <th className="py-3 px-3 text-right min-w-[115px] bg-rose-800 border-r border-rose-700 whitespace-nowrap">
                অবশিষ্ট বাকি
              </th>
              <th className="py-3 px-3 text-right min-w-[175px] bg-slate-800 whitespace-nowrap">
                কার্যক্রম
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {customers.map((c) => {
              const remaining = getRemainingBalance(c);
              const status = getCustomerStatus(c);
              const telHref = getTelHref(c.mobile);
              const waHref = buildWhatsAppReminderUrl(c, shop.shopName, halkhata.dateLabel);

              return (
                <tr
                  key={c.id}
                  className="odd:bg-white even:bg-slate-50/70 hover:bg-amber-50/60 transition-colors"
                >
                  <td className="py-2.5 px-2.5 text-center font-bold text-emerald-900 font-mono-num border-r border-slate-200 whitespace-nowrap">
                    {formatSerial(c.serialNo, fmt)}
                  </td>
                  <td className="py-2.5 px-2.5 text-center font-medium text-slate-700 font-mono-num border-r border-slate-200 whitespace-nowrap">
                    {c.pageNo ? formatNumberText(c.pageNo, fmt) : '—'}
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-200">
                    <div className="font-bold text-slate-900 leading-snug">{c.name}</div>
                    {c.notes && (
                      <div className="text-[11px] text-amber-800 font-medium mt-0.5">
                        {c.notes}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 font-medium border-r border-slate-200 leading-snug">
                    {c.address || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 font-medium font-mono-num border-r border-slate-200 whitespace-nowrap">
                    {c.mobile ? formatNumberText(c.mobile, fmt) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-indigo-950 bg-indigo-50/50 font-mono-num border-r border-slate-200 whitespace-nowrap">
                    {formatAmount(c.totalDue, fmt)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-800 bg-emerald-50/50 font-mono-num border-r border-slate-200 whitespace-nowrap">
                    {c.cashPaid > 0 ? formatAmount(c.cashPaid, fmt) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-sky-800 bg-sky-50/50 font-mono-num border-r border-slate-200 whitespace-nowrap">
                    {c.bankPaid > 0 ? formatAmount(c.bankPaid, fmt) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right bg-rose-50/40 border-r border-slate-200 whitespace-nowrap">
                    <div
                      className={`font-bold font-mono-num ${
                        status === 'paid'
                          ? 'text-emerald-700'
                          : status === 'partial'
                          ? 'text-amber-800'
                          : 'text-rose-700'
                      }`}
                    >
                      {formatAmount(remaining, fmt)}
                    </div>
                    <div
                      className={`text-[11px] font-bold ${
                        status === 'paid'
                          ? 'text-emerald-700'
                          : status === 'partial'
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {status === 'paid' ? 'পরিশোধ' : status === 'partial' ? 'আংশিক' : 'বাকি'}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1">
                      {!isClosed && (
                        <button
                          type="button"
                          onClick={() => onQuickPay(c)}
                          title="টাকা জমা / নতুন বাকি"
                          className="px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>জমা</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onShowReceipt(c)}
                        title="রসিদ দেখুন ও PDF"
                        className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      {telHref && (
                        <a
                          href={telHref}
                          title="কল করুন"
                          className="p-1.5 text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                      {waHref && (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp-এ হিসাব পাঠান"
                          className="p-1.5 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                      {!isClosed && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditCustomer(c)}
                            title="তথ্য এডিট করুন"
                            className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCustomer(c)}
                            title="মুছে ফেলুন"
                            className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
              <td
                colSpan={5}
                className="py-3 px-3 text-right border-r border-slate-700 whitespace-nowrap"
              >
                মোট ({formatNumberText(customers.length, fmt)} জন কাস্টমার):
              </td>
              <td className="py-3 px-3 text-right font-mono-num text-indigo-200 border-r border-slate-700 whitespace-nowrap">
                {formatAmount(totals.totalDue, fmt)}
              </td>
              <td className="py-3 px-3 text-right font-mono-num text-emerald-300 border-r border-slate-700 whitespace-nowrap">
                {formatAmount(totals.cashPaid, fmt)}
              </td>
              <td className="py-3 px-3 text-right font-mono-num text-sky-300 border-r border-slate-700 whitespace-nowrap">
                {formatAmount(totals.bankPaid, fmt)}
              </td>
              <td className="py-3 px-3 text-right font-mono-num text-amber-300 border-r border-slate-700 whitespace-nowrap">
                {formatAmount(totals.remaining, fmt)}
              </td>
              <td className="py-3 px-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
