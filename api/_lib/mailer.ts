import { HttpError } from './db.js';

// Envio de e-mail pela API REST do Resend (sem SDK). Variáveis de servidor: RESEND_API_KEY e EMAIL_FROM
// (ex.: "Thinkrplay <nao-responda@seudominio.com>", com o domínio verificado no Resend).
export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());

export const sendMail = async (msg: { to: string; subject: string; text: string; html: string }) => {
  if (!mailConfigured()) throw new HttpError(503, 'Envio de e-mail não configurado.', true);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error(`Resend -> ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    throw new HttpError(502, 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.', true);
  }
};
