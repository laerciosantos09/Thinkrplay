import { sql } from './db.js';
import { isAppSettingEnabled } from './games.js';
import type { Session } from './http.js';
import { stripeConfigured } from './stripe.js';

// Assinatura que dá direito aos benefícios.
export const ACTIVE_STATUSES = ['active', 'trialing'];

export const getSubscription = async (userId: string) => (await sql`SELECT * FROM subscriptions WHERE user_id = ${userId}`)[0];

export const isSubscriptionActive = (row?: { status?: string } | null) => Boolean(row && ACTIVE_STATUSES.includes(row.status ?? ''));

// Estado do Premium para o usuário logado. O administrador recebe também os dados de configuração.
export const premiumState = async (session: Session) => {
  const [enabled, sub] = await Promise.all([isAppSettingEnabled('premium'), getSubscription(session.id)]);
  const configured = stripeConfigured();
  const state = {
    available: enabled && configured, // dá para assinar agora
    active: isSubscriptionActive(sub), // este usuário é Premium
    status: (sub?.status as string | undefined) ?? null,
    renewsAt: sub?.current_period_end ? new Date(sub.current_period_end).toISOString() : null,
    cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
  };
  if (session.role !== 'admin') return state;
  const count = await sql`SELECT count(*)::int AS n FROM subscriptions WHERE status = ANY(${ACTIVE_STATUSES})`;
  return { ...state, enabled, configured, subscribers: count[0].n as number };
};
