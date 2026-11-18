import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Customer, NumeralFormat } from '../types.ts';
import { parseFlexibleNumber, toBnDigits } from '../utils/bengali.ts';

interface CustomerModalProps {
  open: boolean;
  customer: Customer | null;
  nextSerialNo: number;
  numeralFormat: NumeralFormat;
  onClose: () => void;
  onSave: (data: {
    serialNo: number;
    pageNo: string;
    name: string;
    address: string;
    mobile: string;
    totalDue: number;
    cashPaid: number;
    bankPaid: number;
    notes: string;
  }) => Promise<void>;
}

export function CustomerModal({
  open,
  customer,
  nextSerialNo,
  numeralFormat,
  onClose,
  onSave,
}: CustomerModalProps) {
  const [serialNo, setSerialNo] = useState('');
  const [pageNo, setPageNo] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [mobile, setMobile] = useState('');
  const [totalDue, setTotalDue] = useState('');
  const [cashPaid, setCashPaid] = useState('');
  const [bankPaid, setBankPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (customer) {
      setSerialNo(String(customer.serialNo));
      setPageNo(customer.pageNo);
      setName(customer.name);
      setAddress(customer.address);
      setMobile(customer.mobile);
      setTotalDue(String(customer.totalDue));
      setCashPaid(String(customer.cashPaid));
      setBankPaid(String(customer.bankPaid));
      setNotes(customer.notes);
    } else {
      setSerialNo(String(nextSerialNo));
      setPageNo('');
      setName('');
      setAddress('');
      setMobile('');
      setTotalDue('');
      setCashPaid('0');
      setBankPaid('0');
      setNotes('');
    }
  }, [open, customer, nextSerialNo]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('কাস্টমারের নাম অবশ্যই লিখতে হবে।');
      return;
    }
    const parsedSerial = Math.max(1, parseFlexibleNumber(serialNo) || nextSerialNo);
    const parsedDue = parseFlexibleNumber(totalDue);
    const parsedCash = parseFlexibleNumber(cashPaid);
    const parsedBank = parseFlexibleNumber(bankPaid);

    setSaving(true);
    setError(null);
    try {
      await onSave({
        serialNo: parsedSerial,
        pageNo: pageNo.trim().slice(0, 30),
        name: cleanName.slice(0, 120),
        address: address.trim().slice(0, 120),
        mobile: mobile.trim().slice(0, 30),
        totalDue: parsedDue,
        cashPaid: parsedCash,
        bankPaid: parsedBank,
        notes: notes.trim().slice(0, 300),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'সংরক্ষণ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {customer ? 'কাস্টমারের তথ্য সংশোধন' : 'নতুন কাস্টমার যোগ করুন'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ক্রমিক নং</label>
              <input
                type="text"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder={numeralFormat === 'bn' ? toBnDigits(nextSerialNo) : String(nextSerialNo)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">খাতার পৃষ্ঠা নং</label>
              <input
                type="text"
                value={pageNo}
                onChange={(e) => setPageNo(e.target.value)}
                placeholder="যেমন: ৩১৯"
                maxLength={30}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              কাস্টমারের নাম <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: রহিম মিয়া (করিমের ছেলে)"
              maxLength={120}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ঠিকানা / পাড়া / গ্রাম</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="যেমন: শিকারপুর / নিমবাড়ি"
                maxLength={120}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">মোবাইল নম্বর</label>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="017XXXXXXXX"
                maxLength={30}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">মোট পাওনা টাকা</label>
              <input
                type="text"
                value={totalDue}
                onChange={(e) => setTotalDue(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">জমা নগদ</label>
              <input
                type="text"
                value={cashPaid}
                onChange={(e) => setCashPaid(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">জমা ব্যাংক / বিকাশ</label>
              <input
                type="text"
                value={bankPaid}
                onChange={(e) => setBankPaid(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono-num"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">নোট / মন্তব্য</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="যেমন: তারিখ বা পূর্বের নাম নোট"
              maxLength={300}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
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
              {saving ? 'সেভ হচ্ছে...' : 'সংরক্ষণ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
