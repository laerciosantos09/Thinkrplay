import React, { useState } from 'react';
import { LoginProvider, User } from '../types';
import { AppSettings, PremiumState } from '../services/api';
import { changePassword, deleteAccount, unlinkProvider, updateUsername } from '../services/api';
import { PROVIDER_NAMES, ProviderIcon } from '../components/SocialButtons';
import LoginBadges, { METHOD_NAMES } from '../components/LoginBadges';
import { USERNAME_PATTERN } from '../lib/legal';
import { SUPPORT_EMAIL } from '../config';
import { useAds } from '../components/ads/AdsContext';

interface ProfileProps {
  user: User;
  premium: PremiumState | null;
  login: AppSettings['login'] | null;
  onPremium: () => void;
  onUserChange: (user: User) => void;
  onDeleted: () => void;
  onBack: () => void;
}

const input = 'w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-brand-500 outline-none transition-all';
const label = 'block text-sm font-bold text-slate-700 mb-1.5';

const Card: React.FC<{ title: string; hint?: string; danger?: boolean; children: React.ReactNode }> = ({ title, hint, danger, children }) => (
  <section className={`bg-white rounded-3xl shadow-sm border p-6 ${danger ? 'border-red-200' : 'border-slate-100'}`}>
    <h2 className={`text-lg font-extrabold ${danger ? 'text-red-700' : 'text-ink-800'}`}>{title}</h2>
    {hint && <p className="text-sm text-slate-500 mt-1 mb-4">{hint}</p>}
    {!hint && <div className="mb-4" />}
    {children}
  </section>
);

const Message: React.FC<{ error?: string | null; ok?: string | null }> = ({ error, ok }) => (
  <>
    {error && <p role="alert" className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
    {ok && <p role="status" className="text-sm font-bold text-green-700 bg-green-50 rounded-xl px-4 py-3">{ok}</p>}
  </>
);

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado.');

const Profile: React.FC<ProfileProps> = ({ user, premium, login, onPremium, onUserChange, onDeleted, onBack }) => {
  const ads = useAds();
  // nome de usuário
  const [username, setUsername] = useState(user.username);
  const [nameMsg, setNameMsg] = useState<{ error?: string; ok?: string }>({});
  const [nameBusy, setNameBusy] = useState(false);
  const nameValid = USERNAME_PATTERN.test(username);
  const hasPassword = user.hasPassword !== false;
  const connections = user.connections ?? [];

  // contas conectadas (Google/Apple)
  const [connMsg, setConnMsg] = useState<{ error?: string; ok?: string }>({});
  const [connBusy, setConnBusy] = useState<LoginProvider | null>(null);
  const shownProviders = (['google', 'apple'] as LoginProvider[]).filter((p) => connections.includes(p) || login?.[p]?.available);
  const disconnect = async (provider: LoginProvider) => {
    if (!window.confirm(`Desconectar sua conta ${PROVIDER_NAMES[provider]}?`)) return;
    setConnBusy(provider);
    setConnMsg({});
    try {
      const r = await unlinkProvider(provider);
      onUserChange({ ...user, connections: r.connections, loginMethods: [...(user.hasPassword !== false ? ['password' as const] : []), ...r.connections] });
      setConnMsg({ ok: `Conta ${PROVIDER_NAMES[provider]} desconectada.` });
    } catch (err) {
      setConnMsg({ error: errorText(err) });
    } finally {
      setConnBusy(null);
    }
  };

  // senha
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [pwMsg, setPwMsg] = useState<{ error?: string; ok?: string }>({});
  const [pwBusy, setPwBusy] = useState(false);

  // excluir conta
  const [del, setDel] = useState({ password: '', confirm: '' });
  const [delError, setDelError] = useState<string | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameBusy(true);
    setNameMsg({});
    try {
      const { user: updated } = await updateUsername(username.trim());
      onUserChange(updated);
      setUsername(updated.username);
      setNameMsg({ ok: 'Nome de usuário atualizado.' });
    } catch (err) {
      setNameMsg({ error: errorText(err) });
    } finally {
      setNameBusy(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.again) return setPwMsg({ error: 'A confirmação da nova senha não confere.' });
    setPwBusy(true);
    setPwMsg({});
    try {
      await changePassword(hasPassword ? pw.current : undefined, pw.next);
      setPw({ current: '', next: '', again: '' });
      onUserChange({ ...user, hasPassword: true, loginMethods: ['password', ...connections] });
      setPwMsg({ ok: hasPassword ? 'Senha alterada. Os outros dispositivos foram desconectados.' : 'Senha definida. Agora você também pode entrar com e-mail e senha.' });
    } catch (err) {
      setPwMsg({ error: errorText(err) });
    } finally {
      setPwBusy(false);
    }
  };

  const removeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDelBusy(true);
    setDelError(null);
    try {
      await deleteAccount(hasPassword ? del.password : undefined, del.confirm);
      onDeleted();
    } catch (err) {
      setDelError(errorText(err));
      setDelBusy(false);
    }
  };

  const since = user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : null;

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} aria-label="Voltar" className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm hover:text-brand-600 border border-slate-100">&larr;</button>
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Meu perfil</h1>
          <p className="text-slate-500 text-sm font-medium">Gerencie sua conta</p>
        </div>
      </div>

      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex items-center gap-4">
        <span className="w-16 h-16 rounded-2xl bg-linear-to-br from-brand-400 to-brand-700 text-white text-3xl font-black flex items-center justify-center shrink-0" aria-hidden="true">
          {user.username[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-xl font-extrabold text-ink-900 truncate">
            {user.username}
            {user.role === 'admin' && <span className="ml-2 align-middle text-[10px] font-black uppercase bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">admin</span>}
          </p>
          <p className="text-sm text-slate-500 truncate">{user.email}</p>
          {since && <p className="text-xs text-slate-400">Membro desde {since}{user.signupMethod && <> · criada com {METHOD_NAMES[user.signupMethod]}</>}</p>}
          <p className="text-xs text-green-700 font-bold mt-1">
            {user.termsAccepted && <span className="mr-3">✓ Termos de Uso aceitos</span>}
            {user.privacyAccepted && <span>✓ Política de Privacidade aceita</span>}
          </p>
          {user.loginMethods && user.loginMethods.length > 0 && (
            <div className="mt-2"><LoginBadges methods={user.loginMethods} origin={user.signupMethod} /></div>
          )}
        </div>
      </section>

      {premium && (premium.active || premium.available) && (
        <Card title="Plano Premium" hint={premium.active ? 'Você é Premium: sem anúncios e com o selo ⭐.' : 'Jogue sem anúncios e apoie o app.'}>
          <button onClick={onPremium} className="bg-amber-400 hover:bg-amber-300 text-ink-900 px-6 py-3 rounded-xl font-black">
            {premium.active ? 'Ver ou gerenciar assinatura' : 'Conhecer o Premium'}
          </button>
        </Card>
      )}

      <Card title="Nome de usuário" hint="É o nome que aparece nos rankings. Precisa ser único e diferente do seu e-mail (seu e-mail nunca é exibido).">
        <form onSubmit={saveName} className="space-y-3">
          <div>
            <label htmlFor="username" className={label}>Nome de usuário</label>
            <input id="username" className={input} value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" maxLength={24} aria-describedby="username-help" />
            <p id="username-help" className={`text-xs mt-1 ${username && !nameValid ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
              3 a 24 caracteres: letras, números, _ . ou -
            </p>
          </div>
          <Message error={nameMsg.error} ok={nameMsg.ok} />
          <button disabled={nameBusy || !nameValid || username === user.username}
            className="bg-brand-600 text-white px-6 py-3 rounded-xl font-black disabled:opacity-40 hover:bg-brand-700">
            {nameBusy ? 'Salvando...' : 'Salvar nome'}
          </button>
        </form>
      </Card>

      {shownProviders.length > 0 && (
        <Card title="Contas conectadas" hint="Entre com um toque usando sua conta Google ou Apple. Você precisa manter ao menos uma forma de entrar (senha ou conta conectada).">
          <ul className="space-y-3">
            {shownProviders.map((p) => {
              const linked = connections.includes(p);
              return (
                <li key={p} className="flex items-center gap-3">
                  <ProviderIcon provider={p} className="w-6 h-6 shrink-0" />
                  <span className="flex-1 font-bold text-ink-800">{PROVIDER_NAMES[p]} <span className={`text-xs ${linked ? 'text-green-600' : 'text-slate-400'}`}>{linked ? 'conectada' : 'não conectada'}</span></span>
                  {linked ? (
                    <button onClick={() => disconnect(p)} disabled={connBusy !== null}
                      className="text-sm font-black px-4 py-2 rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      {connBusy === p ? '...' : 'Desconectar'}
                    </button>
                  ) : (
                    <a href={`/api/oauth/${p}?link=1`} className="text-sm font-black px-4 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700">Conectar</a>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3"><Message error={connMsg.error} ok={connMsg.ok} /></div>
        </Card>
      )}

      <Card title={hasPassword ? 'Alterar senha' : 'Definir senha'}
        hint={hasPassword ? 'Por segurança, informe a senha atual. Ao trocar, os outros dispositivos conectados são desconectados.' : 'Sua conta entra pelo Google/Apple. Defina uma senha se quiser também entrar com e-mail e senha.'}>
        <form onSubmit={savePassword} className="space-y-3">
          {hasPassword && (
            <div>
              <label htmlFor="pw-current" className={label}>Senha atual</label>
              <input id="pw-current" type="password" required className={input} autoComplete="current-password"
                value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </div>
          )}
          <div>
            <label htmlFor="pw-new" className={label}>Nova senha</label>
            <input id="pw-new" type="password" required minLength={8} className={input} autoComplete="new-password"
              value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <p className="text-xs mt-1 text-slate-400">Mínimo de 8 caracteres.</p>
          </div>
          <div>
            <label htmlFor="pw-again" className={label}>Repita a nova senha</label>
            <input id="pw-again" type="password" required minLength={8} className={input} autoComplete="new-password"
              value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} />
          </div>
          <Message error={pwMsg.error} ok={pwMsg.ok} />
          <button disabled={pwBusy} className="bg-brand-600 text-white px-6 py-3 rounded-xl font-black disabled:opacity-40 hover:bg-brand-700">
            {pwBusy ? 'Salvando...' : hasPassword ? 'Alterar senha' : 'Definir senha'}
          </button>
        </form>
      </Card>

      {ads.active && (
        <Card title="Anúncios" hint="Escolha como os anúncios do Google AdSense são exibidos para você.">
          <div className="flex flex-col sm:flex-row gap-2" role="radiogroup" aria-label="Preferência de anúncios">
            {([['personalized', 'Personalizados'], ['limited', 'Limitados (não personalizados)']] as const).map(([value, text]) => (
              <button key={value} role="radio" aria-checked={ads.consent === value} onClick={() => ads.setConsent(value)}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-black border-2 ${ads.consent === value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 text-slate-600 hover:bg-slate-50'}`}>
                {text}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">A escolha vale para os próximos anúncios exibidos neste aparelho.</p>
        </Card>
      )}

      <Card title="Termos, privacidade e suporte">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold">
          <a href="/termos" target="_blank" rel="noopener" className="text-brand-700 hover:underline">Termos de Uso</a>
          <a href="/privacidade" target="_blank" rel="noopener" className="text-brand-700 hover:underline">Política de Privacidade</a>
          {SUPPORT_EMAIL && <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-700 hover:underline">Falar com o suporte</a>}
        </div>
      </Card>

      <Card danger title="Excluir conta" hint="Esta ação é permanente e não pode ser desfeita.">
        <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1 mb-4">
          <li>Seu cadastro, pontuações, partidas e progresso em todos os jogos são apagados.</li>
          <li>Você sai de todos os rankings imediatamente.</li>
          <li>Seu e-mail e nome de usuário ficam livres para novos cadastros.</li>
          {connections.includes('apple') && <li>O acesso do app à sua conta Apple é revogado.</li>}
          {premium?.active && <li><strong>Sua assinatura Premium é cancelada</strong> antes de a conta ser apagada.</li>}
        </ul>
        <form onSubmit={removeAccount} className="space-y-3">
          {hasPassword && (
            <div>
              <label htmlFor="del-pw" className={label}>Sua senha</label>
              <input id="del-pw" type="password" required className={input} autoComplete="current-password"
                value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} />
            </div>
          )}
          <div>
            <label htmlFor="del-confirm" className={label}>Digite <strong>EXCLUIR</strong> para confirmar</label>
            <input id="del-confirm" className={input} autoComplete="off" value={del.confirm}
              onChange={(e) => setDel({ ...del, confirm: e.target.value })} />
          </div>
          <Message error={delError} />
          <button disabled={delBusy || (hasPassword && !del.password) || del.confirm.trim().toUpperCase() !== 'EXCLUIR'}
            className="bg-red-600 text-white px-6 py-3 rounded-xl font-black disabled:opacity-40 hover:bg-red-700">
            {delBusy ? 'Excluindo...' : 'Excluir minha conta definitivamente'}
          </button>
        </form>
      </Card>
    </div>
  );
};

export default Profile;
