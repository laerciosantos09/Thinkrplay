import React, { useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { PlayCtl, usePlay } from '../services/usePlay';
import { PALETTE, configForLevel } from '../lib/mastermind';

interface Guess { colors: number[]; exact: number; partial: number }
interface GuessResponse { exact: number; partial: number; done: boolean; won?: boolean; code?: number[]; points?: number; unlocked?: number }

// O código secreto nunca sai do servidor: ele devolve só o feedback de cada palpite.
const Board: React.FC<{ ctl: PlayCtl }> = ({ ctl }) => {
  const cfg = configForLevel(ctl.level);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [current, setCurrent] = useState<(number | null)[]>(Array(cfg.length).fill(null));
  const [revealed, setRevealed] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = (color: number) => {
    const slot = current.indexOf(null);
    if (slot >= 0) setCurrent(current.map((v, i) => (i === slot ? color : v)));
  };

  const submit = async () => {
    if (current.includes(null) || busy) return;
    const colors = current as number[];
    setBusy(true);
    setErr(null);
    try {
      const r = await ctl.guess<GuessResponse>({ guess: colors });
      setGuesses((g) => [...g, { colors, exact: r.exact, partial: r.partial }]);
      setCurrent(Array(cfg.length).fill(null));
      if (r.code) setRevealed(r.code);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar o palpite.');
    } finally {
      setBusy(false);
    }
  };

  const over = ctl.result !== null || revealed !== null;

  return (
    <>
      <p className="text-center text-slate-500 mb-1 text-sm">
        {guesses.length}/{cfg.attempts} tentativas · {cfg.length} posições · {cfg.colors} cores
      </p>
      <p className="text-center text-slate-500 mb-4 text-sm">● cor e posição certas · ○ cor certa, posição errada.</p>

      <div className="max-w-md mx-auto space-y-2 mb-6">
        {guesses.map((g, i) => (
          <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
            <div className="flex gap-2">
              {g.colors.map((c, k) => <span key={k} className="w-8 h-8 rounded-full" style={{ background: PALETTE[c] }} />)}
            </div>
            <span className="font-black tracking-widest text-slate-700" aria-label={`${g.exact} certas, ${g.partial} na posição errada`}>
              {'●'.repeat(g.exact)}<span className="text-slate-400">{'○'.repeat(g.partial)}</span>
            </span>
          </div>
        ))}
      </div>

      {revealed && (
        <div className="flex justify-center gap-2 mb-4">
          {revealed.map((c, k) => <span key={k} className="w-9 h-9 rounded-full ring-2 ring-slate-800" style={{ background: PALETTE[c] }} />)}
        </div>
      )}

      {!over && (
        <>
          <div className="flex justify-center gap-2 mb-4">
            {current.map((c, k) => (
              <button
                key={k}
                aria-label={`Posição ${k + 1}`}
                onClick={() => setCurrent(current.map((v, i) => (i === k ? null : v)))}
                className="w-11 h-11 rounded-full border-2 border-dashed border-slate-300"
                style={{ background: c === null ? 'transparent' : PALETTE[c] }}
              />
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {PALETTE.slice(0, cfg.colors).map((color, i) => (
              <button key={i} aria-label={`Cor ${i + 1}`} onClick={() => pick(i)} className="w-11 h-11 rounded-full shadow active:scale-90" style={{ background: color }} />
            ))}
          </div>
          {err && <p role="alert" className="text-center text-sm font-bold text-red-600 mb-3">{err}</p>}
          <div className="text-center">
            <button onClick={submit} disabled={current.includes(null) || busy} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black disabled:opacity-40">
              {busy ? 'Conferindo...' : 'Testar combinação'}
            </button>
          </div>
        </>
      )}

      <WinPanel title="Código decifrado!" text={`Em ${guesses.length} tentativa(s).`} ctl={ctl} />
      {revealed && (
        <div className="mt-6 p-6 bg-red-50 rounded-2xl border border-red-200 text-center">
          <h3 className="text-xl font-black text-red-700 mb-2">Não foi desta vez</h3>
          <p className="text-red-600 mb-3">Esse era o código. Tente um novo.</p>
          <button onClick={ctl.restart} className="bg-red-600 text-white px-8 py-2 rounded-full font-bold">Tentar outro código</button>
        </div>
      )}
    </>
  );
};

const MastermindGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const ctl = usePlay('mastermind');
  return (
    <GameShell title="Código Secreto" slug="mastermind" ctl={ctl} onBack={onBack}>
      {ctl.play && <Board key={ctl.play.playId} ctl={ctl} />}
    </GameShell>
  );
};

export default MastermindGame;
