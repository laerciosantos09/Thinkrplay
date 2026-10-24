import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HttpError, sql } from './_lib/db.js';
import { isAppSettingEnabled } from './_lib/games.js';
import { requireSession, route } from './_lib/http.js';
import { getSubscription, isSubscriptionActive } from './_lib/premium.js';
import { readRawBody, stripe, stripeConfigured, verifyStripeSignature } from './_lib/stripe.js';

// Esta função recebe duas coisas (para caber no limite de funções da Vercel):
//  - POST { action: "checkout" | "portal" } do app, para o usuário logado;
//  - POST do Stripe (webhook), identificado pelo cabeçalho Stripe-Signature.
// O webhook precisa do corpo BRUTO para conferir a assinatura, então o parser automático fica desligado
// e o JSON do app é lido aqui mesmo.
export const config = { api: { bodyParser: false } };

const readJson = async (req: VercelRequest): Promise<Record<string, any>> => {
  if (req.body && typeof req.body === 'object') return req.body; // já interpretado (testes / execução local)
  const raw = (await readRawBody(req as unknown as AsyncIterable<Buffer>)).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Corpo inválido.');
  }
};

const appUrl = (req: VercelRequest) => {
  const configured = process.env.APP_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
  return `${/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https'}://${host}`;
};

const appHandler = route(['POST'], async (req) => {
  const session = await requireSession(req);
  const body = await readJson(req);
  const existing = await getSubscription(session.id);

  if (body.action === 'checkout') {
    const tableOk = (await sql`SELECT to_regclass('public.subscriptions') IS NOT NULL AS ok`)[0].ok;
    if (!tableOk || !stripeConfigured() || !(await isAppSettingEnabled('premium'))) {
      throw new HttpError(403, 'O plano Premium não está disponível no momento.');
    }
    if (isSubscriptionActive(existing)) throw new HttpError(409, 'Você já é Premium.');

    let customer: string = existing?.stripe_customer_id;
    if (!customer) {
      const rows = await sql`SELECT email FROM users WHERE id = ${session.id}`;
      const created = await stripe<{ id: string }>('POST', '/customers', {
        params: { email: rows[0].email, metadata: { user_id: session.id } },
        idempotencyKey: `customer-${session.id}`,
      });
      await sql`
        INSERT INTO subscriptions (user_id, stripe_customer_id) VALUES (${session.id}, ${created.id})
        ON CONFLICT (user_id) DO NOTHING`;
      customer = (await getSubscription(session.id)).stripe_customer_id;
    }

    const checkout = await stripe<{ url: string }>('POST', '/checkout/sessions', {
      params: {
        mode: 'subscription',
        customer,
        client_reference_id: session.id,
        line_items: { 0: { price: process.env.STRIPE_PRICE_ID, quantity: 1 } },
        subscription_data: { metadata: { user_id: session.id } },
        success_url: `${appUrl(req)}/?premium=success`,
        cancel_url: `${appUrl(req)}/?premium=cancel`,
        locale: 'pt-BR',
      },
    });
    return { url: checkout.url };
  }

  if (body.action === 'portal') {
    // Quem já assinou continua podendo gerenciar/cancelar mesmo que o administrador pare de vender.
    if (!existing?.stripe_customer_id) throw new HttpError(404, 'Você ainda não tem uma assinatura.');
    if (!stripeConfigured()) throw new HttpError(503, 'Gerenciamento de assinatura indisponível no momento.', true);
    const portal = await stripe<{ url: string }>('POST', '/billing_portal/sessions', {
      params: { customer: existing.stripe_customer_id, return_url: `${appUrl(req)}/` },
    });
    return { url: portal.url };
  }

  throw new HttpError(400, 'Ação inválida.');
});

const periodEnd = (sub: any): number | null =>
  sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null; // versões novas da API trazem no item

// O estado da assinatura vem sempre dos eventos customer.subscription.*; eventos antigos que chegam atrasados são ignorados.
const applySubscription = async (event: any) => {
  const sub = event.data.object;
  const status = event.type === 'customer.subscription.deleted' ? 'canceled' : String(sub.status);
  const customer = String(sub.customer);
  const userId = sub.metadata?.user_id as string | undefined;
  const end = periodEnd(sub);
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;

  const updated = await sql`
    UPDATE subscriptions SET
      stripe_subscription_id = ${sub.id}, status = ${status}, price_id = ${priceId},
      current_period_end = ${end === null ? null : new Date(end * 1000).toISOString()},
      cancel_at_period_end = ${Boolean(sub.cancel_at_period_end)},
      event_created = to_timestamp(${event.created}), updated_at = now()
    WHERE stripe_customer_id = ${customer}
      AND (event_created IS NULL OR event_created <= to_timestamp(${event.created}))
    RETURNING user_id`;
  if (updated.length > 0) return;

  // Sem linha para esse cliente (ou evento antigo): só cria se o usuário vier nos metadados e não houver nada registrado.
  const known = await sql`SELECT 1 FROM subscriptions WHERE stripe_customer_id = ${customer}`;
  if (known.length > 0 || !userId) return;
  await sql`
    INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, price_id, current_period_end, cancel_at_period_end, event_created)
    SELECT id, ${customer}, ${sub.id}, ${status}, ${priceId}, ${end === null ? null : new Date(end * 1000).toISOString()},
           ${Boolean(sub.cancel_at_period_end)}, to_timestamp(${event.created})
    FROM users WHERE id = ${userId}
    ON CONFLICT (user_id) DO NOTHING`;
};

const webhook = async (req: VercelRequest, res: VercelResponse) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Método não permitido.');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new HttpError(503, 'Webhook não configurado.', true);

    const raw = await readRawBody(req as unknown as AsyncIterable<Buffer>);
    if (!verifyStripeSignature(raw, req.headers['stripe-signature'] as string | undefined, secret)) {
      throw new HttpError(400, 'Assinatura inválida.');
    }
    const event = JSON.parse(raw.toString('utf8'));
    if (!event?.id || !event?.type) throw new HttpError(400, 'Evento inválido.');

    const seen = await sql`SELECT 1 FROM stripe_events WHERE id = ${event.id}`;
    if (seen.length === 0) {
      if (event.type.startsWith('customer.subscription.')) await applySubscription(event);
      // Só registra como processado DEPOIS de aplicar: se algo falhar, o Stripe tenta de novo.
      await sql`INSERT INTO stripe_events (id, type) VALUES (${event.id}, ${event.type}) ON CONFLICT (id) DO NOTHING`;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    if (err instanceof HttpError && (err.status < 500 || err.expose)) {
      res.status(err.status).json({ error: err.message });
    } else {
      console.error('Webhook do Stripe falhou:', err instanceof HttpError ? err.message : err);
      res.status(500).json({ error: 'Erro interno.' });
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers['stripe-signature']) return webhook(req, res);
  return appHandler(req, res);
}
