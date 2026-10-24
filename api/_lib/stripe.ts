import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './db.js';

// Variáveis de servidor (Vercel > Environment Variables). Sem as três, o plano Premium não é oferecido.
export const stripeConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET);

// Objeto -> formato de formulário do Stripe (aninhado: line_items[0][price]=...).
const flatten = (value: Record<string, unknown>, prefix = '', out = new URLSearchParams()) => {
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') flatten(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
};

export interface StripeOptions {
  params?: Record<string, unknown>;
  idempotencyKey?: string;
  allowNotFound?: boolean;
}

// Chamada à API REST do Stripe (sem SDK: menos dependências e fácil de testar).
export const stripe = async <T = any>(method: 'GET' | 'POST' | 'DELETE', path: string, options: StripeOptions = {}): Promise<T> => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new HttpError(500, 'STRIPE_SECRET_KEY não configurada.');
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: options.params ? flatten(options.params).toString() : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (options.allowNotFound && res.status === 404) return data as T;
    console.error(`Stripe ${method} ${path} -> ${res.status}: ${data?.error?.message ?? 'sem detalhe'}`);
    throw new HttpError(502, 'Não foi possível falar com o provedor de pagamento. Tente novamente.', true);
  }
  return data as T;
};

// Confere o cabeçalho Stripe-Signature: HMAC-SHA256 de "<timestamp>.<corpo bruto>" com o segredo do webhook.
export const verifyStripeSignature = (raw: Buffer, header: string | undefined, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300) => {
  if (!header) return false;
  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.trim().split('=');
    if (k === 't') timestamp = Number(v);
    if (k === 'v1' && v) signatures.push(v);
  }
  if (!timestamp || Math.abs(nowSec - timestamp) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex');
  return signatures.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
};

export const readRawBody = async (req: AsyncIterable<Buffer | string>) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};
