-- 006 · Plano Premium (assinatura via Stripe).
--  - subscriptions: uma linha por usuário com o estado da assinatura (espelho do Stripe, atualizado por webhook)
--  - stripe_events: eventos do Stripe já processados (evita processar o mesmo evento duas vezes)
-- Pode ser executado várias vezes sem problema.

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'none', -- none, active, trialing, past_due, canceled, unpaid, incomplete...
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  event_created timestamptz, -- momento do último evento aplicado (ignora eventos antigos que chegam fora de ordem)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_customer_key ON subscriptions (stripe_customer_id);

CREATE TABLE IF NOT EXISTS stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
