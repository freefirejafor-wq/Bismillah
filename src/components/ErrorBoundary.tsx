import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'অপ্রত্যাশিত একটি ত্রুটি ঘটেছে।',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h1 className="text-xl font-semibold text-slate-900">
              সিস্টেমে একটি সমস্যা হয়েছে
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              অনুগ্রহ করে পেজটি রিলোড করুন। যদি Firestore অনুমতির সমস্যা হয়ে থাকে, তাহলে পুনরায় সাইন-ইন করে চেষ্টা করুন।
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-num text-slate-600 break-words max-h-32 overflow-auto">
              {this.state.errorMessage}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
            >
              পুনরায় লোড করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
