import { jsPDF } from 'jspdf';
import type { Customer, HalkhataSession, ShopProfile } from '../types.ts';
import {
  formatAmount,
  formatNumberText,
  formatSerial,
  getRemainingBalance,
  getTodayDateLabel,
} from './bengali.ts';

export interface GeneratedPdfResult {
  blob: Blob;
  url: string;
  fileName: string;
}

const BN_FONT = '"Noto Sans Bengali", "Hind Siliguri", system-ui, sans-serif';
const BN_DISPLAY_FONT = '"Tiro Bangla", "Noto Sans Bengali", "Hind Siliguri", serif';

async function ensurePdfFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('500 25px "Noto Sans Bengali"'),
      document.fonts.load('600 25px "Noto Sans Bengali"'),
      document.fonts.load('700 25px "Noto Sans Bengali"'),
      document.fonts.load('700 52px "Tiro Bangla"'),
      document.fonts.ready,
    ]);
  } catch {
    await document.fonts.ready;
  }
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function splitIntoLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function drawCellText(
  ctx: CanvasRenderingContext2D,
  text: string,
  textX: number,
  centerY: number,
  maxWidth: number,
  weight: string,
  baseSize: number,
  allowWrap: boolean
): void {
  if (!text) return;

  ctx.font = `${weight} ${baseSize}px ${BN_FONT}`;
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, textX, centerY + 1);
    return;
  }

  if (allowWrap) {
    const candidateSizes = [22, 20, 18, 16];
    for (const fontSize of candidateSizes) {
      ctx.font = `${weight} ${fontSize}px ${BN_FONT}`;
      const lines = splitIntoLines(ctx, text, maxWidth);
      if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxWidth)) {
        const step = fontSize + 5;
        if (lines.length === 1) {
          ctx.fillText(lines[0], textX, centerY + 1);
        } else {
          ctx.fillText(lines[0], textX, centerY - step / 2 + 1);
          ctx.fillText(lines[1], textX, centerY + step / 2 + 1);
        }
        return;
      }
    }

    // Fallback for 3+ lines or unspaced long strings: wrap at 17px up to 2 lines
    ctx.font = `${weight} 17px ${BN_FONT}`;
    const lines = splitIntoLines(ctx, text, maxWidth);
    if (lines.length >= 2) {
      const step = 22;
      const line1 = fitText(ctx, lines[0], maxWidth);
      const line2 = fitText(ctx, lines.slice(1).join(' '), maxWidth);
      ctx.fillText(line1, textX, centerY - step / 2 + 1);
      ctx.fillText(line2, textX, centerY + step / 2 + 1);
      return;
    }
  } else {
    for (const fontSize of [23, 21, 19]) {
      ctx.font = `${weight} ${fontSize}px ${BN_FONT}`;
      if (ctx.measureText(text).width <= maxWidth) {
        ctx.fillText(text, textX, centerY + 1);
        return;
      }
    }
  }

  ctx.fillText(fitText(ctx, text, maxWidth), textX, centerY + 1);
}

export function triggerPdfDownload(blob: Blob, fileName: string): string {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
  }, 1500);
  return url;
}

export async function generateHalkhataLedgerPdf(options: {
  customers: Customer[];
  shop: ShopProfile;
  halkhata: HalkhataSession;
  printMode: 'filled' | 'blank_deposit';
  showRemainingCol: boolean;
  onlyPageIndex?: number;
}): Promise<GeneratedPdfResult> {
  await ensurePdfFontsLoaded();

  const { customers, shop, halkhata, printMode, showRemainingCol, onlyPageIndex } = options;
  const fmt = shop.numeralFormat;
  const includeRemaining = printMode === 'filled' && showRemainingCol;

  // A4 at 200 DPI: 1654 x 2339
  const PAGE_W = 1654;
  const PAGE_H = 2339;
  const MARGIN_X = 52;
  const MARGIN_TOP = 54;
  const CONTENT_W = PAGE_W - MARGIN_X * 2; // 1550
  const ROWS_PER_PAGE = 22;

  const chunks: Customer[][] = [];
  for (let i = 0; i < customers.length; i += ROWS_PER_PAGE) {
    chunks.push(customers.slice(i, i + ROWS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  const grandTotals = customers.reduce(
    (acc, c) => {
      acc.totalDue += c.totalDue;
      acc.cashPaid += c.cashPaid;
      acc.bankPaid += c.bankPaid;
      acc.remaining += getRemainingBalance(c);
      return acc;
    },
    { totalDue: 0, cashPaid: 0, bankPaid: 0, remaining: 0 }
  );

  interface ColDef {
    label: string;
    width: number;
    align: 'left' | 'center' | 'right';
    headerBg: string;
    cellBg?: string;
    allowWrap?: boolean;
  }

  const cols: ColDef[] = includeRemaining
    ? [
        { label: 'নং', width: 54, align: 'center', headerBg: '#064e3b' },
        { label: 'পৃষ্ঠা', width: 70, align: 'center', headerBg: '#064e3b' },
        { label: 'নাম', width: 430, align: 'left', headerBg: '#064e3b', allowWrap: true },
        { label: 'ঠিকানা', width: 196, align: 'left', headerBg: '#064e3b', allowWrap: true },
        { label: 'মোবাইল', width: 195, align: 'left', headerBg: '#064e3b' },
        { label: 'টাকা', width: 155, align: 'right', headerBg: '#312e81', cellBg: '#eef2ff' },
        { label: 'জমা নগদ', width: 148, align: 'right', headerBg: '#047857', cellBg: '#ecfdf5' },
        { label: 'জমা ব্যাংক', width: 150, align: 'right', headerBg: '#075985', cellBg: '#f0f9ff' },
        { label: 'বাকি', width: 152, align: 'right', headerBg: '#9f1239', cellBg: '#fff1f2' },
      ]
    : [
        { label: 'নং', width: 58, align: 'center', headerBg: '#064e3b' },
        { label: 'পৃষ্ঠা', width: 76, align: 'center', headerBg: '#064e3b' },
        { label: 'নাম', width: 466, align: 'left', headerBg: '#064e3b', allowWrap: true },
        { label: 'ঠিকানা', width: 210, align: 'left', headerBg: '#064e3b', allowWrap: true },
        { label: 'মোবাইল', width: 210, align: 'left', headerBg: '#064e3b' },
        { label: 'টাকা', width: 180, align: 'right', headerBg: '#312e81', cellBg: '#eef2ff' },
        { label: 'জমা নগদ', width: 175, align: 'right', headerBg: '#047857', cellBg: '#ecfdf5' },
        { label: 'জমা ব্যাংক', width: 175, align: 'right', headerBg: '#075985', cellBg: '#f0f9ff' },
      ];

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ক্যানভাস চালু করা যায়নি।');
  }

  const targetIndices =
    typeof onlyPageIndex === 'number' && onlyPageIndex >= 0 && onlyPageIndex < chunks.length
      ? [onlyPageIndex]
      : chunks.map((_, idx) => idx);

  for (let renderIdx = 0; renderIdx < targetIndices.length; renderIdx++) {
    const pageIdx = targetIndices[renderIdx];
    const pageRows = chunks[pageIdx];
    const isLastPage = pageIdx === chunks.length - 1;

    // White page background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    // Colorful Emerald Masthead Banner
    const BANNER_H = shop.shopPhone ? 196 : 164;
    ctx.fillStyle = '#ecfdf5';
    ctx.fillRect(MARGIN_X, MARGIN_TOP, CONTENT_W, BANNER_H);
    ctx.strokeStyle = '#065f46';
    ctx.lineWidth = 3;
    ctx.strokeRect(MARGIN_X, MARGIN_TOP, CONTENT_W, BANNER_H);

    // Top gold accent strip inside masthead
    ctx.fillStyle = '#065f46';
    ctx.fillRect(MARGIN_X, MARGIN_TOP, CONTENT_W, 10);

    let y = MARGIN_TOP + 26;
    ctx.fillStyle = '#064e3b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold 52px ${BN_DISPLAY_FONT}`;
    ctx.fillText(shop.shopName, PAGE_W / 2, y);

    y += 62;
    ctx.fillStyle = '#0f172a';
    ctx.font = `600 25px ${BN_FONT}`;
    ctx.fillText(shop.shopAddress, PAGE_W / 2, y);

    if (shop.shopPhone) {
      y += 34;
      ctx.fillStyle = '#047857';
      ctx.font = `700 23px ${BN_FONT}`;
      ctx.fillText(`মোবাইল: ${formatNumberText(shop.shopPhone, fmt)}`, PAGE_W / 2, y);
    }

    // Sub-bar inside masthead bottom
    const subY = MARGIN_TOP + BANNER_H - 40;
    ctx.fillStyle = '#065f46';
    ctx.font = `700 23px ${BN_FONT}`;
    ctx.textAlign = 'left';
    const pageTag =
      chunks.length > 1
        ? `${formatNumberText(halkhata.title, fmt)} (পাতা ${formatNumberText(pageIdx + 1, fmt)}/${formatNumberText(chunks.length, fmt)})`
        : formatNumberText(halkhata.title, fmt);
    ctx.fillText(pageTag, MARGIN_X + 20, subY);

    ctx.fillStyle = '#9f1239';
    ctx.font = `700 24px ${BN_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`তারিখ: ${formatNumberText(halkhata.dateLabel, fmt)}`, PAGE_W - MARGIN_X - 20, subY);

    y = MARGIN_TOP + BANNER_H + 18;

    // Colored Table Header
    const HEADER_H = 64;
    let hx = MARGIN_X;
    cols.forEach((col) => {
      ctx.fillStyle = col.headerBg;
      ctx.fillRect(hx, y, col.width, HEADER_H);
      hx += col.width;
    });

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.strokeRect(MARGIN_X, y, CONTENT_W, HEADER_H);

    let x = MARGIN_X;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 25px ${BN_FONT}`;
    ctx.textBaseline = 'middle';

    cols.forEach((col, colIdx) => {
      if (colIdx > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + HEADER_H);
        ctx.stroke();
      }
      ctx.textAlign = col.align;
      const textX =
        col.align === 'center'
          ? x + col.width / 2
          : col.align === 'right'
          ? x + col.width - 12
          : x + 12;
      ctx.fillText(col.label, textX, y + HEADER_H / 2 + 1);
      x += col.width;
    });

    y += HEADER_H;

    // Table Rows (22 rows per page)
    const ROW_H = 78;
    if (pageRows.length === 0) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(MARGIN_X, y, CONTENT_W, 120);
      ctx.fillStyle = '#64748b';
      ctx.font = `600 25px ${BN_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('কোনো কাস্টমার তথ্য পাওয়া যায়নি', PAGE_W / 2, y + 60);
      y += 120;
    } else {
      pageRows.forEach((c, rowIdx) => {
        const zebraBg = rowIdx % 2 === 1 ? '#f8fafc' : '#ffffff';

        // Column background fills first
        let bgX = MARGIN_X;
        cols.forEach((col) => {
          ctx.fillStyle = col.cellBg ?? zebraBg;
          ctx.fillRect(bgX, y, col.width, ROW_H);
          bgX += col.width;
        });

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(MARGIN_X, y, CONTENT_W, ROW_H);

        const remaining = getRemainingBalance(c);
        const cells: Array<{ text: string; color: string; bold?: boolean; size?: number }> = [
          { text: formatSerial(c.serialNo, fmt), color: '#064e3b', bold: true, size: 25 },
          { text: c.pageNo ? formatNumberText(c.pageNo, fmt) : '—', color: '#334155', bold: true, size: 24 },
          { text: c.name, color: '#0f172a', bold: true, size: 25 },
          { text: c.address, color: '#1e293b', bold: false, size: 24 },
          { text: c.mobile ? formatNumberText(c.mobile, fmt) : '—', color: '#0f172a', bold: true, size: 25 },
          { text: formatAmount(c.totalDue, fmt), color: '#1e1b4b', bold: true, size: 25 },
          {
            text: printMode === 'filled' && c.cashPaid > 0 ? formatAmount(c.cashPaid, fmt) : '',
            color: '#065f46',
            bold: true,
            size: 25,
          },
          {
            text: printMode === 'filled' && c.bankPaid > 0 ? formatAmount(c.bankPaid, fmt) : '',
            color: '#075985',
            bold: true,
            size: 25,
          },
        ];
        if (includeRemaining) {
          cells.push({
            text: formatAmount(remaining, fmt),
            color: remaining <= 0 ? '#047857' : '#be123c',
            bold: true,
            size: 25,
          });
        }

        let cx = MARGIN_X;
        cols.forEach((col, colIdx) => {
          if (colIdx > 0) {
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx, y);
            ctx.lineTo(cx, y + ROW_H);
            ctx.stroke();
          }
          const cell = cells[colIdx];
          ctx.fillStyle = cell.color;
          ctx.textAlign = col.align;
          const textX =
            col.align === 'center'
              ? cx + col.width / 2
              : col.align === 'right'
              ? cx + col.width - 10
              : cx + 10;
          drawCellText(
            ctx,
            cell.text,
            textX,
            y + ROW_H / 2,
            col.width - 18,
            cell.bold ? '700' : '600',
            cell.size ?? 25,
            Boolean(col.allowWrap)
          );
          cx += col.width;
        });

        y += ROW_H;
      });
    }

    // Colored Grand Totals row on last page
    if (isLastPage && customers.length > 0) {
      const TOTAL_H = 76;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(MARGIN_X, y, CONTENT_W, TOTAL_H);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.strokeRect(MARGIN_X, y, CONTENT_W, TOTAL_H);

      const labelSpanWidth = cols.slice(0, 5).reduce((s, col) => s + col.width, 0);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 25px ${BN_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(
        `সর্বমোট (${formatNumberText(customers.length, fmt)} জন):`,
        MARGIN_X + labelSpanWidth - 14,
        y + TOTAL_H / 2 + 1
      );

      let tx = MARGIN_X + labelSpanWidth;
      const totalValues = [
        { text: formatAmount(grandTotals.totalDue, fmt), color: '#c7d2fe' },
        {
          text: printMode === 'filled' ? formatAmount(grandTotals.cashPaid, fmt) : '',
          color: '#6ee7b7',
        },
        {
          text: printMode === 'filled' ? formatAmount(grandTotals.bankPaid, fmt) : '',
          color: '#7dd3fc',
        },
      ];
      if (includeRemaining) {
        totalValues.push({
          text: formatAmount(grandTotals.remaining, fmt),
          color: '#fcd34d',
        });
      }

      cols.slice(5).forEach((col, i) => {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx, y);
        ctx.lineTo(tx, y + TOTAL_H);
        ctx.stroke();

        const tv = totalValues[i];
        ctx.fillStyle = tv.color;
        ctx.font = `700 25px ${BN_FONT}`;
        ctx.textAlign = 'right';
        ctx.fillText(fitText(ctx, tv.text, col.width - 18), tx + col.width - 12, y + TOTAL_H / 2 + 1);
        tx += col.width;
      });
    }

    // Footer
    ctx.fillStyle = '#065f46';
    ctx.font = `600 21px ${BN_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(shop.shopName, MARGIN_X, PAGE_H - 44);
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'right';
    ctx.fillText(`প্রিন্ট তারিখ: ${getTodayDateLabel(fmt)}`, PAGE_W - MARGIN_X, PAGE_H - 44);

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    if (renderIdx > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
  }

  const blob = pdf.output('blob');
  const safeDate = halkhata.dateLabel.replace(/[^\w\u0980-\u09FF.-]+/g, '_');
  const fileName =
    typeof onlyPageIndex === 'number'
      ? `Bismillah_Halkhata_${safeDate}_Page_${onlyPageIndex + 1}.pdf`
      : `Bismillah_Halkhata_${safeDate}_All.pdf`;
  const url = triggerPdfDownload(blob, fileName);

  return { blob, url, fileName };
}

export async function generateCustomerReceiptPdf(options: {
  customer: Customer;
  shop: ShopProfile;
  halkhata: HalkhataSession;
}): Promise<GeneratedPdfResult> {
  await ensurePdfFontsLoaded();

  const { customer, shop, halkhata } = options;
  const fmt = shop.numeralFormat;
  const remaining = getRemainingBalance(customer);
  const totalPaid = customer.cashPaid + customer.bankPaid;

  // A5 portrait at 200 DPI: 1165 x 1654
  const W = 1165;
  const H = 1654;
  const MX = 80;
  const CW = W - MX * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ক্যানভাস চালু করা যায়নি।');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#065f46';
  ctx.lineWidth = 3;
  ctx.strokeRect(45, 45, W - 90, H - 90);

  // Colored Emerald Receipt Header
  ctx.fillStyle = '#ecfdf5';
  ctx.fillRect(47, 47, W - 94, 210);
  ctx.fillStyle = '#065f46';
  ctx.fillRect(47, 47, W - 94, 12);

  let y = 86;
  ctx.fillStyle = '#064e3b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `bold 44px ${BN_DISPLAY_FONT}`;
  ctx.fillText(shop.shopName, W / 2, y);

  y += 56;
  ctx.fillStyle = '#0f172a';
  ctx.font = `600 23px ${BN_FONT}`;
  ctx.fillText(shop.shopAddress, W / 2, y);

  if (shop.shopPhone) {
    y += 32;
    ctx.fillStyle = '#047857';
    ctx.font = `700 21px ${BN_FONT}`;
    ctx.fillText(`মোবাইল: ${formatNumberText(shop.shopPhone, fmt)}`, W / 2, y);
  }

  y = 278;
  ctx.fillStyle = '#065f46';
  ctx.font = `700 22px ${BN_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`হালখাতা: ${formatNumberText(halkhata.dateLabel, fmt)}`, MX, y);
  ctx.fillStyle = '#9f1239';
  ctx.textAlign = 'right';
  ctx.fillText(`রসিদ তারিখ: ${getTodayDateLabel(fmt)}`, W - MX, y);

  y += 40;
  ctx.strokeStyle = '#065f46';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(MX, y);
  ctx.lineTo(W - MX, y);
  ctx.stroke();

  y += 36;
  ctx.fillStyle = '#064e3b';
  ctx.font = `700 24px ${BN_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`ক্রমিক নং: ${formatSerial(customer.serialNo, fmt)}`, MX, y);
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'right';
  ctx.fillText(
    `খাতার পৃষ্ঠা: ${customer.pageNo ? formatNumberText(customer.pageNo, fmt) : '—'}`,
    W - MX,
    y
  );

  y += 48;
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left';
  ctx.font = `700 29px ${BN_FONT}`;
  ctx.fillText(`কাস্টমার: ${customer.name}`, MX, y);

  y += 48;
  ctx.fillStyle = '#334155';
  ctx.font = `600 23px ${BN_FONT}`;
  ctx.fillText(`ঠিকানা: ${customer.address || '—'}`, MX, y);
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 23px ${BN_FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(
    `মোবাইল: ${customer.mobile ? formatNumberText(customer.mobile, fmt) : '—'}`,
    W - MX,
    y
  );

  y += 66;
  const rows: Array<{ label: string; value: string; color: string; bg: string; bold?: boolean }> = [
    { label: 'মোট পাওনা টাকা', value: `${formatAmount(customer.totalDue, fmt)} ৳`, color: '#1e1b4b', bg: '#eef2ff' },
    { label: 'জমা (নগদ)', value: `${formatAmount(customer.cashPaid, fmt)} ৳`, color: '#065f46', bg: '#ecfdf5' },
    { label: 'জমা (ব্যাংক / বিকাশ)', value: `${formatAmount(customer.bankPaid, fmt)} ৳`, color: '#075985', bg: '#f0f9ff' },
    { label: 'মোট পরিশোধিত', value: `${formatAmount(totalPaid, fmt)} ৳`, color: '#0f172a', bg: '#f8fafc', bold: true },
    {
      label: 'অবশিষ্ট বাকি',
      value: `${formatAmount(remaining, fmt)} ৳`,
      color: remaining <= 0 ? '#047857' : '#be123c',
      bg: remaining <= 0 ? '#ecfdf5' : '#fff1f2',
      bold: true,
    },
  ];

  const ROW_H = 76;
  rows.forEach((r) => {
    ctx.fillStyle = r.bg;
    ctx.fillRect(MX, y, CW, ROW_H);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(MX, y, CW, ROW_H);

    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = `${r.bold ? '700' : '600'} 25px ${BN_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(r.label, MX + 24, y + ROW_H / 2 + 1);

    ctx.fillStyle = r.color;
    ctx.font = `700 28px ${BN_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(r.value, W - MX - 24, y + ROW_H / 2 + 1);

    y += ROW_H;
  });

  if (customer.notes) {
    y += 40;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#92400e';
    ctx.font = `600 22px ${BN_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(fitText(ctx, `মন্তব্য: ${customer.notes}`, CW), MX, y);
  }

  // Signatures at bottom
  const sigY = H - 170;
  ctx.strokeStyle = '#065f46';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MX, sigY);
  ctx.lineTo(MX + 260, sigY);
  ctx.moveTo(W - MX - 260, sigY);
  ctx.lineTo(W - MX, sigY);
  ctx.stroke();

  ctx.textBaseline = 'top';
  ctx.fillStyle = '#064e3b';
  ctx.font = `600 22px ${BN_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('কাস্টমারের স্বাক্ষর', MX + 130, sigY + 14);
  ctx.fillText('দোকানদারের স্বাক্ষর', W - MX - 130, sigY + 14);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfW, pdfH);

  const blob = pdf.output('blob');
  const safeSerial = String(customer.serialNo).padStart(2, '0');
  const fileName = `Receipt_${safeSerial}.pdf`;
  const url = triggerPdfDownload(blob, fileName);

  return { blob, url, fileName };
}
