import React, { useEffect, useState } from 'react';
import { LoginProvider, User } from '../types';
import { APP_TAGLINE } from '../config';
import Logo from '../components/Logo';
import SocialButtons from '../components/SocialButtons';
import { isNativeApp } from '../lib/platform';
import { fetchProviders, login, recoverPassword, register } from '../services/api';

type Mode = 'login' | 'register' | 'recover';

const inputClass = 'w-full px-5 py-4 rounded-xl border-2 border-slate-100 focus:border-brand-500 outline-none transition-all';

const Field: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
    <input required className={inputClass} {...props} />
  </div>
);

const Login: React.FC<{ onLogin: (user: User) => void; initialError?: string | null; pendingLink?: LoginProvider | null }> = ({ onLogin, initialError, pendingLink }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', secretWord: '', newPassword: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [social, setSocial] = useState<LoginProvider[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Botões do Google/Apple só aparecem se o administrador ligou e o servidor está configurado.
  useEffect(() => {
    if (isNativeApp) return; // login social não funciona no WebView do app nativo
    fetchProviders()
      .then((r) => setSocial((['google', 'apple'] as LoginProvider[]).filter((p) => r[p])))
      .catch(() => {});
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'recover') {
        await recoverPassword({ email: form.email, secretWord: form.secretWord, newPassword: form.newPassword });
        setForm({ ...form, password: '', secretWord: '', newPassword: '' });
        switchMode('login');
        setNotice('Senha redefinida. Entre com a nova senha.');
      } else if (mode === 'register') {
        onLogin((await register({ ...form, acceptTerms, acceptPrivacy })).user);
      } else {
        onLogin((await login(form.email, form.password, Boolean(pendingLink))).user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.');
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, [string, string]> = {
    login: ['Bem-vindo de volta', 'Faça login com sua conta.'],
    register: ['Criar Conta', 'Cadastre-se para competir nos rankings.'],
    recover: ['Recuperar Senha', 'Informe seu e-mail, a palavra secreta e uma nova senha.'],
  };

  return (
    <div className="min-h-screen bg-gradient-main flex flex-col md:flex-row items-center justify-center p-4 gap-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="max-w-md text-white text-center md:text-left">
        <Logo size={56} className="mb-6" />
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">Treine a mente.<br /><span className="text-mint-400">Divirta-se.</span> Suba no ranking.</h1>
        <p className="text-lg text-brand-200 leading-relaxed mt-4">{APP_TAGLINE}: Sudoku, Hanói, Sequências e mais, com ranking diário, semanal, mensal e anual.</p>
        <div className="flex flex-wrap gap-2 mt-6 justify-center md:justify-start">
          {['🔢 Sudoku', '🗼 Hanói', '🔍 Sequências', '🎯 Código'].map((t) => (
            <span key={t} className="bg-white/10 border border-white/10 rounded-full px-3 py-1 text-sm font-semibold text-brand-100">{t}</span>
          ))}
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 sm:p-10 animate-fadeIn">
        <h2 className="text-3xl font-black text-ink-800 mb-2">{titles[mode][0]}</h2>
        <p className="text-slate-500 mb-6">{titles[mode][1]}</p>
        {pendingLink && mode === 'login' && (
          <p role="status" className="text-sm font-bold text-brand-700 bg-brand-50 rounded-xl px-4 py-3 mb-4">
            Já existe uma conta Thinkrplay com o e-mail da sua conta {pendingLink === 'google' ? 'Google' : 'Apple'}. Digite o e-mail e a senha dela para conectar: depois você poderá entrar pelos dois jeitos.
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <Field label="Nome de Usuário" type="text" autoComplete="username" minLength={3} maxLength={24}
              value={form.username} onChange={set('username')} placeholder="Ex: joaosilva" />
          )}
          <Field label="E-mail" type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="seu@email.com" />
          {mode !== 'recover' && (
            <Field label="Senha" type="password" minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={form.password} onChange={set('password')} placeholder="••••••••" />
          )}
          {mode !== 'login' && (
            <Field label="Palavra Secreta (recuperação)" type="text" autoComplete="off" minLength={mode === 'register' ? 8 : undefined}
              value={form.secretWord} onChange={set('secretWord')} placeholder="Ex: nome da sua primeira escola" />
          )}
          {mode === 'recover' && (
            <Field label="Nova senha" type="password" minLength={8} autoComplete="new-password"
              value={form.newPassword} onChange={set('newPassword')} placeholder="••••••••" />
          )}

          {mode === 'register' && (
            <div className="space-y-2">
              <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" required checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 w-5 h-5 accent-brand-600 shrink-0" />
                <span>Li e aceito os <a href="/termos" target="_blank" rel="noopener" className="font-bold text-brand-700 underline">Termos de Uso</a>.</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" required checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} className="mt-0.5 w-5 h-5 accent-brand-600 shrink-0" />
                <span>Li e aceito a <a href="/privacidade" target="_blank" rel="noopener" className="font-bold text-brand-700 underline">Política de Privacidade</a>.</span>
              </label>
            </div>
          )}

          {mode === 'login' && (
            <div className="text-right">
              <button type="button" onClick={() => switchMode('recover')} className="text-xs font-bold text-brand-600 hover:underline">
                Esqueci minha senha
              </button>
            </div>
          )}

          {error && <p role="alert" className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
          {notice && <p className="text-sm font-bold text-green-700 bg-green-50 rounded-xl px-4 py-3">{notice}</p>}

          <button
            disabled={busy}
            className="w-full bg-brand-600 text-white py-4 rounded-xl font-black shadow-lg shadow-brand-100 hover:bg-brand-700 disabled:opacity-60 transition-all"
          >
            {busy ? 'Aguarde...' : mode === 'register' ? 'Cadastrar' : mode === 'recover' ? 'Redefinir senha' : 'Entrar'}
          </button>
        </form>

        {social.length > 0 && mode !== 'recover' && (
          <div className="mt-6">
            <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase mb-4">
              <span className="flex-1 h-px bg-slate-100" />ou<span className="flex-1 h-px bg-slate-100" />
            </div>
            <SocialButtons providers={social} verb={mode === 'register' ? 'Cadastrar com' : 'Entrar com'} />
            {mode === 'register' && <p className="mt-3 text-center text-xs text-slate-400">No primeiro acesso você precisará aceitar os Termos de Uso e a Política de Privacidade.</p>}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          <a href="/termos" className="hover:underline">Termos de Uso</a> · <a href="/privacidade" className="hover:underline">Política de Privacidade</a>
        </p>

        <div className="mt-6 text-center border-t border-slate-100 pt-6 text-slate-500">
          {mode === 'login' ? (
            <>Não tem conta ainda?
              <button onClick={() => switchMode('register')} className="ml-2 text-brand-600 font-bold hover:underline">Crie uma agora</button></>
          ) : (
            <button onClick={() => switchMode('login')} className="text-brand-600 font-bold hover:underline">Voltar para o login</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
