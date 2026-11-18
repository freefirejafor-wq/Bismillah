import { useEffect, useState } from 'react';
import { Download, ExternalLink, Printer, Share2, X } from 'lucide-react';
import type { Customer, HalkhataSession, ShopProfile } from '../types.ts';
import {
  formatAmount,
  formatNumberText,
  formatSerial,
  getRemainingBalance,
  getTodayDateLabel,
} from '../utils/bengali.ts';
import {
  generateCustomerReceiptPdf,
  type GeneratedPdfResult,
} from '../utils/pdfGenerator.ts';

interface ReceiptModalProps {
  customer: Customer | null;
  shop: ShopProfile;
  halkhata: HalkhataSession;
  onClose: () => void;
}

export function ReceiptModal({ customer, shop, halkhata, onClose }: ReceiptModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [lastPdf, setLastPdf] = useState<GeneratedPdfResult | null>(null);

  useEffect(() => {
    setPdfError(null);
    setLastPdf(null);
  }, [customer?.id]);

  useEffect(() => {
    return () => {
      if (lastPdf?.url) {
        URL.revokeObjectURL(lastPdf.url);
      }
    };
  }, [lastPdf]);

  if (!customer) return null;

  const remaining = getRemainingBalance(customer);
  const totalPaid = customer.cashPaid + customer.bankPaid;
  const fmt = shop.numeralFormat;

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setPdfError(null);
    try {
      if (lastPdf?.url) {
        URL.revokeObjectURL(lastPdf.url);
      }
      const result = await generateCustomerReceiptPdf({ customer, shop, halkhata });
      setLastPdf(result);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'রসিদ PDF তৈরি করা যায়নি।');
    } finally {
      setDownloading(false);
    }
  };

  const handleSharePdf = async () => {
    if (!lastPdf) return;
    try {
      const file = new File([lastPdf.blob], lastPdf.fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${customer.name} — হিসাব রসিদ`,
        });
      }
    } catch {
      // Cancelled
    }
  };

  const canShareFiles =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">কাস্টমারের হিসাব রসিদ</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'তৈরি হচ্ছে...' : 'PDF ডাউনলোড'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>প্রিন্ট</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {pdfError}
          </div>
        )}

        {lastPdf && (
          <div className="no-print mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-emerald-900 font-medium">রসিদ PDF তৈরি হয়েছে:</span>
            <div className="flex items-center gap-2">
              <a
                href={lastPdf.url}
                download={lastPdf.fileName}
                className="px-2.5 py-1 bg-emerald-700 text-white rounded font-medium inline-flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>সেভ</span>
              </a>
              <a
                href={lastPdf.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-900 rounded font-medium inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span>খুলুন</span>
              </a>
              {canShareFiles && (
                <button
                  type="button"
                  onClick={handleSharePdf}
                  className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-900 rounded font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Share2 className="w-3 h-3" />
                  <span>শেয়ার</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="p-6 bg-slate-50 flex justify-center">
          <div className="print-sheet w-full bg-white border border-slate-300 p-6 space-y-5 text-slate-900">
            <div className="text-center border-b border-slate-300 pb-4 space-y-1">
              <h3 className="font-display-bn text-2xl font-bold text-slate-900">
                {shop.shopName}
              </h3>
              <p className="text-xs text-slate-700">{shop.shopAddress}</p>
              {shop.shopPhone && (
                <p className="text-xs text-slate-600 font-mono-num">
                  মোবাইল: {formatNumberText(shop.shopPhone, fmt)}
                </p>
              )}
              <div className="pt-2 flex items-center justify-between text-xs text-slate-600">
                <span>হালখাতা: {formatNumberText(halkhata.dateLabel, fmt)}</span>
                <span>রসিদ তারিখ: {getTodayDateLabel(fmt)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div>
                <span className="text-slate-500">ক্রমিক নং: </span>
                <span className="font-semibold font-mono-num">
                  {formatSerial(customer.serialNo, fmt)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">খাতার পৃষ্ঠা: </span>
                <span className="font-semibold font-mono-num">
                  {customer.pageNo ? formatNumberText(customer.pageNo, fmt) : '—'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">কাস্টমারের নাম: </span>
                <span className="font-semibold text-sm">{customer.name}</span>
              </div>
              <div>
                <span className="text-slate-500">ঠিকানা: </span>
                <span>{customer.address || '—'}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">মোবাইল: </span>
                <span className="font-mono-num">
                  {customer.mobile ? formatNumberText(customer.mobile, fmt) : '—'}
                </span>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-400 text-xs">
              <tbody>
                <tr>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700">মোট পাওনা টাকা</td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-semibold font-mono-num">
                    {formatAmount(customer.totalDue, fmt)} ৳
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700">জমা (নগদ)</td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-semibold text-emerald-700 font-mono-num">
                    {formatAmount(customer.cashPaid, fmt)} ৳
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700">জমা (ব্যাংক / বিকাশ)</td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-semibold text-emerald-700 font-mono-num">
                    {formatAmount(customer.bankPaid, fmt)} ৳
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2 font-medium text-slate-800">মোট পরিশোধিত</td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-semibold font-mono-num">
                    {formatAmount(totalPaid, fmt)} ৳
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 px-3 py-2.5 font-bold text-slate-900">অবশিষ্ট বাকি</td>
                  <td className="border border-slate-300 px-3 py-2.5 text-right font-bold text-red-700 text-sm font-mono-num">
                    {formatAmount(remaining, fmt)} ৳
                  </td>
                </tr>
              </tbody>
            </table>

            {customer.notes && (
              <p className="text-xs text-slate-600">মন্তব্য: {customer.notes}</p>
            )}

            <div className="pt-8 flex items-center justify-between text-xs text-slate-600">
              <div className="border-t border-slate-400 pt-1 px-4">কাস্টমারের স্বাক্ষর</div>
              <div className="border-t border-slate-400 pt-1 px-4">দোকানদারের স্বাক্ষর</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
