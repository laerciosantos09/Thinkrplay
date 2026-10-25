import React, { useState } from 'react';
import { ADS, AdPlacement, GAMES } from '../config';
import { AppSettings, EnergySettings, PremiumState, setAdsEnabled, setLoginEnabled, setEnergyEnabled, setGameEnabled, setPremiumEnabled } from '../services/api';
import { GameSetting, LoginProvider } from '../types';
import { PROVIDER_NAMES, ProviderIcon } from '../components/SocialButtons';

interface AdminSettingsProps {
  games: GameSetting[];
  adsEnabled: boolean;
  premium: PremiumState | null;
  energy: EnergySettings | null;
  login: AppSettings['login'] | null;
  onChange: (settings: AppSettings) => void;
  onBack: () => void;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;

const Switch: React.FC<{ on: boolean; label: string; disabled: boolean; onToggle: () => void }> = ({ on, label, disabled, onToggle }) => (
  <button
    role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onToggle}
    className={`relative w-14 h-8 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-mint-500' : 'bg-slate-300'}`}
  >
    <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-6' : ''}`} />
  </button>
);

const PLACEMENTS: { key: AdPlacement; label: string; variable: string }[] = [
  { key: 'home', label: 'Painel de jogos', variable: 'VITE_ADSENSE_SLOT_HOME' },
  { key: 'ranking', label: 'Ranking', variable: 'VITE_ADSENSE_SLOT_RANKING' },
  { key: 'result', label: 'Depois de concluir um desafio', variable: 'VITE_ADSENSE_SLOT_RESULT' },
];

const LOGIN_VARS: Record<LoginProvider, string[]> = {
  google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  apple: ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'],
};

const AdminSettings: React.FC<AdminSettingsProps> = ({ games, adsEnabled, premium, energy, login, onChange, onBack }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const state = new Map(games.map((g) => [g.slug, g]));
  const activeCount = GAMES.filter((g) => state.get(g.slug)?.enabled ?? true).length;
  const adsConfigured = Boolean(ADS.client);

  const save = async (id: string, request: () => Promise<AppSettings>) => {
    setBusy(id);
    setError(null);
    try {
      onChange(await request());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fadeIn space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} aria-label="Voltar" className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm hover:text-brand-600 border border-slate-100">
          &larr;
        </button>
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Configurações</h1>
          <p className="text-slate-500 text-sm font-medium">Área do administrador</p>
        </div>
      </div>

      {error && <p role="alert" className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <header className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold text-ink-800">Jogos</h2>
            <p className="text-sm text-slate-500">Desativados ficam invisíveis para os jogadores e não podem ser jogados.</p>
          </div>
          <span className="text-xs font-black text-brand-700 bg-brand-50 rounded-full px-3 py-1.5">
            {activeCount} de {GAMES.length} ativos
          </span>
        </header>

        <ul className="divide-y divide-slate-100">
          {GAMES.map((game) => {
            const current = state.get(game.slug);
            const enabled = current?.enabled ?? true;
            const changedAt = formatDate(current?.updatedAt ?? null);
            return (
              <li key={game.slug} className="flex items-center gap-4 p-5">
                <span className={`w-12 h-12 rounded-xl ${game.color} flex items-center justify-center text-2xl shadow ${enabled ? '' : 'opacity-40 grayscale'}`}>
                  {game.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-extrabold ${enabled ? 'text-ink-800' : 'text-slate-400'}`}>{game.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {enabled ? 'Ativo' : 'Desativado'}
                    {changedAt && ` · alterado em ${changedAt}`}
                  </p>
                </div>
                <Switch
                  on={enabled} disabled={busy !== null}
                  label={`${enabled ? 'Desativar' : 'Ativar'} ${game.name}`}
                  onToggle={() => save(game.slug, () => setGameEnabled(game.slug, !enabled))}
                />
              </li>
            );
          })}
        </ul>

        <footer className="p-5 bg-slate-50 text-xs text-slate-500">
          O progresso e os pontos dos jogadores são mantidos. Ao reativar, o jogo volta exatamente como estava.
        </footer>
      </section>

      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <header className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-extrabold text-ink-800">Anúncios</h2>
          <p className="text-sm text-slate-500">Google AdSense. Desligado por padrão: habilite só depois que o domínio estiver no ar e o AdSense aprovar o site.</p>
        </header>

        <div className="flex items-center gap-4 p-5">
          <div className="flex-1 min-w-0">
            <p className={`font-extrabold ${adsEnabled ? 'text-ink-800' : 'text-slate-400'}`}>Exibir anúncios</p>
            <p className="text-xs text-slate-400">
              {!adsEnabled
                ? 'Desligado: nenhum anúncio é carregado.'
                : adsConfigured
                  ? 'Ligado: os anúncios aparecem para quem aceitar o aviso de anúncios.'
                  : 'Ligado, mas sem efeito: falta a variável VITE_ADSENSE_CLIENT (veja abaixo).'}
            </p>
          </div>
          <Switch
            on={adsEnabled} disabled={busy !== null} label={`${adsEnabled ? 'Desligar' : 'Ligar'} anúncios`}
            onToggle={() => save('ads', () => setAdsEnabled(!adsEnabled))}
          />
        </div>

        <div className="border-t border-slate-100 p-5 bg-slate-50 text-sm space-y-3">
          <p className="font-extrabold text-ink-800">Variáveis de build (Vercel)</p>
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-center gap-2">
              <span aria-hidden="true">{adsConfigured ? '✅' : '⚠️'}</span>
              <code className="font-bold">VITE_ADSENSE_CLIENT</code>
              <span className="text-slate-500">{adsConfigured ? `definida (${ADS.client})` : 'não definida: sem ela nenhum anúncio é exibido'}</span>
            </li>
            {PLACEMENTS.map((p) => (
              <li key={p.key} className="flex items-center gap-2">
                <span aria-hidden="true">{ADS.slots[p.key] ? '✅' : '⚪'}</span>
                <code className="font-bold">{p.variable}</code>
                <span className="text-slate-500">{ADS.slots[p.key] ? `definida (${p.label})` : `não definida: sem anúncio em "${p.label}"`}</span>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span aria-hidden="true">{ADS.test ? '🧪' : '⚪'}</span>
              <code className="font-bold">VITE_ADSENSE_TEST</code>
              <span className="text-slate-500">{ADS.test ? 'true: exibindo anúncios de TESTE' : 'não definida: anúncios reais'}</span>
            </li>
          </ul>
          <p className="text-xs text-slate-500">
            Alterar variáveis exige um novo deploy na Vercel. O interruptor acima vale na hora, sem deploy.
          </p>
        </div>
      </section>

      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <header className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-extrabold text-ink-800">Limite de partidas</h2>
          <p className="text-sm text-slate-500">Cada partida iniciada gasta 1 ⚡; o estoque recarrega com o tempo. Desligado por padrão.</p>
        </header>
        <div className="flex items-center gap-4 p-5">
          <div className="flex-1 min-w-0">
            <p className={`font-extrabold ${energy?.enabled ? 'text-ink-800' : 'text-slate-400'}`}>Limitar partidas em sequência</p>
            <p className="text-xs text-slate-400">
              {energy?.enabled ? 'Ligado: o limite vale para todos os jogadores.' : 'Desligado: partidas ilimitadas.'}
            </p>
          </div>
          <Switch
            on={Boolean(energy?.enabled)} disabled={busy !== null || !energy}
            label={`${energy?.enabled ? 'Desligar' : 'Ligar'} limite de partidas`}
            onToggle={() => save('energy', () => setEnergyEnabled(!energy?.enabled))}
          />
        </div>
        {energy && (
          <div className="border-t border-slate-100 p-5 bg-slate-50 text-xs text-slate-600 space-y-1">
            <p><strong>Plano grátis:</strong> {energy.free.capacity} partidas em sequência, +1 a cada {Math.round(energy.free.intervalSec / 60)} min.</p>
            <p><strong>Premium:</strong> {energy.premium.capacity} partidas em sequência, +1 a cada {Math.round(energy.premium.intervalSec / 60)} min.</p>
            <p className="text-slate-500">Só <strong>iniciar</strong> uma partida (botão Jogar, Próximo desafio ou Repetir) gasta 1; navegar entre desafios não gasta. Para mudar os números, edite <code className="font-bold">lib/energy.ts</code>.</p>
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <header className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-extrabold text-ink-800">Plano Premium</h2>
          <p className="text-sm text-slate-500">Assinatura mensal (Stripe) que remove os anúncios e mostra o selo ⭐. Não dá pontos extras.</p>
        </header>

        <div className="flex items-center gap-4 p-5">
          <div className="flex-1 min-w-0">
            <p className={`font-extrabold ${premium?.enabled ? 'text-ink-800' : 'text-slate-400'}`}>Oferecer o plano Premium</p>
            <p className="text-xs text-slate-400">
              {!premium?.enabled
                ? 'Desligado: ninguém vê a oferta nem consegue assinar.'
                : premium.configured
                  ? 'Ligado: o plano aparece para os jogadores.'
                  : 'Ligado, mas sem efeito: faltam as chaves do Stripe no servidor (veja abaixo).'}
            </p>
          </div>
          <Switch
            on={Boolean(premium?.enabled)} disabled={busy !== null || !premium}
            label={`${premium?.enabled ? 'Desligar' : 'Ligar'} plano Premium`}
            onToggle={() => save('premium', () => setPremiumEnabled(!premium?.enabled))}
          />
        </div>

        <div className="border-t border-slate-100 p-5 bg-slate-50 text-sm space-y-3">
          <p className="font-extrabold text-ink-800">
            Assinantes ativos: <span className="text-brand-700">{premium?.subscribers ?? 0}</span>
          </p>
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-start gap-2">
              <span aria-hidden="true">{premium?.configured ? '✅' : '⚠️'}</span>
              <span className="text-slate-600">
                Variáveis do servidor (Vercel):{' '}
                <code className="font-bold">STRIPE_SECRET_KEY</code>, <code className="font-bold">STRIPE_PRICE_ID</code> e{' '}
                <code className="font-bold">STRIPE_WEBHOOK_SECRET</code> — {premium?.configured ? 'detectadas' : 'faltando (o plano não é oferecido sem elas)'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden="true">🔗</span>
              <span className="text-slate-600">
                No Stripe, cadastre o webhook em <code className="font-bold">{window.location.origin}/api/billing</code> com os eventos{' '}
                <code className="font-bold">customer.subscription.created</code>, <code className="font-bold">customer.subscription.updated</code> e{' '}
                <code className="font-bold">customer.subscription.deleted</code>.
              </span>
            </li>
          </ul>
          <p className="text-xs text-slate-500">
            Desligar o interruptor encerra só as <strong>novas</strong> assinaturas: quem já assina mantém os benefícios e continua podendo gerenciar ou cancelar.
          </p>
        </div>
      </section>

      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <header className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-extrabold text-ink-800">Login com Google e Apple</h2>
          <p className="text-sm text-slate-500">Botões extras na tela de login. O login com e-mail e senha continua funcionando.</p>
        </header>

        {(['google', 'apple'] as LoginProvider[]).map((p) => {
          const st = login?.[p];
          return (
            <div key={p} className="border-b border-slate-100 last:border-b-0">
              <div className="flex items-center gap-4 p-5">
                <ProviderIcon provider={p} className="w-7 h-7 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={`font-extrabold ${st?.enabled ? 'text-ink-800' : 'text-slate-400'}`}>Entrar com {PROVIDER_NAMES[p]}</p>
                  <p className="text-xs text-slate-400">
                    {!st?.enabled
                      ? 'Desligado: o botão não aparece.'
                      : st.available
                        ? 'Ligado: o botão aparece na tela de login.'
                        : st.configured
                          ? 'Ligado, mas sem efeito: falta rodar a migração 008 no banco.'
                          : 'Ligado, mas sem efeito: faltam as variáveis no servidor (veja abaixo).'}
                  </p>
                </div>
                <Switch
                  on={Boolean(st?.enabled)} disabled={busy !== null || !st}
                  label={`${st?.enabled ? 'Desligar' : 'Ligar'} login com ${PROVIDER_NAMES[p]}`}
                  onToggle={() => save(`login_${p}`, () => setLoginEnabled(p, !st?.enabled))}
                />
              </div>
              <ul className="px-5 pb-5 space-y-1.5 text-xs">
                <li className="flex items-start gap-2">
                  <span aria-hidden="true">{st?.configured ? '✅' : '⚠️'}</span>
                  <span className="text-slate-600">
                    Variáveis do servidor (Vercel):{' '}
                    {LOGIN_VARS[p].map((v, i) => <React.Fragment key={v}>{i > 0 && ', '}<code className="font-bold">{v}</code></React.Fragment>)}
                    {' '}— {st?.configured ? 'detectadas' : 'faltando'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span aria-hidden="true">🔗</span>
                  <span className="text-slate-600">
                    URL de retorno a cadastrar no {p === 'google' ? 'Google Cloud' : 'Apple Developer (Services ID)'}:{' '}
                    <code className="font-bold break-all">{window.location.origin}/api/oauth/{p}</code>
                  </span>
                </li>
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default AdminSettings;
