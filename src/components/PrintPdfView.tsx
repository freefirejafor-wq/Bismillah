import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Printer, Share2 } from 'lucide-react';
import type { Customer, HalkhataSession, ShopProfile } from '../types.ts';
import {
  formatAmount,
  formatNumberText,
  formatSerial,
  getRemainingBalance,
} from '../utils/bengali.ts';
import {
  generateHalkhataLedgerPdf,
  type GeneratedPdfResult,
} from '../utils/pdfGenerator.ts';

interface PrintPdfViewProps {
  customers: Customer[];
  shop: ShopProfile;
  halkhata: HalkhataSession;
}

type PrintMode = 'filled' | 'blank_deposit';
type RowFilter = 'all' | 'unpaid_only';

const ROWS_PER_PAGE = 18;

export function PrintPdfView({ customers, shop, halkhata }: PrintPdfViewProps) {
  const [printMode, setPrintMode] = useState<PrintMode>('filled');
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [showRemainingCol, setShowRemainingCol] = useState<boolean>(true);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [lastPdf, setLastPdf] = useState<GeneratedPdfResult | null>(null);

  const fmt = shop.numeralFormat;

  useEffect(() => {
    return () => {
      if (lastPdf?.url) {
        URL.revokeObjectURL(lastPdf.url);
      }
    };
  }, [lastPdf]);

  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.address.trim()) set.add(c.address.trim());
    });
    return Array.from(set);
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (rowFilter === 'unpaid_only' && getRemainingBalance(c) <= 0) return false;
      if (areaFilter !== 'all' && c.address.trim() !== areaFilter) return false;
      return true;
    });
  }, [customers, rowFilter, areaFilter]);

  const pages = useMemo(() => {
    const chunks: Customer[][] = [];
    for (let i = 0; i < filteredCustomers.length; i += ROWS_PER_PAGE) {
      chunks.push(filteredCustomers.slice(i, i + ROWS_PER_PAGE));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [filteredCustomers]);

  const grandTotals = useMemo(() => {
    return filteredCustomers.reduce(
      (acc, c) => {
        acc.totalDue += c.totalDue;
        acc.cashPaid += c.cashPaid;
        acc.bankPaid += c.bankPaid;
        acc.remaining += getRemainingBalance(c);
        return acc;
      },
      { totalDue: 0, cashPaid: 0, bankPaid: 0, remaining: 0 }
    );
  }, [filteredCustomers]);

  const handleDownloadPdf = async (onlyPageIndex?: number) => {
    const key = typeof onlyPageIndex === 'number' ? `page_${onlyPageIndex}` : 'all';
    setExportingKey(key);
    setPdfError(null);
    try {
      if (lastPdf?.url) {
        URL.revokeObjectURL(lastPdf.url);
      }
      const result = await generateHalkhataLedgerPdf({
        customers: filteredCustomers,
        shop,
        halkhata,
        printMode,
        showRemainingCol,
        onlyPageIndex,
      });
      setLastPdf(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PDF তৈরি করতে সমস্যা হয়েছে।';
      setPdfError(msg);
    } finally {
      setExportingKey(null);
    }
  };

  const handleSharePdf = async () => {
    if (!lastPdf) return;
    try {
      const file = new File([lastPdf.blob], lastPdf.fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${shop.shopName} — হালখাতা PDF`,
        });
      }
    } catch {
      // User cancelled share sheet
    }
  };

  const canShareFiles =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="space-y-6">
      {/* Print Controls Toolbar */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">A4 হালখাতা শিট ও PDF প্রিন্ট</h2>
            <p className="text-xs text-slate-500">
              হুবহু আপনার কাগজের শিটের ফরম্যাটে পরিষ্কার A4 PDF ডাউনলোড বা সরাসরি প্রিন্ট করুন।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleDownloadPdf()}
              disabled={exportingKey !== null}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>
                {exportingKey === 'all'
                  ? 'PDF তৈরি হচ্ছে...'
                  : pages.length > 1
                  ? `সব পাতা একসাথে PDF (${formatNumberText(pages.length, fmt)} পাতা)`
                  : 'সব পাতা একসাথে PDF ডাউনলোড'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট করুন</span>
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {pdfError}
          </div>
        )}

        {lastPdf && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-emerald-900 font-medium">
              PDF প্রস্তুত হয়েছে ({lastPdf.fileName}) — মোবাইলে স্বয়ংক্রিয়ভাবে সেভ না হলে পাশের বাটনে চাপ দিন:
            </span>
            <div className="flex items-center gap-2">
              <a
                href={lastPdf.url}
                download={lastPdf.fileName}
                className="px-3 py-1.5 bg-emerald-700 text-white rounded-md font-medium inline-flex items-center gap-1.5 hover:bg-emerald-800"
              >
                <Download className="w-3.5 h-3.5" />
                <span>সেভ করুন</span>
              </a>
              <a
                href={lastPdf.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 rounded-md font-medium inline-flex items-center gap-1.5 hover:bg-emerald-100"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>খুলুন</span>
              </a>
              {canShareFiles && (
                <button
                  type="button"
                  onClick={handleSharePdf}
                  className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 rounded-md font-medium inline-flex items-center gap-1.5 hover:bg-emerald-100 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>শেয়ার / WhatsApp</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">প্রিন্ট ধরন:</span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setPrintMode('filled')}
                className={`px-3 py-1 rounded-md font-medium cursor-pointer ${
                  printMode === 'filled' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                পূর্ণ হিসাব (জমা ও বাকিসহ)
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('blank_deposit')}
                className={`px-3 py-1 rounded-md font-medium cursor-pointer ${
                  printMode === 'blank_deposit'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                খালি জমার ঘর (কলমে লেখার জন্য)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">কাস্টমার:</span>
            <select
              value={rowFilter}
              onChange={(e) => setRowFilter(e.target.value as RowFilter)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
            >
              <option value="all">সকল কাস্টমার</option>
              <option value="unpaid_only">শুধু যাদের বাকি আছে</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">এলাকা/ঠিকানা:</span>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
            >
              <option value="all">সকল এলাকা</option>
              {uniqueAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showRemainingCol}
              onChange={(e) => setShowRemainingCol(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700"
            />
            <span>&quot;অবশিষ্ট বাকি&quot; কলাম দেখান</span>
          </label>
        </div>
      </div>

      {/* A4 Sheet Preview */}
      <div className="space-y-8 flex flex-col items-center">
        {pages.map((pageRows, pageIndex) => {
          const isLastPage = pageIndex === pages.length - 1;
          const isDownloadingThis = exportingKey === `page_${pageIndex}`;
          return (
            <div key={pageIndex} className="w-full max-w-[210mm] space-y-2">
              <div className="no-print flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs">
                <span className="font-semibold text-slate-800">
                  পাতা {formatNumberText(pageIndex + 1, fmt)} / {formatNumberText(pages.length, fmt)} ·{' '}
                  {formatNumberText(pageRows.length, fmt)} জন কাস্টমার
                </span>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(pageIndex)}
                  disabled={exportingKey !== null}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-900 font-medium rounded-md inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {isDownloadingThis
                      ? 'তৈরি হচ্ছে...'
                      : `শুধু পাতা ${formatNumberText(pageIndex + 1, fmt)} PDF ডাউনলোড`}
                  </span>
                </button>
              </div>
              <div
                className="print-sheet bg-white border border-slate-300 shadow-sm w-full p-5 sm:p-7 text-black overflow-x-auto"
              >
              <div className="relative text-center bg-emerald-50 border-2 border-emerald-900 border-t-[6px] p-4 mb-4">
                <h1 className="font-display-bn text-2xl sm:text-3xl font-bold tracking-tight text-emerald-950">
                  {shop.shopName}
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 mt-0.5">
                  {shop.shopAddress}
                </p>
                {shop.shopPhone && (
                  <p className="text-xs font-bold text-emerald-800 font-mono-num">
                    মোবাইল: {formatNumberText(shop.shopPhone, fmt)}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold font-mono-num">
                  <span className="text-emerald-900">
                    {formatNumberText(halkhata.title, fmt)}
                    {pages.length > 1 && (
                      <span className="ml-1.5">
                        (পাতা {formatNumberText(pageIndex + 1, fmt)}/{formatNumberText(pages.length, fmt)})
                      </span>
                    )}
                  </span>
                  <span className="text-rose-800">
                    তারিখ: {formatNumberText(halkhata.dateLabel, fmt)}
                  </span>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-700 text-sm">
                <thead>
                  <tr className="text-white font-bold">
                    <th className="border border-slate-700 bg-emerald-900 py-2 px-1.5 text-center w-10">নং</th>
                    <th className="border border-slate-700 bg-emerald-900 py-2 px-1.5 text-center w-14">পৃষ্ঠা</th>
                    <th className="border border-slate-700 bg-emerald-900 py-2 px-2 text-left">নাম</th>
                    <th className="border border-slate-700 bg-emerald-900 py-2 px-2 text-left w-24">ঠিকানা</th>
                    <th className="border border-slate-700 bg-emerald-900 py-2 px-2 text-left w-36">মোবাইল</th>
                    <th className="border border-slate-700 bg-indigo-900 py-2 px-2 text-right w-24">টাকা</th>
                    <th className="border border-slate-700 bg-emerald-700 py-2 px-2 text-right w-24">জমা নগদ</th>
                    <th className="border border-slate-700 bg-sky-800 py-2 px-2 text-right w-24">জমা ব্যাংক</th>
                    {showRemainingCol && (
                      <th className="border border-slate-700 bg-rose-800 py-2 px-2 text-right w-28">বাকি</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showRemainingCol ? 9 : 8}
                        className="border border-slate-700 py-8 text-center text-slate-500"
                      >
                        কোনো কাস্টমার তথ্য নেই
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((c) => {
                      const remaining = getRemainingBalance(c);
                      return (
                        <tr key={c.id} className="h-9 odd:bg-white even:bg-slate-50">
                          <td className="border border-slate-400 px-1.5 py-1 text-center font-bold text-emerald-900 font-mono-num">
                            {formatSerial(c.serialNo, fmt)}
                          </td>
                          <td className="border border-slate-400 px-1.5 py-1 text-center font-semibold text-slate-700 font-mono-num">
                            {c.pageNo ? formatNumberText(c.pageNo, fmt) : '—'}
                          </td>
                          <td className="border border-slate-400 px-2 py-1 font-bold text-slate-900">{c.name}</td>
                          <td className="border border-slate-400 px-2 py-1 text-slate-800">{c.address}</td>
                          <td className="border border-slate-400 px-2 py-1 font-bold text-slate-900 font-mono-num whitespace-nowrap">
                            {c.mobile ? formatNumberText(c.mobile, fmt) : '—'}
                          </td>
                          <td className="border border-slate-400 px-2 py-1 text-right font-mono-num font-bold text-indigo-950 bg-indigo-50/70">
                            {formatAmount(c.totalDue, fmt)}
                          </td>
                          <td className="border border-slate-400 px-2 py-1 text-right font-mono-num font-bold text-emerald-800 bg-emerald-50/70">
                            {printMode === 'filled' && c.cashPaid > 0
                              ? formatAmount(c.cashPaid, fmt)
                              : ''}
                          </td>
                          <td className="border border-slate-400 px-2 py-1 text-right font-mono-num font-bold text-sky-800 bg-sky-50/70">
                            {printMode === 'filled' && c.bankPaid > 0
                              ? formatAmount(c.bankPaid, fmt)
                              : ''}
                          </td>
                          {showRemainingCol && (
                            <td
                              className={`border border-slate-400 px-2 py-1 text-right font-mono-num font-bold bg-rose-50/70 ${
                                remaining <= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {printMode === 'filled' ? formatAmount(remaining, fmt) : ''}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {isLastPage && filteredCustomers.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-900 font-bold text-white">
                      <td colSpan={5} className="border border-slate-700 px-2 py-2 text-right">
                        সর্বমোট ({formatNumberText(filteredCustomers.length, fmt)} জন):
                      </td>
                      <td className="border border-slate-700 px-2 py-2 text-right font-mono-num text-indigo-200">
                        {formatAmount(grandTotals.totalDue, fmt)}
                      </td>
                      <td className="border border-slate-700 px-2 py-2 text-right font-mono-num text-emerald-300">
                        {printMode === 'filled'
                          ? formatAmount(grandTotals.cashPaid, fmt)
                          : ''}
                      </td>
                      <td className="border border-slate-700 px-2 py-2 text-right font-mono-num text-sky-300">
                        {printMode === 'filled'
                          ? formatAmount(grandTotals.bankPaid, fmt)
                          : ''}
                      </td>
                      {showRemainingCol && (
                        <td className="border border-slate-700 px-2 py-2 text-right font-mono-num text-amber-300">
                          {printMode === 'filled' ? formatAmount(grandTotals.remaining, fmt) : ''}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>

              <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-emerald-900">
                <span>{shop.shopName}</span>
                <span className="text-slate-600">ডিজিটাল হালখাতা সিস্টেম</span>
              </div>
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
