import React, { useEffect, useState } from 'react';
import { AdminUser, SuspiciousUser, fetchSuspicious, fetchUsers } from '../services/api';
import LoginBadges, { METHOD_NAMES } from '../components/LoginBadges';

// Cadastro de usuários (admin): origem do cadastro e as formas de login ativas de cada conta.
const AdminUsers: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ users: AdminUser[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'users' | 'suspicious'>('users');
  const [sus, setSus] = useState<{ available: boolean; threshold: number; users: SuspiciousUser[] } | null>(null);

  useEffect(() => {
    if (tab !== 'suspicious') return;
    fetchSuspicious().then(setSus).catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, [tab]);

  useEffect(() => {
    let alive = true;
    fetchUsers(query, page)
      .then((r) => { if (alive) { setData(r); setError(null); } })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Não foi possível carregar.'));
    return () => { alive = false; };
  }, [query, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} aria-label="Voltar" className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm hover:text-brand-600 border border-slate-100">&larr;</button>
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Cadastros</h1>
          <p className="text-slate-500 text-sm font-medium">{data ? `${data.total} usuário${data.total === 1 ? '' : 's'}` : 'Carregando...'}</p>
        </div>
      </div>

      <div role="tablist" className="flex gap-2">
        {([['users', '👥 Usuários'], ['suspicious', '🤖 Partidas suspeitas']] as const).map(([key, text]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-black border-2 ${tab === key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 bg-white text-slate-600'}`}>{text}</button>
        ))}
      </div>

      {tab === 'suspicious' ? (
        <section className="space-y-3">
          <p className="text-sm text-slate-500">
            Usuários com 3 ou mais partidas nos últimos 7 dias concluídas perto do tempo mínimo humano (menos de {sus?.threshold ?? 1.5}× o mínimo). É só um sinal para você investigar: nada é bloqueado automaticamente.
          </p>
          {error && <p role="alert" className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
          {sus && !sus.available && <p className="text-sm font-bold text-amber-800 bg-amber-50 rounded-xl px-4 py-3">Rode a migração 012_play_signals.sql no banco para coletar esse sinal.</p>}
          {sus?.available && sus.users.length === 0 && <p className="text-center text-slate-400 py-8">Nenhum usuário suspeito. 🎉</p>}
          <ul className="space-y-3">
            {sus?.users.map((u) => (
              <li key={u.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-extrabold text-ink-900">{u.username}</span>
                  <span className="text-sm text-slate-500 break-all">{u.email}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  <strong className="text-red-600">{u.flagged}</strong> de {u.plays} partidas em ritmo de robô · melhor ritmo {u.bestRatio}× o mínimo · última em {new Date(u.lastAt).toLocaleString('pt-BR')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (<>
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome de usuário ou e-mail" aria-label="Buscar usuário"
          className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-brand-500 outline-none" />
        <button className="bg-brand-600 text-white px-5 rounded-xl font-black hover:bg-brand-700">Buscar</button>
      </form>

      {error && <p role="alert" className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      <ul className="space-y-3">
        {data?.users.map((u) => (
          <li key={u.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-extrabold text-ink-900">{u.username}</span>
              {u.role === 'admin' && <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">admin</span>}
              <span className="text-sm text-slate-500 break-all">{u.email}</span>
              <span className="text-xs text-slate-400 sm:ml-auto">desde {fmt(u.createdAt)}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 mb-1.5">
              Criado com <strong>{METHOD_NAMES[u.signupMethod]}</strong> · e-mail {u.emailVerified ? 'verificado' : 'não verificado'}
            </p>
            <LoginBadges methods={u.loginMethods} origin={u.signupMethod} />
            <p className="text-xs font-bold mt-2 flex flex-wrap gap-x-4">
              <span className={u.termsAccepted ? 'text-green-700' : 'text-red-600'}>{u.termsAccepted ? '✓' : '✗'} Termos de Uso</span>
              <span className={u.privacyAccepted ? 'text-green-700' : 'text-red-600'}>{u.privacyAccepted ? '✓' : '✗'} Política de Privacidade</span>
            </p>
          </li>
        ))}
        {data && data.users.length === 0 && <li className="text-center text-slate-400 py-8">Nenhum usuário encontrado.</li>}
      </ul>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm font-bold">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-4 py-2 rounded-xl bg-white border border-slate-200 disabled:opacity-40">Anterior</button>
          <span className="text-slate-500">{page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-4 py-2 rounded-xl bg-white border border-slate-200 disabled:opacity-40">Próxima</button>
        </div>
      )}
      </>)}
    </div>
  );
};

export default AdminUsers;
