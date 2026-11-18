import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import { LogOut, Store } from 'lucide-react';
import { auth } from '../firebase.ts';
import { getTodayDateLabel } from '../utils/bengali.ts';

interface ShopOnboardingProps {
  userEmail: string;
  onCreateShop: (data: {
    shopName: string;
    shopAddress: string;
    shopPhone: string;
    halkhataTitle: string;
    dateLabel: string;
  }) => Promise<void>;
}

export function ShopOnboarding({ userEmail, onCreateShop }: ShopOnboardingProps) {
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [halkhataTitle, setHalkhataTitle] = useState('হালখাতা');
  const [dateLabel, setDateLabel] = useState(getTodayDateLabel('bn'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setError('আপনার দোকানের নাম লিখুন।');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreateShop({
        shopName: shopName.trim().slice(0, 120),
        shopAddress: shopAddress.trim().slice(0, 200),
        shopPhone: shopPhone.trim().slice(0, 30),
        halkhataTitle: halkhataTitle.trim().slice(0, 120) || 'হালখাতা',
        dateLabel: dateLabel.trim().slice(0, 40) || getTodayDateLabel('bn'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'দোকান তৈরি করা যায়নি।');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white border border-emerald-200 rounded-2xl overflow-hidden">
        <div className="bg-emerald-900 text-white px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-amber-300 shrink-0" />
            <div>
              <h1 className="font-display-bn text-xl font-bold">আপনার দোকানের হালখাতা খুলুন</h1>
              <p className="text-xs text-emerald-100">{userEmail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>লগআউট</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            আপনার দোকানের নাম ও তথ্য দিন—এগুলো আপনার ডিজিটাল খাতা ও A4 PDF শিটের ওপরে দেখাবে।
          </p>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              দোকানের নাম <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="যেমন: ভাই ভাই এন্টারপ্রাইজ"
              maxLength={120}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">দোকানের ঠিকানা</label>
              <input
                type="text"
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                placeholder="যেমন: বাজার রোড, থানা, জেলা"
                maxLength={200}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">দোকানের মোবাইল</label>
              <input
                type="text"
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                maxLength={30}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">হালখাতার শিরোনাম</label>
              <input
                type="text"
                value={halkhataTitle}
                onChange={(e) => setHalkhataTitle(e.target.value)}
                maxLength={120}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">তারিখ</label>
              <input
                type="text"
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                maxLength={40}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono-num"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl cursor-pointer"
          >
            {saving ? 'খাতা তৈরি হচ্ছে...' : 'দোকানের খাতা শুরু করুন'}
          </button>
        </form>
      </div>
    </div>
  );
}
