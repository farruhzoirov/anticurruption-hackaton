import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const app = express();
app.use(express.json({ limit: '64kb' }));

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT =
  "Siz adolatli hakam va pedagogiz. O'yinchi korrupsiyani tanladi. Uni qattiq qo'rqitmasdan, lekin chuqur o'ylantiradigan 2 ta qisqa savol bering. Savol insonlar hayoti va kelajak haqida bo'lsin. O'zbek tilida gapiring. Javobingizni faqat ikkita savol bilan yozing: birinchi qator '1.' bilan, ikkinchi qator '2.' bilan boshlansin. Hech qanday qo'shimcha matn yo'q.";

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, hasApiKey: Boolean(client) });
});

app.post('/api/judge', async (req, res) => {
  const scenario = req.body?.scenario;
  if (!scenario || !scenario.korrupt) {
    return res.status(400).json({ error: 'bad_request', message: 'scenario required' });
  }

  if (!client) {
    return res.status(503).json({
      error: 'no_api_key',
      message:
        'ANTHROPIC_API_KEY .env faylda topilmadi. Hozir mock savollar ishlatilmoqda (frontend o\'zi tushib qoladi).',
    });
  }

  const userContent = `Bosqich: ${scenario.title}
Vaziyat: ${scenario.story}
Tanlangan korrupsiya yo'li: ${scenario.korrupt.label}
Oqibat: ${scenario.korrupt.consequence}
O'yinchining «konvertdan» olgan puli: ${scenario.korrupt.personalBonus} tanga

Iltimos, 2 ta chuqur o'ylantiradigan savol bering. Har biri yangi qatordan "1." va "2." raqamlari bilan boshlansin.`;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const text =
      msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';

    const questions = text
      .split(/\n+/)
      .map((l) => l.replace(/^\s*\d+[.)\-]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 2);

    if (questions.length === 0) {
      return res.status(502).json({ error: 'empty_response', raw: text });
    }

    res.json({ questions, model: MODEL });
  } catch (err) {
    console.error('[ai-judge]', err);
    res.status(500).json({
      error: 'ai_failed',
      message: err?.message ?? 'unknown error',
    });
  }
});

// Production: serve built frontend
const distPath = path.join(ROOT, 'dist');
app.use(express.static(distPath));
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(404).end();
  });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`✓ IntegrityCity API running on http://localhost:${PORT}`);
  console.log(`  model: ${MODEL}`);
  console.log(`  ANTHROPIC_API_KEY: ${client ? 'set' : 'NOT SET (using frontend mock)'}`);
});
