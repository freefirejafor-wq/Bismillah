import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer whitespace-nowrap shadow-sm"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>অ্যাপ ইনস্টল</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer whitespace-nowrap shadow-sm"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>অ্যাপ ইনস্টল</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-slate-900">iPhone / iPad-এ অ্যাপ ইনস্টল</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                ১. Safari-এর নিচে থাকা <strong>Share</strong> আইকনে ট্যাপ করুন।<br />
                ২. নিচে স্ক্রল করে <strong>Add to Home Screen</strong>-এ ট্যাপ করুন।
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold cursor-pointer"
              >
                বুঝেছি
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
