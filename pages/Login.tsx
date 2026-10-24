import React, { useState } from 'react';
import { User } from '../types';
import { APP_NAME, APP_TAGLINE } from '../config';
import { login, recoverPassword, register } from '../services/api';

type Mode = 'login' | 'register' | 'recover';

const inputClass = 'w-full px-5 py-4 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all';

const Field: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
    <input required className={inputClass} {...props} />
  </div>
);

const Login: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', secretWord: '', newPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        onLogin((await register(form)).user);
      } else {
        onLogin((await login(form.email, form.password)).user);
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
        <span className="bg-indigo-600 px-3 py-1 rounded text-2xl font-black">{APP_NAME[0]}</span>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mt-4">{APP_NAME}</h1>
        <p className="text-lg md:text-xl text-slate-300 leading-relaxed mt-4">{APP_TAGLINE}. Sudoku, Hanói, Sequências e mais, com ranking diário, semanal, mensal e anual.</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 sm:p-10 animate-fadeIn">
        <h2 className="text-3xl font-black text-slate-800 mb-2">{titles[mode][0]}</h2>
        <p className="text-slate-500 mb-6">{titles[mode][1]}</p>

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
            <Field label="Palavra Secreta (recuperação)" type="text" autoComplete="off" minLength={4}
              value={form.secretWord} onChange={set('secretWord')} placeholder="Ex: Nome da sua escola" />
          )}
          {mode === 'recover' && (
            <Field label="Nova senha" type="password" minLength={8} autoComplete="new-password"
              value={form.newPassword} onChange={set('newPassword')} placeholder="••••••••" />
          )}

          {mode === 'login' && (
            <div className="text-right">
              <button type="button" onClick={() => switchMode('recover')} className="text-xs font-bold text-indigo-600 hover:underline">
                Esqueci minha senha
              </button>
            </div>
          )}

          {error && <p role="alert" className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
          {notice && <p className="text-sm font-bold text-green-700 bg-green-50 rounded-xl px-4 py-3">{notice}</p>}

          <button
            disabled={busy}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-60 transition-all"
          >
            {busy ? 'Aguarde...' : mode === 'register' ? 'Cadastrar' : mode === 'recover' ? 'Redefinir senha' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-slate-100 pt-6 text-slate-500">
          {mode === 'login' ? (
            <>Não tem conta ainda?
              <button onClick={() => switchMode('register')} className="ml-2 text-indigo-600 font-bold hover:underline">Crie uma agora</button></>
          ) : (
            <button onClick={() => switchMode('login')} className="text-indigo-600 font-bold hover:underline">Voltar para o login</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
