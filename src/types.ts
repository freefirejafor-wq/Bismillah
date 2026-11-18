export type NumeralFormat = 'bn' | 'en';

export type HalkhataStatus = 'active' | 'closed';

export type TransactionType = 'cash' | 'bank' | 'due_added';

export type FilterStatus = 'all' | 'unpaid' | 'partial' | 'paid';

export interface ShopProfile {
  ownerId: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  activeHalkhataId: string;
  numeralFormat: NumeralFormat;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface HalkhataSession {
  id: string;
  ownerId: string;
  title: string;
  dateLabel: string;
  status: HalkhataStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Customer {
  id: string;
  ownerId: string;
  serialNo: number;
  pageNo: string;
  name: string;
  address: string;
  mobile: string;
  totalDue: number;
  cashPaid: number;
  bankPaid: number;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Transaction {
  id: string;
  ownerId: string;
  customerId: string;
  customerName: string;
  type: TransactionType;
  amount: number;
  dateStr: string;
  note: string;
  createdAt?: unknown;
}

export interface ScannedCustomerDraft {
  serialNo: number;
  pageNo: string;
  name: string;
  address: string;
  mobile: string;
  totalDue: number;
  cashPaid: number;
  bankPaid: number;
  notes: string;
  selected: boolean;
}
