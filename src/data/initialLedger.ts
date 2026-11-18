export interface SeedCustomerItem {
  serialNo: number;
  pageNo: string;
  name: string;
  address: string;
  mobile: string;
  totalDue: number;
  cashPaid: number;
  bankPaid: number;
  notes: string;
}

/**
 * Pre-transcribed 22 customer entries from the merchant's uploaded Halkhata sheet (১৪.১২.২৫).
 */
export const INITIAL_HALKHATA_CUSTOMERS: SeedCustomerItem[] = [
  { serialNo: 1, pageNo: '', name: 'মেহের আলি', address: '', mobile: '', totalDue: 6814, cashPaid: 0, bankPaid: 0, notes: '' },
  { serialNo: 2, pageNo: '', name: 'জমসিদ', address: 'নিমবাড়ি', mobile: '01790589869', totalDue: 7550, cashPaid: 5000, bankPaid: 0, notes: '' },
  { serialNo: 3, pageNo: '', name: 'নুরুল ইসলাম', address: '', mobile: '', totalDue: 4963, cashPaid: 2000, bankPaid: 0, notes: '' },
  { serialNo: 4, pageNo: '172', name: 'রত্না', address: '', mobile: '', totalDue: 26310, cashPaid: 0, bankPaid: 0, notes: '' },
  { serialNo: 5, pageNo: '171', name: 'আব্দুল কাদের পদ্মা', address: '', mobile: '', totalDue: 36338, cashPaid: 0, bankPaid: 0, notes: '' },
  { serialNo: 6, pageNo: '294', name: 'লাবিব মৃধা', address: '', mobile: '', totalDue: 10904, cashPaid: 0, bankPaid: 0, notes: 'পৃষ্ঠা ২৯৪ সংশোধিত' },
  { serialNo: 7, pageNo: '240', name: 'নোয়াব', address: 'পূর্ব পাড়া', mobile: '', totalDue: 24622, cashPaid: 2000, bankPaid: 0, notes: '' },
  { serialNo: 8, pageNo: '244', name: 'আতিক', address: 'নূর পাড়া', mobile: '01741026039', totalDue: 111490, cashPaid: 0, bankPaid: 0, notes: '' },
  { serialNo: 9, pageNo: '253', name: 'শিপন চেয়ারম্যান', address: '', mobile: '', totalDue: 309959, cashPaid: 0, bankPaid: 0, notes: '' },
  { serialNo: 10, pageNo: '255', name: 'তাজু কাকা', address: '', mobile: '', totalDue: 30400, cashPaid: 0, bankPaid: 0, notes: '' },
  { serialNo: 11, pageNo: '258', name: 'হূসেন কাকা', address: '', mobile: '', totalDue: 100960, cashPaid: 0, bankPaid: 0, notes: '' },
  { serialNo: 12, pageNo: '', name: 'কামাল আবুল ফারার ছেলে', address: '', mobile: '01614420552', totalDue: 12906, cashPaid: 5000, bankPaid: 0, notes: '' },
  { serialNo: 13, pageNo: '', name: 'আঁখি', address: '', mobile: '', totalDue: 19019, cashPaid: 10000, bankPaid: 0, notes: '' },
  { serialNo: 14, pageNo: '272', name: 'মস্তফা মোছলিমের ছেলে', address: '', mobile: '', totalDue: 50000, cashPaid: 30000, bankPaid: 5000, notes: 'ব্যাংক জমা ১৮/৩/২৬ = ৫০০০' },
  { serialNo: 15, pageNo: '281', name: 'বাচ্চু মৃধা', address: 'শিকারপুর', mobile: '', totalDue: 17325, cashPaid: 0, bankPaid: 0, notes: 'পূর্বের নাম রামু মৃধা' },
  { serialNo: 16, pageNo: '295', name: 'লিয়াকত মৃধা', address: 'শিকারপুর', mobile: '', totalDue: 159723, cashPaid: 0, bankPaid: 0, notes: '' },
  { serialNo: 17, pageNo: '300', name: 'লিটন এডু দাদার ছেলে', address: '', mobile: '01325700873', totalDue: 31556, cashPaid: 0, bankPaid: 0, notes: '' },
  { serialNo: 18, pageNo: '305', name: 'রফিক রেহমান কাকার ছেলে', address: '', mobile: '01722785848', totalDue: 172050, cashPaid: 0, bankPaid: 0, notes: '' },
  { serialNo: 19, pageNo: '309', name: 'শাহিন', address: 'নিমবাড়ি', mobile: '01585020213', totalDue: 34532, cashPaid: 0, bankPaid: 0, notes: 'পূর্বের নাম মাহান' },
  { serialNo: 20, pageNo: '314', name: 'রতন কাজী', address: '', mobile: '01711021848', totalDue: 99259, cashPaid: 20000, bankPaid: 0, notes: '' },
  { serialNo: 21, pageNo: '317', name: 'জানু', address: 'শিকারপুর', mobile: '01783430189', totalDue: 21660, cashPaid: 5000, bankPaid: 0, notes: '' },
  { serialNo: 22, pageNo: '318', name: 'সুমন মৃধা', address: 'শিকারপুর', mobile: '01789646649', totalDue: 159678, cashPaid: 0, bankPaid: 0, notes: '' },
];
