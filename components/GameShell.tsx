import React, { useEffect, useState } from 'react';
import RankingTable from './RankingTable';
import UnlockInfo from './UnlockInfo';
import { TIER_LABELS } from '../config';
import { CHALLENGES_PER_TIER, TIERS, Tier, UNLOCK_RULES, isTierUnlocked, nextLockedTier, unlockStatus } from '../lib/tiers';
import { PlayCtl } from '../services/usePlay';

interface GameShellProps {
  title: string;
  slug: string;
  ctl: PlayCtl;
  onBack: () => void;
  stats?: React.ReactNode;
  children: React.ReactNode;
}

const TIER_STYLE: Record<Tier, string> = {
  easy: 'data-[on=true]:bg-mint-400 data-[on=true]:text-ink-900',
  medium: 'data-[on=true]:bg-amber-400 data-[on=true]:text-ink-900',
  hard: 'data-[on=true]:bg-rose-500 data-[on=true]:text-white',
};

const ChallengePicker: React.FC<{ ctl: PlayCtl }> = ({ ctl }) => {
  const [draft, setDraft] = useState(String(ctl.challenge));
  useEffect(() => setDraft(String(ctl.challenge)), [ctl.challenge, ctl.tier]);
  const commit = () => ctl.setChallenge(Number(draft));
  const limit = ctl.nextChallenge;
  return (
    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
      <button aria-label="Desafio anterior" disabled={ctl.challenge <= 1} onClick={() => ctl.setChallenge(ctl.challenge - 1)}
        className="w-9 h-9 bg-white rounded-lg shadow-sm hover:bg-brand-50 disabled:opacity-40">&lsaquo;</button>
      <label className="flex items-center gap-1 px-2 text-sm font-bold text-slate-600">
        Desafio
        <input
          type="number" min={1} max={limit} value={draft} aria-label="Número do desafio"
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-16 text-center bg-white rounded-lg py-1.5 font-black text-ink-800 outline-none focus:ring-2 ring-brand-400"
        />
        <span className="text-slate-400 font-semibold">/ {CHALLENGES_PER_TIER}</span>
      </label>
      <button aria-label="Próximo desafio" disabled={ctl.challenge >= limit} onClick={() => ctl.setChallenge(ctl.challenge + 1)}
        className="w-9 h-9 bg-white rounded-lg shadow-sm hover:bg-brand-50 disabled:opacity-40">&rsaquo;</button>
      {ctl.challenge < limit && (
        <button onClick={() => ctl.setChallenge(limit)} className="ml-1 px-3 h-9 text-xs font-black text-brand-700 hover:underline">
          Ir ao #{limit}
        </button>
      )}
    </div>
  );
};

const GameShell: React.FC<GameShellProps> = ({ title, slug, ctl, onBack, stats, children }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
    <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center gap-3 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-brand-600 font-bold py-2">&larr; Voltar</button>
        <div className="text-center">
          <h2 className="text-2xl font-black text-ink-800">{title}</h2>
          {stats && <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">{stats}</div>}
        </div>
        <span className="w-16" />
      </div>

      <div role="tablist" aria-label="Nível" className="grid grid-cols-3 gap-2 mb-3">
        {TIERS.map((t) => {
          const unlocked = isTierUnlocked(t, ctl.progress);
          const rule = UNLOCK_RULES[t];
          const on = ctl.tier === t;
          return (
            <button
              key={t} role="tab" aria-selected={on} data-on={on} disabled={!unlocked}
              title={unlocked ? `${ctl.progress[t]} de ${CHALLENGES_PER_TIER} resolvidos` : `Resolva ${rule!.needed} desafios no ${TIER_LABELS[rule!.from]} para liberar`}
              onClick={() => ctl.selectTier(t)}
              className={`rounded-xl px-2 py-2 text-left transition-all border-2 ${on ? 'border-transparent' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'} ${TIER_STYLE[t]} disabled:opacity-60 disabled:hover:bg-slate-50`}
            >
              <span className="block font-black text-sm">{unlocked ? '' : '🔒 '}{TIER_LABELS[t]}</span>
              <span className={`block text-[11px] font-semibold ${on ? 'opacity-80' : 'text-slate-400'}`}>
                {unlocked ? `${ctl.progress[t]}/${CHALLENGES_PER_TIER}` : `faltam ${unlockStatus(t, ctl.progress)!.remaining} no ${TIER_LABELS[rule!.from]}`}
              </span>
            </button>
          );
        })}
      </div>

      <UnlockInfo progress={ctl.progress} />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <ChallengePicker ctl={ctl} />
        {ctl.play && !ctl.play.scored && (
          <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-3 py-1.5">Repetição · não vale pontos</span>
        )}
      </div>

      {ctl.error && (
        <div role="alert" className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
          {ctl.error}
          <button onClick={ctl.restart} className="ml-3 underline">Nova partida</button>
        </div>
      )}
      {ctl.play ? children : !ctl.error && <p className="text-center text-slate-400 py-16">Preparando partida...</p>}
    </div>
    <RankingTable slug={slug} refreshKey={ctl.rankingKey} />
  </div>
);

export const WinPanel: React.FC<{ title: string; text: string; ctl: PlayCtl }> = ({ title, text, ctl }) => {
  const r = ctl.result;
  if (!r) return null;
  return (
    <div className="mt-6 p-6 bg-green-50 rounded-2xl border border-green-200 text-center animate-fadeIn">
      <h3 className="text-xl font-black text-green-700 mb-1">{title}</h3>
      <p className="text-green-700">{text}</p>
      {r.awarded ? (
        <p className="font-black text-green-800 text-2xl my-2">+{r.points} pontos</p>
      ) : (
        <p className="text-sm font-bold text-slate-500 my-2">Desafio já resolvido antes: repetição não vale pontos.</p>
      )}
      {(() => {
        const next = nextLockedTier(r.progress);
        const st = next && unlockStatus(next, r.progress);
        return st && !r.unlockedTier ? (
          <p className="text-sm font-bold text-brand-700 my-2">
            Faltam {st.remaining} {st.remaining === 1 ? 'desafio' : 'desafios'} no {TIER_LABELS[st.from]} para liberar o {TIER_LABELS[next!]}.
          </p>
        ) : null;
      })()}
      {r.unlockedTier && (
        <div className="my-3 rounded-xl bg-white border border-amber-300 px-4 py-3">
          <p className="font-black text-ink-800">🔓 {TIER_LABELS[r.unlockedTier]} liberado!</p>
          <button onClick={() => ctl.selectTier(r.unlockedTier!)} className="mt-2 text-sm font-black text-brand-700 hover:underline">
            Jogar no {TIER_LABELS[r.unlockedTier]} &rarr;
          </button>
        </div>
      )}
      <div className="flex gap-3 justify-center mt-3">
        <button onClick={ctl.restart} className="bg-white text-green-700 border border-green-300 px-6 py-2 rounded-full font-bold">Repetir</button>
        {ctl.challenge < ctl.nextChallenge && (
          <button onClick={() => ctl.setChallenge(ctl.challenge + 1)} className="bg-green-600 text-white px-8 py-2 rounded-full font-bold shadow-lg hover:bg-green-700">
            Próximo desafio
          </button>
        )}
      </div>
    </div>
  );
};

export default GameShell;
