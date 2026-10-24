import React, { useMemo, useState } from 'react';
import GameShell, { WinPanel } from '../components/GameShell';
import { PlayCtl, usePlay } from '../services/usePlay';
import { generateLights, isSolved, press } from '../lib/lights';
import { mulberry32 } from '../lib/rng';

const Board: React.FC<{ ctl: PlayCtl; seed: number; onTaps: (n: number, par: number) => void }> = ({ ctl, seed, onTaps }) => {
  const initial = useMemo(() => generateLights(mulberry32(seed), ctl.level), [seed, ctl.level]);
  const [board, setBoard] = useState(initial.board);
  const [taps, setTaps] = useState<[number, number][]>([]);

  const tap = (r: number, c: number) => {
    if (ctl.result) return;
    const next = press(board, r, c);
    const all: [number, number][] = [...taps, [r, c]];
    setBoard(next);
    setTaps(all);
    onTaps(all.length, initial.par);
    if (isSolved(next)) ctl.finish({ taps: all });
  };

  return (
    <>
      <p className="text-center text-slate-500 mb-4 text-sm">Cada toque inverte a luz e as 4 vizinhas. Apague todas.</p>
      <div className="grid gap-2 max-w-[420px] mx-auto" style={{ gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` }}>
        {board.map((row, r) =>
          row.map((on, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => tap(r, c)}
              aria-label={`Luz ${r + 1},${c + 1} ${on ? 'acesa' : 'apagada'}`}
              className={`aspect-square rounded-xl transition-all active:scale-90 ${on ? 'bg-yellow-300 shadow-[0_0_18px_4px_rgba(253,224,71,0.7)]' : 'bg-ink-800'}`}
            />
          )),
        )}
      </div>
      <WinPanel title="Tudo apagado!" text={`${taps.length} toques (meta: ${initial.par}).`} ctl={ctl} />
    </>
  );
};

const LightsGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const ctl = usePlay('lights');
  const [stats, setStats] = useState('');
  return (
    <GameShell title="Luzes" slug="lights" ctl={ctl} onBack={onBack} stats={stats}>
      {ctl.play && <Board key={ctl.play.playId} ctl={ctl} seed={ctl.play.seed!} onTaps={(n, par) => setStats(`${n} toques · meta ${par}`)} />}
    </GameShell>
  );
};

export default LightsGame;
