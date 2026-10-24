import React, { useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { PlayCtl, usePlay } from '../services/usePlay';
import { StartedPlay } from '../services/api';
import { TierProgress } from '../lib/tiers';

interface GuessResponse { correct: boolean; done: boolean; points?: number; awarded?: boolean; progress?: TierProgress }

// As respostas ficam só no servidor: cada clique é conferido lá.
const Board: React.FC<{ ctl: PlayCtl; puzzles: NonNullable<StartedPlay['puzzles']>; onProgress: (s: string) => void }> = ({ ctl, puzzles, onProgress }) => {
  const [round, setRound] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const puzzle = puzzles[Math.min(round, puzzles.length - 1)];

  const answer = async (value: number) => {
    if (busy || ctl.result) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await ctl.guess<GuessResponse>({ value });
      if (!r.correct) {
        setMistakes((m) => m + 1);
        setWrong((w) => [...w, value]);
        onProgress(`Desafio ${round + 1}/${puzzles.length} · ${mistakes + 1} erros`);
      } else if (!r.done) {
        setRound(round + 1);
        setWrong([]);
        setShowHint(false);
        onProgress(`Desafio ${round + 2}/${puzzles.length} · ${mistakes} erros`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar a resposta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-center text-slate-500 mb-4">Qual número vem a seguir?</p>
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {puzzle.shown.map((n, i) => (
          <span key={i} className="min-w-[3.25rem] px-3 py-3 bg-slate-100 rounded-xl text-xl font-black text-slate-700 text-center">{n}</span>
        ))}
        <span className="min-w-[3.25rem] px-3 py-3 bg-brand-100 rounded-xl text-xl font-black text-brand-500 text-center">?</span>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
        {puzzle.options.map((o) => (
          <button
            key={o}
            disabled={wrong.includes(o) || busy || !!ctl.result}
            onClick={() => answer(o)}
            className="py-4 rounded-2xl text-2xl font-black bg-ink-800 text-white hover:bg-brand-600 disabled:bg-red-100 disabled:text-red-400 active:scale-95 transition-all"
          >
            {o}
          </button>
        ))}
      </div>
      {err && <p role="alert" className="text-center text-sm font-bold text-red-600 mt-4">{err}</p>}
      <div className="text-center mt-6 min-h-[3rem]">
        {showHint ? (
          <p className="text-amber-700 bg-amber-50 rounded-xl px-4 py-2 inline-block">{puzzle.hint}</p>
        ) : (
          <button onClick={() => setShowHint(true)} className="text-sm font-bold text-brand-600 hover:underline">Pedir dica</button>
        )}
      </div>
      <WinPanel title={`Desafio ${ctl.challenge} concluído!`} text={`${mistakes} erro(s).`} ctl={ctl} />
    </>
  );
};

const SequenceGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const ctl = usePlay('sequence');
  const [stats, setStats] = useState('');
  return (
    <GameShell title="Sequências" slug="sequence" ctl={ctl} onBack={onBack} stats={stats}>
      {ctl.play?.puzzles && <Board key={ctl.play.playId} ctl={ctl} puzzles={ctl.play.puzzles} onProgress={setStats} />}
    </GameShell>
  );
};

export default SequenceGame;
