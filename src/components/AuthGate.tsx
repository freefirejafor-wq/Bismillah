import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase.ts';

interface AuthGateProps {
  pendingVerificationUser?: User | null;
  onCheckVerification?: () => Promise<boolean>;
}

function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Firebase Console > Authentication > Sign-in method থেকে Email/Password চালু করা নেই। নিচের নির্দেশনা দেখে চালু করুন অথবা Google দিয়ে প্রবেশ করুন।';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।';
    case 'auth/email-already-in-use':
      return 'এই ইমেইলে আগেই অ্যাকাউন্ট তৈরি করা আছে। "লগইন" ট্যাবে গিয়ে পাসওয়ার্ড দিয়ে প্রবেশ করুন।';
    case 'auth/weak-password':
      return 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।';
    case 'auth/invalid-email':
      return 'সঠিক ইমেইল ঠিকানা লিখুন।';
    case 'auth/too-many-requests':
      return 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
    case 'auth/popup-closed-by-user':
      return 'Google সাইন-ইন পপআপ বন্ধ হয়ে গেছে। আবার চেষ্টা করুন।';
    default:
      return err instanceof Error ? err.message : 'সাইন-ইন করা যায়নি।';
  }
}

export function AuthGate({
  pendingVerificationUser,
  onCheckVerification,
}: AuthGateProps) {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [checkingVerify, setCheckingVerify] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);
    setError(null);
    setNotice(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('ইমেইল ঠিকানা লিখুন।');
      return;
    }
    if (password.length < 6) {
      setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }

    setLoadingEmail(true);
    setError(null);
    setNotice(null);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await sendEmailVerification(cred.user);
        setNotice('অ্যাকাউন্ট তৈরি হয়েছে! আপনার ইমেইলে পাঠানো ভেরিফিকেশন লিংকে ক্লিক করুন।');
      }
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('পাসওয়ার্ড রিসেট করতে আগে আপনার ইমেইল লিখুন।');
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setNotice('পাসওয়ার্ড রিসেট করার লিংক আপনার ইমেইলে পাঠানো হয়েছে।');
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    }
  };

  const handleVerifyCheck = async () => {
    if (!onCheckVerification) return;
    setCheckingVerify(true);
    setError(null);
    setNotice(null);
    try {
      const ok = await onCheckVerification();
      if (!ok) {
        setError('ইমেইল এখনো ভেরিফাই হয়নি। ইনবক্স (বা Spam ফোল্ডার) থেকে লিংকে ক্লিক করে আবার চাপুন।');
      }
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setCheckingVerify(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationUser) return;
    setResendingVerify(true);
    setError(null);
    setNotice(null);
    try {
      await sendEmailVerification(pendingVerificationUser);
      setNotice('নতুন ভেরিফিকেশন লিংক পাঠানো হয়েছে। ইনবক্স বা Spam চেক করুন।');
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setResendingVerify(false);
    }
  };

  if (pendingVerificationUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-bold text-emerald-700">ইমেইল ভেরিফিকেশন প্রয়োজন</p>
            <h2 className="font-display-bn text-2xl font-bold text-slate-900">
              আপনার ইমেইল নিশ্চিত করুন
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              ডাটা নিরাপত্তার জন্য <strong className="text-slate-900">{pendingVerificationUser.email}</strong> ঠিকানায় একটি ভেরিফিকেশন লিংক পাঠানো হয়েছে। ইমেইলের লিংকে ক্লিক করে নিচের বাটনে চাপুন।
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800">
              {notice}
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleVerifyCheck}
              disabled={checkingVerify}
              className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{checkingVerify ? 'যাচাই হচ্ছে...' : 'ভেরিফাই সম্পন্ন, খাতায় প্রবেশ করুন'}</span>
            </button>

            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendingVerify}
              className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{resendingVerify ? 'পাঠানো হচ্ছে...' : 'পুনরায় ভেরিফিকেশন লিংক পাঠান'}</span>
            </button>

            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
            >
              লগআউট করে Google / অন্য ইমেইল দিয়ে ঢুকুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full mx-auto bg-white border border-emerald-200 rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-5">
        <div className="md:col-span-3 p-7 sm:p-10 flex flex-col justify-between space-y-8 border-b md:border-b-0 md:border-r border-slate-200">
          <div className="space-y-3">
            <p className="text-xs font-bold text-emerald-700 tracking-wide">
              সকল দোকানের জন্য সহজ বকেয়া ও হালখাতা
            </p>
            <h1 className="font-display-bn text-3xl font-bold text-slate-900 leading-tight">
              ডিজিটাল হালখাতা খাতা
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              আপনার দোকানের সকল কাস্টমারের বকেয়া, নগদ জমা, ব্যাংক/বিকাশ জমা, রসিদ এবং রঙিন A4 PDF খাতা এক জায়গায়।
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900">ক্লাউড ও অফলাইন ব্যাকআপ — ডাটা হারাবে না</p>
                <p className="text-xs text-slate-600">
                  একই ইমেইল বা Google অ্যাকাউন্ট দিয়ে লগইন করলে যেকোনো মোবাইল থেকেই আগের সব হিসাব ফিরে পাবেন।
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900">হুবহু কাগজের শিটের মতো A4 PDF ও রসিদ</p>
                <p className="text-xs text-slate-600">প্রতি পেইজে ২২ জন করে আলাদা বা সব পেইজ একসাথে রঙিন PDF ডাউনলোড সুবিধা।</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900">সহজ নগদ-ব্যাংক জমা ও WhatsApp তাগাদা</p>
                <p className="text-xs text-slate-600">তারিখসহ টাকা জমার হিসাব রাখা এবং এক ক্লিকে কাস্টমারকে কল বা WhatsApp মেসেজ পাঠানো।</p>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 p-7 sm:p-8 bg-slate-50/80 flex flex-col justify-center space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">দোকানের খাতায় প্রবেশ করুন</h2>
            <p className="text-xs text-slate-600">
              Google অথবা আপনার নিজস্ব ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 leading-relaxed">
              {error}
            </div>
          )}
          {notice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 leading-relaxed">
              {notice}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loadingGoogle || loadingEmail}
            className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{loadingGoogle ? 'প্রবেশ করা হচ্ছে...' : 'Google / Gmail দিয়ে প্রবেশ করুন'}</span>
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-300" />
            <span className="shrink mx-3 text-[11px] font-semibold text-slate-500">
              অথবা ইমেইল ও পাসওয়ার্ড
            </span>
            <div className="flex-grow border-t border-slate-300" />
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/80 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError(null);
                setNotice(null);
              }}
              className={`py-2 rounded-lg cursor-pointer ${
                authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              লগইন করুন
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setError(null);
                setNotice(null);
              }}
              className={`py-2 rounded-lg cursor-pointer ${
                authMode === 'signup' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              নতুন অ্যাকাউন্ট
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ইমেইল ঠিকানা
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">পাসওয়ার্ড</label>
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] font-semibold text-indigo-700 hover:underline cursor-pointer"
                  >
                    পাসওয়ার্ড ভুলে গেছেন?
                  </button>
                )}
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষর"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingEmail || loadingGoogle}
              className="w-full py-2.5 px-4 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
            >
              {loadingEmail
                ? 'অপেক্ষা করুন...'
                : authMode === 'login'
                ? 'ইমেইল দিয়ে লগইন করুন'
                : 'ইমেইল দিয়ে অ্যাকাউন্ট খুলুন'}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            আপনার আগের Google অ্যাকাউন্টের হিসাব ঠিক রাখতে চাইলে আগে Google দিয়ে ঢুকে সেটিংস থেকে পাসওয়ার্ড সেট করে নিতে পারবেন।
          </p>
        </div>
      </div>
    </div>
  );
}
