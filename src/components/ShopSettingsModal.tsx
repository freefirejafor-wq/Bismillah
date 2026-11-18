import React, { useEffect, useState } from 'react';
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import { KeyRound, Lock, Plus, ShieldCheck, X } from 'lucide-react';
import { auth } from '../firebase.ts';
import type { HalkhataSession, NumeralFormat, ShopProfile } from '../types.ts';
import { getTodayDateLabel } from '../utils/bengali.ts';

interface ShopSettingsModalProps {
  open: boolean;
  shop: ShopProfile;
  activeHalkhata: HalkhataSession | null;
  halkhatas: HalkhataSession[];
  onClose: () => void;
  onSaveShop: (updates: {
    shopName: string;
    shopAddress: string;
    shopPhone: string;
    numeralFormat: NumeralFormat;
    activeHalkhataTitle: string;
    activeHalkhataDateLabel: string;
  }) => Promise<void>;
  onCreateNewHalkhata: (title: string, dateLabel: string, carryForwardUnpaid: boolean) => Promise<void>;
  onCloseCurrentHalkhata: () => Promise<void>;
  onSelectHalkhata: (halkhataId: string) => Promise<void>;
}

export function ShopSettingsModal({
  open,
  shop,
  activeHalkhata,
  halkhatas,
  onClose,
  onSaveShop,
  onCreateNewHalkhata,
  onCloseCurrentHalkhata,
  onSelectHalkhata,
}: ShopSettingsModalProps) {
  const [shopName, setShopName] = useState(shop.shopName);
  const [shopAddress, setShopAddress] = useState(shop.shopAddress);
  const [shopPhone, setShopPhone] = useState(shop.shopPhone);
  const [numeralFormat, setNumeralFormat] = useState<NumeralFormat>(shop.numeralFormat);
  const [hTitle, setHTitle] = useState(activeHalkhata?.title ?? 'হালখাতা');
  const [hDate, setHDate] = useState(activeHalkhata?.dateLabel ?? '১৪.১২.২৫');

  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [carryForward, setCarryForward] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkPassword, setLinkPassword] = useState('');
  const [linkingPwd, setLinkingPwd] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setShopName(shop.shopName);
    setShopAddress(shop.shopAddress);
    setShopPhone(shop.shopPhone);
    setNumeralFormat(shop.numeralFormat);
    setHTitle(activeHalkhata?.title ?? 'হালখাতা');
    setHDate(activeHalkhata?.dateLabel ?? '১৪.১২.২৫');
    setNewTitle('');
    setNewDate(getTodayDateLabel(shop.numeralFormat));
    setError(null);
    setLinkPassword('');
    setLinkSuccess(null);
  }, [open, shop, activeHalkhata]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setError('দোকানের নাম ফাঁকা রাখা যাবে না।');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveShop({
        shopName: shopName.trim().slice(0, 120),
        shopAddress: shopAddress.trim().slice(0, 200),
        shopPhone: shopPhone.trim().slice(0, 30),
        numeralFormat,
        activeHalkhataTitle: hTitle.trim().slice(0, 120) || 'হালখাতা',
        activeHalkhataDateLabel: hDate.trim().slice(0, 40) || getTodayDateLabel(numeralFormat),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'সেভ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSession = async () => {
    const t = newTitle.trim();
    const d = newDate.trim() || getTodayDateLabel(numeralFormat);
    if (!t) {
      setError('নতুন হালখাতার নাম লিখুন (যেমন: হালখাতা ২০২৬)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreateNewHalkhata(t.slice(0, 120), d.slice(0, 40), carryForward);
      setNewTitle('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'নতুন হালখাতা খোলা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseArchive = async () => {
    setSaving(true);
    setError(null);
    try {
      await onCloseCurrentHalkhata();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'হালখাতা বন্ধ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const currentUser = auth.currentUser;
  const hasPasswordProvider = Boolean(
    currentUser?.providerData.some((p) => p.providerId === 'password')
  );

  const handleLinkPassword = async () => {
    if (!currentUser || !currentUser.email) return;
    if (linkPassword.length < 6) {
      setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }
    setLinkingPwd(true);
    setError(null);
    setLinkSuccess(null);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, linkPassword);
      await linkWithCredential(currentUser, credential);
      setLinkPassword('');
      setLinkSuccess('পাসওয়ার্ড যুক্ত হয়েছে! এখন এই ইমেইল ও পাসওয়ার্ড দিয়েও লগইন করলে আগের সব ডাটা পাবেন।');
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? '';
      if (code === 'auth/requires-recent-login') {
        setError('নিরাপত্তার জন্য একবার লগআউট করে আবার Google দিয়ে লগইন করে পাসওয়ার্ড সেট করুন।');
      } else if (code === 'auth/operation-not-allowed') {
        setError('Firebase Console থেকে আগে Email/Password চালু করতে হবে।');
      } else {
        setError(err instanceof Error ? err.message : 'পাসওয়ার্ড সেট করা যায়নি।');
      }
    } finally {
      setLinkingPwd(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">দোকানের তথ্য ও হালখাতা সেটিংস</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
              ১. দোকান ও বর্তমান হালখাতার শিরোনাম (PDF-এ দেখাবে)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">দোকানের নাম</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  maxLength={120}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">দোকানের মোবাইল</label>
                <input
                  type="text"
                  value={shopPhone}
                  onChange={(e) => setShopPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  maxLength={30}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono-num"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">দোকানের ঠিকানা</label>
                <input
                  type="text"
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  maxLength={200}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">চলমান হালখাতার নাম</label>
                <input
                  type="text"
                  value={hTitle}
                  onChange={(e) => setHTitle(e.target.value)}
                  disabled={activeHalkhata?.status === 'closed'}
                  maxLength={120}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">হালখাতার তারিখ (PDF শিরোনাম)</label>
                <input
                  type="text"
                  value={hDate}
                  onChange={(e) => setHDate(e.target.value)}
                  disabled={activeHalkhata?.status === 'closed'}
                  maxLength={40}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-700">সংখ্যার ধরন:</span>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setNumeralFormat('bn')}
                    className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                      numeralFormat === 'bn' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    বাংলা (১২৩)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNumeralFormat('en')}
                    className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                      numeralFormat === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    ইংরেজি (123)
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                {saving ? 'সেভ হচ্ছে...' : 'তথ্য সংরক্ষণ করুন'}
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
              ২. সকল হালখাতা খাতা পরিবর্তন বা নতুন হালখাতা খুলুন
            </h3>

            <div className="space-y-2">
              {halkhatas.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50/70"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{h.title}</p>
                    <p className="text-xs text-slate-500">
                      তারিখ: {h.dateLabel} · {h.status === 'closed' ? 'আর্কাইভ করা (ক্লোজড)' : 'চলমান'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.id === activeHalkhata?.id ? (
                      <>
                        <span className="text-xs font-medium text-emerald-700">বর্তমান</span>
                        {h.status === 'active' && (
                          <button
                            type="button"
                            onClick={handleCloseArchive}
                            disabled={saving}
                            className="px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                          >
                            <Lock className="w-3 h-3" />
                            <span>খাতা ক্লোজ করুন</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectHalkhata(h.id)}
                        className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        চালু করুন
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
              <p className="text-xs font-semibold text-slate-800">নতুন হালখাতা শুরু করুন</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="নতুন খাতার নাম (যেমন: হালখাতা ২০২৬)"
                  className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <input
                  type="text"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  placeholder="তারিখ (যেমন: ০১.০১.২৬)"
                  className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={carryForward}
                  onChange={(e) => setCarryForward(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>বর্তমান হালখাতার যাদের টাকা বাকি আছে, তাদের বকেয়া নতুন খাতায় নিয়ে যান</span>
              </label>
              <button
                type="button"
                onClick={handleCreateSession}
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>নতুন হালখাতা খুলুন</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
              ৩. অ্যাকাউন্ট ও ডাটা নিরাপত্তা
            </h3>
            <div className="p-4 border border-emerald-200 rounded-xl bg-emerald-50/60 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed space-y-1">
                  <p>
                    আপনার বর্তমান অ্যাকাউন্ট: <strong className="text-slate-900">{currentUser?.email || 'লগইন করা'}</strong>
                  </p>
                  <p>
                    এই অ্যাকাউন্ট দিয়ে লগআউট করে আবার লগইন করলে বা অন্য ফোনে ঢুকলেও কোনো ডাটা হারাবে না—সব হিসাব ক্লাউড ডাটাবেসে সুরক্ষিত থাকে।
                  </p>
                </div>
              </div>

              {currentUser?.email && !hasPasswordProvider && (
                <div className="pt-2 border-t border-emerald-200 space-y-2">
                  <p className="text-xs font-semibold text-slate-800">
                    এই ইমেইলে আলাদা পাসওয়ার্ড সেট করুন (যাতে Gmail বাটন ছাড়াও শুধু ইমেইল-পাসওয়ার্ড দিয়ে ঢুকতে পারেন):
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleLinkPassword}
                      disabled={linkingPwd}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      {linkingPwd ? 'সেট হচ্ছে...' : 'পাসওয়ার্ড সেট করুন'}
                    </button>
                  </div>
                  {linkSuccess && (
                    <p className="text-xs font-semibold text-emerald-800">{linkSuccess}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
