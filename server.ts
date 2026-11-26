import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? Number(process.env.PORT) || 3000 : 3000;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function toEnNumber(val: unknown): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? Math.max(0, Math.round(val)) : 0;
  }
  if (typeof val !== 'string') return 0;
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const enStr = val.replace(/[০-৯]/g, (ch) => {
    const idx = bnDigits.indexOf(ch);
    return idx >= 0 ? String(idx) : ch;
  });
  const cleaned = enStr.replace(/[^\d.]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/scan-ledger', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body as {
        imageBase64?: string;
        mimeType?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'ছবির ডেটা পাওয়া যায়নি।' });
        return;
      }

      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const validMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: validMime,
                data: cleanBase64,
              },
            },
            {
              text:
                'Extract all customer ledger rows from this Bengali shop Halkhata (হালখাতা) / credit book image. ' +
                'Read printed and handwritten Bengali text carefully (including red-pen deposits, crossed-out corrections where the newer handwritten name or page number replaces the old one, and date notes like ১৮/৩/২৬ = ৫০০০). ' +
                'Convert all numeric amounts (totalDue, cashPaid, bankPaid, serialNo) to plain integers (ASCII digits). ' +
                'Keep names, addresses, pageNo, and notes in clean Bengali script. Convert mobile numbers to ASCII digits like 017XXXXXXXX. ' +
                'If a field is blank, return empty string "" for text or 0 for numbers.',
            },
          ],
        },
        config: {
          systemInstruction:
            'You are an expert Bengali OCR & accounting assistant specializing in Bangladeshi retail Halkhata ledgers. Always output valid JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              shopName: { type: Type.STRING, description: 'Shop header name if visible' },
              dateLabel: { type: Type.STRING, description: 'Ledger date if visible' },
              customers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    serialNo: { type: Type.INTEGER, description: 'Row serial number (নং)' },
                    pageNo: { type: Type.STRING, description: 'Ledger book page number (পৃষ্ঠা)' },
                    name: { type: Type.STRING, description: 'Customer name (নাম)' },
                    address: { type: Type.STRING, description: 'Address or village/para (ঠিকানা)' },
                    mobile: { type: Type.STRING, description: 'Mobile number in ASCII digits' },
                    totalDue: { type: Type.NUMBER, description: 'Total due amount (টাকা)' },
                    cashPaid: { type: Type.NUMBER, description: 'Cash paid amount (জমা নগদ)' },
                    bankPaid: { type: Type.NUMBER, description: 'Bank/bKash/Nagad paid amount (জমা ব্যাংক)' },
                    notes: { type: Type.STRING, description: 'Handwritten corrections or date notes' },
                  },
                  required: ['name', 'totalDue'],
                },
              },
            },
            required: ['customers'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as {
        shopName?: string;
        dateLabel?: string;
        customers?: Array<Record<string, unknown>>;
      };

      const customers = (parsed.customers ?? []).map((item, idx) => ({
        serialNo: toEnNumber(item.serialNo) || idx + 1,
        pageNo: typeof item.pageNo === 'string' ? item.pageNo.trim().slice(0, 30) : '',
        name: typeof item.name === 'string' ? item.name.trim().slice(0, 120) : `কাস্টমার ${idx + 1}`,
        address: typeof item.address === 'string' ? item.address.trim().slice(0, 120) : '',
        mobile: typeof item.mobile === 'string' ? item.mobile.trim().slice(0, 30) : '',
        totalDue: toEnNumber(item.totalDue),
        cashPaid: toEnNumber(item.cashPaid),
        bankPaid: toEnNumber(item.bankPaid),
        notes: typeof item.notes === 'string' ? item.notes.trim().slice(0, 300) : '',
        selected: true,
      }));

      res.json({
        shopName: parsed.shopName ?? '',
        dateLabel: parsed.dateLabel ?? '',
        customers,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ছবি স্ক্যান করতে সমস্যা হয়েছে।';
      console.error('Ledger scan error:', error);
      res.status(500).json({ error: message });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
