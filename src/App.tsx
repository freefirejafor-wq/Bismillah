import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Download,
  LogOut,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate.tsx';
import { CustomerModal } from './components/CustomerModal.tsx';
import { LedgerTable } from './components/LedgerTable.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { PaymentModal } from './components/PaymentModal.tsx';
import { PrintPdfView } from './components/PrintPdfView.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { ReceiptModal } from './components/ReceiptModal.tsx';
import { ShopOnboarding } from './components/ShopOnboarding.tsx';
import { ShopSettingsModal } from './components/ShopSettingsModal.tsx';
import { TransactionsView } from './components/TransactionsView.tsx';
import { INITIAL_HALKHATA_CUSTOMERS } from './data/initialLedger.ts';
import { auth, db, handleFirestoreError, OperationType } from './firebase.ts';
import type {
  Customer,
  FilterStatus,
  HalkhataSession,
  NumeralFormat,
  ShopProfile,
  Transaction,
  TransactionType,
} from './types.ts';
import {
  formatAmount,
  formatNumberText,
  getCustomerStatus,
  getRemainingBalance,
  toEnDigits,
} from './utils/bengali.ts';

type ActiveTab = 'ledger' | 'pdf' | 'transactions';

const OWNER_EMAIL = 'claudeai100ss@gmail.com';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [halkhatas, setHalkhatas] = useState<HalkhataSession[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [receiptCustomer, setReceiptCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setEmailVerified(Boolean(currentUser?.emailVerified));
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Bootstrap shop + initial 22 customers from uploaded sheet on first login
  useEffect(() => {
    if (!authReady || !user || !emailVerified) {
      setShop(null);
      setHalkhatas([]);
      setCustomers([]);
      setTransactions([]);
      setNeedsOnboarding(false);
      return;
    }

    let cancelled = false;

    async function ensureShopInitialized(currentUser: User) {
      const uid = currentUser.uid;
      const isOwner = currentUser.email?.toLowerCase() === OWNER_EMAIL;
      const shopRef = doc(db, 'shops', uid);
      try {
        const snap = await getDoc(shopRef);
        if (!snap.exists()) {
          if (!isOwner) {
            if (!cancelled) setNeedsOnboarding(true);
            return;
          }
          if (!cancelled) setBootstrapping(true);
          const defaultHalkhataId = 'halkhata_14_12_25';
          await setDoc(shopRef, {
            ownerId: uid,
            shopName: 'বিসমিল্লাহ এন্টারপ্রাইজ',
            shopAddress: 'বাদৈর বাজার, কসবা, ব্রাহ্মণবাড়িয়া',
            shopPhone: '',
            activeHalkhataId: defaultHalkhataId,
            numeralFormat: 'bn',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const halkhataRef = doc(db, 'shops', uid, 'halkhatas', defaultHalkhataId);
          await setDoc(halkhataRef, {
            ownerId: uid,
            title: 'হালখাতা ১৪.১২.২৫',
            dateLabel: '১৪.১২.২৫',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const batch = writeBatch(db);
          INITIAL_HALKHATA_CUSTOMERS.forEach((item) => {
            const custId = `cust_${String(item.serialNo).padStart(2, '0')}`;
            const custRef = doc(
              db,
              'shops',
              uid,
              'halkhatas',
              defaultHalkhataId,
              'customers',
              custId
            );
            batch.set(custRef, {
              ownerId: uid,
              serialNo: item.serialNo,
              pageNo: item.pageNo,
              name: item.name,
              address: item.address,
              mobile: item.mobile,
              totalDue: item.totalDue,
              cashPaid: item.cashPaid,
              bankPaid: item.bankPaid,
              notes: item.notes,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            if (item.cashPaid > 0) {
              const txRef = doc(
                db,
                'shops',
                uid,
                'halkhatas',
                defaultHalkhataId,
                'transactions',
                `tx_cash_${custId}`
              );
              batch.set(txRef, {
                ownerId: uid,
                customerId: custId,
                customerName: item.name,
                type: 'cash',
                amount: item.cashPaid,
                dateStr: '১৪.১২.২৫',
                note: 'হালখাতা শিট থেকে নগদ জমা',
                createdAt: serverTimestamp(),
              });
            }

            if (item.bankPaid > 0) {
              const txRef = doc(
                db,
                'shops',
                uid,
                'halkhatas',
                defaultHalkhataId,
                'transactions',
                `tx_bank_${custId}`
              );
              batch.set(txRef, {
                ownerId: uid,
                customerId: custId,
                customerName: item.name,
                type: 'bank',
                amount: item.bankPaid,
                dateStr: '১৮/৩/২৬',
                note: item.notes || 'ব্যাংক জমা',
                createdAt: serverTimestamp(),
              });
            }
          });
          await batch.commit();
        } else {
          if (!cancelled) setNeedsOnboarding(false);
          const existingData = snap.data() as Partial<ShopProfile>;
          if (isOwner && existingData.shopAddress === 'বাইদের বাজার, কসবা, ব্রাহ্মণবাড়িয়া') {
            await updateDoc(shopRef, {
              shopAddress: 'বাদৈর বাজার, কসবা, ব্রাহ্মণবাড়িয়া',
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `shops/${uid}`);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void ensureShopInitialized(user);
    return () => {
      cancelled = true;
    };
  }, [authReady, user, emailVerified]);

  // Listen to shop document
  useEffect(() => {
    if (!authReady || !user || !emailVerified) return;
    const path = `shops/${user.uid}`;
    const unsub = onSnapshot(
      doc(db, 'shops', user.uid),
      (snap) => {
        if (snap.exists()) {
          setShop(snap.data() as ShopProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, path)
    );
    return () => unsub();
  }, [authReady, user, emailVerified]);

  // Listen to halkhatas list
  useEffect(() => {
    if (!authReady || !user || !emailVerified) return;
    const path = `shops/${user.uid}/halkhatas`;
    const q = query(
      collection(db, 'shops', user.uid, 'halkhatas'),
      where('ownerId', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: HalkhataSession[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<HalkhataSession, 'id'>),
          }))
          .sort((a, b) => {
            const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
            const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
            return bSec - aSec;
          });
        setHalkhatas(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [authReady, user, emailVerified]);

  const activeHalkhataId = shop?.activeHalkhataId || halkhatas[0]?.id || '';
  const activeHalkhata =
    halkhatas.find((h) => h.id === activeHalkhataId) ?? halkhatas[0] ?? null;

  // Listen to customers & transactions for active Halkhata
  useEffect(() => {
    if (!authReady || !user || !emailVerified || !activeHalkhataId) {
      setCustomers([]);
      setTransactions([]);
      return;
    }

    const custPath = `shops/${user.uid}/halkhatas/${activeHalkhataId}/customers`;
    const custQ = query(
      collection(db, 'shops', user.uid, 'halkhatas', activeHalkhataId, 'customers'),
      where('ownerId', '==', user.uid)
    );
    const unsubCust = onSnapshot(
      custQ,
      (snap) => {
        const list: Customer[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Customer, 'id'>),
          }))
          .sort((a, b) => a.serialNo - b.serialNo);
        setCustomers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, custPath)
    );

    const txPath = `shops/${user.uid}/halkhatas/${activeHalkhataId}/transactions`;
    const txQ = query(
      collection(db, 'shops', user.uid, 'halkhatas', activeHalkhataId, 'transactions'),
      where('ownerId', '==', user.uid)
    );
    const unsubTx = onSnapshot(
      txQ,
      (snap) => {
        const list: Transaction[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Transaction, 'id'>),
          }))
          .sort((a, b) => {
            const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
            const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
            return bSec - aSec;
          });
        setTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, txPath)
    );

    return () => {
      unsubCust();
      unsubTx();
    };
  }, [authReady, user, emailVerified, activeHalkhataId]);

  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.address.trim()) set.add(c.address.trim());
    });
    return Array.from(set);
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qEn = toEnDigits(q);

    return customers.filter((c) => {
      if (statusFilter !== 'all' && getCustomerStatus(c) !== statusFilter) return false;
      if (areaFilter !== 'all' && c.address.trim() !== areaFilter) return false;
      if (q) {
        const matches =
          c.name.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.notes.toLowerCase().includes(q) ||
          toEnDigits(c.pageNo).toLowerCase().includes(qEn) ||
          toEnDigits(c.mobile).toLowerCase().includes(qEn) ||
          String(c.serialNo).includes(qEn);
        if (!matches) return false;
      }
      return true;
    });
  }, [customers, statusFilter, areaFilter, searchQuery]);

  const kpi = useMemo(() => {
    return customers.reduce(
      (acc, c) => {
        acc.totalDue += c.totalDue;
        acc.cashPaid += c.cashPaid;
        acc.bankPaid += c.bankPaid;
        acc.remaining += getRemainingBalance(c);
        return acc;
      },
      { totalDue: 0, cashPaid: 0, bankPaid: 0, remaining: 0 }
    );
  }, [customers]);

  const nextSerialNo = useMemo(() => {
    if (customers.length === 0) return 1;
    return Math.max(...customers.map((c) => c.serialNo)) + 1;
  }, [customers]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-sm text-slate-600">লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!user || !emailVerified) {
    return (
      <AuthGate
        pendingVerificationUser={user && !emailVerified ? user : null}
        onCheckVerification={async () => {
          if (!auth.currentUser) return false;
          await auth.currentUser.reload();
          await auth.currentUser.getIdToken(true);
          const verified = Boolean(auth.currentUser.emailVerified);
          setEmailVerified(verified);
          return verified;
        }}
      />
    );
  }

  if (needsOnboarding && !shop) {
    return (
      <ShopOnboarding
        userEmail={user.email ?? ''}
        onCreateShop={async (data) => {
          const uid = user.uid;
          const halkhataId = 'halkhata_1';
          try {
            await setDoc(doc(db, 'shops', uid), {
              ownerId: uid,
              shopName: data.shopName,
              shopAddress: data.shopAddress,
              shopPhone: data.shopPhone,
              activeHalkhataId: halkhataId,
              numeralFormat: 'bn',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            await setDoc(doc(db, 'shops', uid, 'halkhatas', halkhataId), {
              ownerId: uid,
              title: data.halkhataTitle,
              dateLabel: data.dateLabel,
              status: 'active',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            setNeedsOnboarding(false);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `shops/${uid}`);
          }
        }}
      />
    );
  }

  if (!shop || bootstrapping || !activeHalkhata) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-2 max-w-sm w-full">
          <p className="text-base font-semibold text-slate-900">
            দোকানের হালখাতা প্রস্তুত হচ্ছে...
          </p>
          <p className="text-xs text-slate-500">
            আপনার দোকানের হিসাব লোড করা হচ্ছে।
          </p>
        </div>
      </div>
    );
  }

  const fmt = shop.numeralFormat;
  const isClosed = activeHalkhata.status === 'closed';
  const isOwnerAccount = user.email?.toLowerCase() === OWNER_EMAIL;

  const handleSaveCustomer = async (data: {
    serialNo: number;
    pageNo: string;
    name: string;
    address: string;
    mobile: string;
    totalDue: number;
    cashPaid: number;
    bankPaid: number;
    notes: string;
  }) => {
    const path = `shops/${user.uid}/halkhatas/${activeHalkhata.id}/customers`;
    try {
      if (editingCustomer) {
        await updateDoc(
          doc(db, 'shops', user.uid, 'halkhatas', activeHalkhata.id, 'customers', editingCustomer.id),
          {
            ...data,
            updatedAt: serverTimestamp(),
          }
        );
      } else {
        const newRef = doc(collection(db, 'shops', user.uid, 'halkhatas', activeHalkhata.id, 'customers'));
        await setDoc(newRef, {
          ownerId: user.uid,
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, editingCustomer ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    const path = `shops/${user.uid}/halkhatas/${activeHalkhata.id}/customers/${deletingCustomer.id}`;
    try {
      await deleteDoc(
        doc(db, 'shops', user.uid, 'halkhatas', activeHalkhata.id, 'customers', deletingCustomer.id)
      );
      setDeletingCustomer(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handlePaymentSubmit = async ({
    customer,
    type,
    amount,
    dateStr,
    note,
  }: {
    customer: Customer;
    type: TransactionType;
    amount: number;
    dateStr: string;
    note: string;
  }) => {
    const path = `shops/${user.uid}/halkhatas/${activeHalkhata.id}`;
    try {
      const batch = writeBatch(db);
      const custRef = doc(
        db,
        'shops',
        user.uid,
        'halkhatas',
        activeHalkhata.id,
        'customers',
        customer.id
      );

      const updateFields: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (type === 'cash') {
        updateFields.cashPaid = customer.cashPaid + amount;
      } else if (type === 'bank') {
        updateFields.bankPaid = customer.bankPaid + amount;
      } else {
        updateFields.totalDue = customer.totalDue + amount;
      }
      batch.update(custRef, updateFields);

      const txRef = doc(
        collection(db, 'shops', user.uid, 'halkhatas', activeHalkhata.id, 'transactions')
      );
      batch.set(txRef, {
        ownerId: user.uid,
        customerId: customer.id,
        customerName: customer.name,
        type,
        amount,
        dateStr,
        note,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleSaveShopSettings = async (updates: {
    shopName: string;
    shopAddress: string;
    shopPhone: string;
    numeralFormat: NumeralFormat;
    activeHalkhataTitle: string;
    activeHalkhataDateLabel: string;
  }) => {
    const shopPath = `shops/${user.uid}`;
    try {
      await updateDoc(doc(db, 'shops', user.uid), {
        shopName: updates.shopName,
        shopAddress: updates.shopAddress,
        shopPhone: updates.shopPhone,
        numeralFormat: updates.numeralFormat,
        updatedAt: serverTimestamp(),
      });
      if (activeHalkhata.status === 'active') {
        await updateDoc(
          doc(db, 'shops', user.uid, 'halkhatas', activeHalkhata.id),
          {
            title: updates.activeHalkhataTitle,
            dateLabel: updates.activeHalkhataDateLabel,
            updatedAt: serverTimestamp(),
          }
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, shopPath);
    }
  };

  const handleCreateNewHalkhata = async (
    title: string,
    dateLabel: string,
    carryForwardUnpaid: boolean
  ) => {
    const newHalkhataRef = doc(collection(db, 'shops', user.uid, 'halkhatas'));
    try {
      await setDoc(newHalkhataRef, {
        ownerId: user.uid,
        title,
        dateLabel,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (carryForwardUnpaid) {
        const unpaidList = customers.filter((c) => getRemainingBalance(c) > 0);
        if (unpaidList.length > 0) {
          const batch = writeBatch(db);
          unpaidList.forEach((c, idx) => {
            const remaining = getRemainingBalance(c);
            const custRef = doc(
              collection(db, 'shops', user.uid, 'halkhatas', newHalkhataRef.id, 'customers')
            );
            batch.set(custRef, {
              ownerId: user.uid,
              serialNo: idx + 1,
              pageNo: c.pageNo,
              name: c.name,
              address: c.address,
              mobile: c.mobile,
              totalDue: remaining,
              cashPaid: 0,
              bankPaid: 0,
              notes: `পূর্বের খাতা (${activeHalkhata.dateLabel}) থেকে জের`,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
        }
      }

      await updateDoc(doc(db, 'shops', user.uid), {
        activeHalkhataId: newHalkhataRef.id,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shops/${user.uid}/halkhatas`);
    }
  };

  const handleCloseCurrentHalkhata = async () => {
    if (activeHalkhata.status === 'closed') return;
    const path = `shops/${user.uid}/halkhatas/${activeHalkhata.id}`;
    try {
      await updateDoc(doc(db, 'shops', user.uid, 'halkhatas', activeHalkhata.id), {
        status: 'closed',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleSelectHalkhata = async (halkhataId: string) => {
    try {
      await updateDoc(doc(db, 'shops', user.uid), {
        activeHalkhataId: halkhataId,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shops/${user.uid}`);
    }
  };

  const handleToggleNumeralFormat = async () => {
    const nextFmt: NumeralFormat = shop.numeralFormat === 'bn' ? 'en' : 'bn';
    try {
      await updateDoc(doc(db, 'shops', user.uid), {
        numeralFormat: nextFmt,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shops/${user.uid}`);
    }
  };

  const handleExportCsv = () => {
    const headers = ['নং', 'পৃষ্ঠা', 'নাম', 'ঠিকানা', 'মোবাইল', 'টাকা', 'জমা নগদ', 'জমা ব্যাংক', 'অবশিষ্ট বাকি', 'নোট'];
    const rows = customers.map((c) => [
      c.serialNo,
      c.pageNo,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.address.replace(/"/g, '""')}"`,
      c.mobile,
      c.totalDue,
      c.cashPaid,
      c.bankPaid,
      getRemainingBalance(c),
      `"${c.notes.replace(/"/g, '""')}"`,
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shop.shopName}_হালখাতা_${activeHalkhata.dateLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSeedInitialCustomers = async () => {
    if (isClosed) return;
    setSeeding(true);
    const path = `shops/${user.uid}/halkhatas/${activeHalkhata.id}/customers`;
    try {
      const batch = writeBatch(db);
      INITIAL_HALKHATA_CUSTOMERS.forEach((item) => {
        const custId = `cust_${String(item.serialNo).padStart(2, '0')}`;
        const custRef = doc(
          db,
          'shops',
          user.uid,
          'halkhatas',
          activeHalkhata.id,
          'customers',
          custId
        );
        batch.set(custRef, {
          ownerId: user.uid,
          serialNo: item.serialNo,
          pageNo: item.pageNo,
          name: item.name,
          address: item.address,
          mobile: item.mobile,
          totalDue: item.totalDue,
          cashPaid: item.cashPaid,
          bankPaid: item.bankPaid,
          notes: item.notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (item.cashPaid > 0) {
          const txRef = doc(
            db,
            'shops',
            user.uid,
            'halkhatas',
            activeHalkhata.id,
            'transactions',
            `tx_cash_${custId}`
          );
          batch.set(txRef, {
            ownerId: user.uid,
            customerId: custId,
            customerName: item.name,
            type: 'cash',
            amount: item.cashPaid,
            dateStr: activeHalkhata.dateLabel || '১৪.১২.২৫',
            note: 'হালখাতা শিট থেকে নগদ জমা',
            createdAt: serverTimestamp(),
          });
        }

        if (item.bankPaid > 0) {
          const txRef = doc(
            db,
            'shops',
            user.uid,
            'halkhatas',
            activeHalkhata.id,
            'transactions',
            `tx_bank_${custId}`
          );
          batch.set(txRef, {
            ownerId: user.uid,
            customerId: custId,
            customerName: item.name,
            type: 'bank',
            amount: item.bankPaid,
            dateStr: '১৮/৩/২৬',
            note: item.notes || 'ব্যাংক জমা',
            createdAt: serverTimestamp(),
          });
        }
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="no-print bg-emerald-900 text-white border-b border-emerald-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className="font-display-bn text-lg sm:text-xl font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            {shop.shopName}
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-emerald-100">
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`py-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeTab === 'ledger'
                  ? 'text-amber-300 font-bold border-b-2 border-amber-300'
                  : 'hover:text-white'
              }`}
            >
              হালখাতা খাতা
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pdf')}
              className={`py-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeTab === 'pdf'
                  ? 'text-amber-300 font-bold border-b-2 border-amber-300'
                  : 'hover:text-white'
              }`}
            >
              PDF ও প্রিন্ট
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`py-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeTab === 'transactions'
                  ? 'text-amber-300 font-bold border-b-2 border-amber-300'
                  : 'hover:text-white'
              }`}
            >
              লেনদেন ইতিহাস
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              disabled={isClosed}
              onClick={() => {
                setEditingCustomer(null);
                setCustomerModalOpen(true);
              }}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-emerald-950 bg-amber-300 hover:bg-amber-200 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন কাস্টমার</span>
            </button>
          </div>
        </div>

        {/* Mobile navigation row */}
        <div className="md:hidden grid grid-cols-3 border-t border-emerald-800 bg-emerald-950/60 text-xs font-semibold text-emerald-100">
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`py-2.5 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'ledger'
                ? 'text-amber-300 border-amber-300 bg-emerald-900'
                : 'border-transparent'
            }`}
          >
            খাতা
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`py-2.5 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'pdf'
                ? 'text-amber-300 border-amber-300 bg-emerald-900'
                : 'border-transparent'
            }`}
          >
            PDF ও প্রিন্ট
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`py-2.5 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'transactions'
                ? 'text-amber-300 border-amber-300 bg-emerald-900'
                : 'border-transparent'
            }`}
          >
            লেনদেন ইতিহাস
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
        {/* Workspace Context Card + Utility Controls (Hidden on Print) */}
        <section className="no-print bg-white border border-emerald-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          <div className="space-y-1">
            <p className="text-sm sm:text-base font-bold text-slate-900">
              {shop.shopAddress}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-700">
              <span className="font-bold text-emerald-800">
                {formatNumberText(activeHalkhata.title, fmt)}
                {activeHalkhata.dateLabel && !activeHalkhata.title.includes(activeHalkhata.dateLabel)
                  ? ` (${formatNumberText(activeHalkhata.dateLabel, fmt)})`
                  : ''}
              </span>
              <span aria-hidden="true">·</span>
              <span className={isClosed ? 'text-amber-700 font-semibold' : 'text-teal-700 font-semibold'}>
                {isClosed ? 'আর্কাইভ করা' : 'চলমান খাতা'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <PWAInstallButton />
            <button
              type="button"
              onClick={handleToggleNumeralFormat}
              className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 hover:bg-indigo-100 cursor-pointer whitespace-nowrap"
            >
              {fmt === 'bn' ? 'সংখ্যা: ১২৩' : 'Digits: 123'}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 hover:bg-emerald-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 hover:bg-amber-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>সেটিংস</span>
            </button>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 hover:bg-rose-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>লগআউট</span>
            </button>
          </div>
        </section>

        {/* 4-Column Color-Coded KPI Summary Cards */}
        <section className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-4 sm:p-5">
            <p className="text-xs sm:text-sm font-bold text-indigo-900">
              মোট পাওনা ({formatNumberText(customers.length, fmt)} জন)
            </p>
            <p className="mt-1.5 text-xl sm:text-2xl font-bold text-indigo-950 font-mono-num">
              {formatAmount(kpi.totalDue, fmt)} ৳
            </p>
          </div>
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 sm:p-5">
            <p className="text-xs sm:text-sm font-bold text-emerald-900">মোট নগদ জমা</p>
            <p className="mt-1.5 text-xl sm:text-2xl font-bold text-emerald-800 font-mono-num">
              {formatAmount(kpi.cashPaid, fmt)} ৳
            </p>
          </div>
          <div className="bg-sky-50/90 border border-sky-200 rounded-2xl p-4 sm:p-5">
            <p className="text-xs sm:text-sm font-bold text-sky-900">ব্যাংক / বিকাশ জমা</p>
            <p className="mt-1.5 text-xl sm:text-2xl font-bold text-sky-800 font-mono-num">
              {formatAmount(kpi.bankPaid, fmt)} ৳
            </p>
          </div>
          <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-4 sm:p-5">
            <p className="text-xs sm:text-sm font-bold text-rose-900">অবশিষ্ট বাকি</p>
            <p className="mt-1.5 text-xl sm:text-2xl font-bold text-rose-700 font-mono-num">
              {formatAmount(kpi.remaining, fmt)} ৳
            </p>
          </div>
        </section>

        {activeTab === 'ledger' && (
          <section className="space-y-4">
            {/* Search & Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3 lg:space-y-0 lg:flex lg:items-center lg:justify-between lg:gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <div className="relative">
                  <Search className="w-4 h-4 text-emerald-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="নাম, পৃষ্ঠা নং, মোবাইল বা এলাকা খুঁজুন..."
                    className="w-full pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl bg-white text-slate-800"
                >
                  <option value="all">সকল এলাকা / পাড়া</option>
                  {uniqueAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold lg:w-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap text-center ${
                    statusFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-700'
                  }`}
                >
                  সবাই
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('unpaid')}
                  className={`px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap text-center ${
                    statusFilter === 'unpaid'
                      ? 'bg-rose-700 text-white'
                      : 'text-rose-700'
                  }`}
                >
                  বাকি
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('partial')}
                  className={`px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap text-center ${
                    statusFilter === 'partial'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-800'
                  }`}
                >
                  আংশিক
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('paid')}
                  className={`px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap text-center ${
                    statusFilter === 'paid'
                      ? 'bg-emerald-700 text-white'
                      : 'text-emerald-800'
                  }`}
                >
                  পরিশোধ
                </button>
              </div>
            </div>

            <LedgerTable
              customers={filteredCustomers}
              totalCustomersCount={customers.length}
              shop={shop}
              halkhata={activeHalkhata}
              isClosed={isClosed}
              seeding={seeding}
              onAddFirst={() => {
                setEditingCustomer(null);
                setCustomerModalOpen(true);
              }}
              onSeedInitial={isOwnerAccount ? handleSeedInitialCustomers : undefined}
              onQuickPay={(c) => setPayingCustomer(c)}
              onEditCustomer={(c) => {
                setEditingCustomer(c);
                setCustomerModalOpen(true);
              }}
              onDeleteCustomer={(c) => setDeletingCustomer(c)}
              onShowReceipt={(c) => setReceiptCustomer(c)}
            />
          </section>
        )}

        {activeTab === 'pdf' && (
          <PrintPdfView customers={customers} shop={shop} halkhata={activeHalkhata} />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView transactions={transactions} numeralFormat={fmt} />
        )}
      </main>

      {/* Modals */}
      <CustomerModal
        open={customerModalOpen}
        customer={editingCustomer}
        nextSerialNo={nextSerialNo}
        numeralFormat={fmt}
        onClose={() => {
          setCustomerModalOpen(false);
          setEditingCustomer(null);
        }}
        onSave={handleSaveCustomer}
      />

      <PaymentModal
        open={Boolean(payingCustomer)}
        customer={payingCustomer}
        numeralFormat={fmt}
        onClose={() => setPayingCustomer(null)}
        onSubmit={handlePaymentSubmit}
      />

      <ReceiptModal
        customer={receiptCustomer}
        shop={shop}
        halkhata={activeHalkhata}
        onClose={() => setReceiptCustomer(null)}
      />

      <ShopSettingsModal
        open={settingsOpen}
        shop={shop}
        activeHalkhata={activeHalkhata}
        halkhatas={halkhatas}
        onClose={() => setSettingsOpen(false)}
        onSaveShop={handleSaveShopSettings}
        onCreateNewHalkhata={handleCreateNewHalkhata}
        onCloseCurrentHalkhata={handleCloseCurrentHalkhata}
        onSelectHalkhata={handleSelectHalkhata}
      />

      {deletingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">কাস্টমার মুছে ফেলবেন?</h3>
            <p className="text-sm text-slate-600">
              আপনি কি নিশ্চিতভাবে <strong>{deletingCustomer.name}</strong>-এর হিসাব তালিকা থেকে মুছে ফেলতে চান?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
      <OfflineIndicator />
    </div>
  );
}
