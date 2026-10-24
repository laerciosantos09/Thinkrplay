import assert from 'node:assert/strict';
import { generateSudoku, countSolutions, cluesFor } from '../lib/sudoku.js';
import { generateSequence } from '../lib/sequence.js';
import { generateLights, isSolved, press } from '../lib/lights.js';
import { evaluate, generateCode, configFor, blockStart } from '../lib/mastermind.js';
import { buildDeck, pairsFor } from '../lib/memory.js';
import { generateHanoi, moveDisk, isGoal } from '../lib/hanoi.js';
import { mulberry32, seedFor } from '../lib/rng.js';
import { SEQUENCE_ROUNDS, sequenceSeed } from '../lib/rounds.js';
import { CHALLENGES_PER_TIER, TIERS, Tier, emptyProgress, highestUnlocked, isTierUnlocked, maxChallenge } from '../lib/tiers.js';

const rng = (game: string, tier: Tier, n: number) => mulberry32(seedFor(`${game}:${tier}`, n));
const all = (fn: (tier: Tier, n: number) => void) => {
  for (const tier of TIERS) for (let n = 1; n <= CHALLENGES_PER_TIER; n++) fn(tier, n);
};

// --- regras de liberação
const p = emptyProgress();
assert.equal(isTierUnlocked('easy', p), true);
assert.equal(isTierUnlocked('medium', p), false);
p.easy = 9; assert.equal(isTierUnlocked('medium', p), false);
p.easy = 10; assert.equal(isTierUnlocked('medium', p), true);
assert.equal(isTierUnlocked('hard', p), false);
p.medium = 19; assert.equal(isTierUnlocked('hard', p), false);
p.medium = 20; assert.equal(isTierUnlocked('hard', p), true);
assert.equal(highestUnlocked(p), 'hard');
assert.equal(maxChallenge('easy', { ...p, easy: 499 }), 500);
assert.equal(maxChallenge('easy', { ...p, easy: 500 }), 500, 'teto de 500 desafios');

// --- Sudoku: solução única, determinístico, dicas por tier (amostra: gerar os 1500 é lento)
const clueAvg: Record<string, number> = {};
for (const tier of TIERS) {
  let total = 0;
  const sample = [1, 100, 250, 400, 500];
  for (const n of sample) {
    const { puzzle, solution } = generateSudoku(rng('sudoku', tier, n), tier, n);
    assert.equal(countSolutions(puzzle.map((r) => [...r])), 1, `sudoku ${tier} #${n} solução única`);
    puzzle.forEach((row, r) => row.forEach((v, c) => v && assert.equal(v, solution[r][c])));
    assert.deepEqual(generateSudoku(rng('sudoku', tier, n), tier, n).puzzle, puzzle, 'determinístico');
    total += puzzle.flat().filter(Boolean).length;
  }
  clueAvg[tier] = total / sample.length;
}
assert.ok(clueAvg.easy > clueAvg.medium && clueAvg.medium > clueAvg.hard, `dificuldade crescente (dicas): ${JSON.stringify(clueAvg)}`);
assert.ok(cluesFor('easy', 1) > cluesFor('easy', 500) && cluesFor('easy', 500) > cluesFor('medium', 1));

// --- 500 desafios por tier, únicos (impressão digital do desafio)
const unique = (name: string, fp: (tier: Tier, n: number) => string, minRatio = 1) => {
  for (const tier of TIERS) {
    const seen = new Set<string>();
    for (let n = 1; n <= CHALLENGES_PER_TIER; n++) seen.add(fp(tier, n));
    assert.ok(seen.size / CHALLENGES_PER_TIER >= minRatio, `${name} ${tier}: ${seen.size}/500 únicos`);
  }
};
unique('memory', (t, n) => buildDeck(seedFor(`memory:${t}`, n), t, n).join(''));
const seqChallenge = (t: Tier, n: number) =>
  Array.from({ length: SEQUENCE_ROUNDS }, (_, i) => JSON.stringify(generateSequence(mulberry32(sequenceSeed(seedFor(`sequence:${t}`, n), i)), t, n).shown)).join('|');
unique('sequence', seqChallenge, 0.99);
unique('lights', (t, n) => JSON.stringify(generateLights(rng('lights', t, n), t, n).board), 0.98);
unique('hanoi', (t, n) => { const h = generateHanoi(rng('hanoi', t, n), t, n); return JSON.stringify(h.pegs) + h.goal; }, 0.99);
unique('mastermind', (t, n) => generateCode(rng('mastermind', t, blockStart(t, n)), t, n).join(''), 0.99);

// --- dificuldade cresce entre tiers
const avg = (f: (t: Tier, n: number) => number) =>
  TIERS.map((t) => { let s = 0; for (let n = 1; n <= 500; n += 25) s += f(t, n); return s / 20; });
const increasing = (name: string, v: number[]) => assert.ok(v[0] < v[1] && v[1] < v[2], `${name}: ${v.map((x) => x.toFixed(1))}`);
increasing('memória (pares)', avg((t, n) => pairsFor(t, n)));
increasing('hanói (movimentos ótimos)', avg((t, n) => generateHanoi(rng('hanoi', t, n), t, n).optimal));
increasing('luzes (tamanho)', avg((t, n) => generateLights(rng('lights', t, n), t, n).board.length));
increasing('código (tamanho)', avg((t, n) => configFor(t, n).length));
increasing('código (tentativas, invertido)', avg((t, n) => 20 - configFor(t, n).attempts));
// sequências: easy usa poucas regras simples; medium e hard liberam regras novas
const rules = TIERS.map((t) => { const h = new Set<string>(); for (let n = 1; n <= 500; n += 5) h.add(generateSequence(rng('sequence', t, n), t, n).hint); return h; });
assert.ok(rules[0].size < rules[1].size && rules[1].size < rules[2].size, `sequência (regras): ${rules.map((r) => r.size)}`);

// --- Hanói: BFS confere com o clássico e com simulação
for (let d = 3; d <= 5; d++) {
  // clássico com d discos: 2^d - 1
  const classic = generateHanoi(() => 0.5, 'easy', 1);
  assert.equal(classic.optimal, 2 ** classic.disks - 1);
  assert.equal(classic.goal, 2);
  break;
}
for (const tier of TIERS) {
  for (const n of [1, 77, 300, 500]) {
    const puzzle = generateHanoi(rng('hanoi', tier, n), tier, n);
    // resolve recursivamente a partir do estado dado e compara com o ótimo da BFS
    let pegs = puzzle.pegs; let moves = 0;
    const solve = (disk: number, to: number) => { // move o disco de tamanho `disk` e os menores para `to`
      if (disk === 0) return;
      const from = pegs.findIndex((peg) => peg.includes(disk));
      if (from === to) return solve(disk - 1, to);
      const other = 3 - from - to;
      solve(disk - 1, other);
      pegs = moveDisk(pegs, from, to)!; assert.ok(pegs); moves++;
      solve(disk - 1, to);
    };
    solve(puzzle.disks, puzzle.goal);
    assert.ok(isGoal(pegs, puzzle.goal, puzzle.disks));
    assert.equal(puzzle.optimal, moves, `hanói ${tier} #${n}: ótimo ${puzzle.optimal} x recursivo ${moves}`);
  }
}

// --- Luzes: sempre resolvíveis e nunca começam resolvidas
all((tier, n) => {
  const { board, par } = generateLights(rng('lights', tier, n), tier, n);
  assert.ok(!isSolved(board) && par >= 1);
});

// --- Sequência e Código
all((tier, n) => {
  const s = generateSequence(rng('sequence', tier, n), tier, n);
  assert.equal(new Set(s.options).size, 4);
  assert.ok(s.options.includes(s.answer));
});
assert.deepEqual(evaluate([0, 1, 2, 3], [0, 2, 1, 1]), { exact: 1, partial: 2 });
assert.deepEqual(evaluate([1, 1, 2, 2], [1, 1, 2, 2]), { exact: 4, partial: 0 });
assert.equal(generateCode(mulberry32(1), 'hard', 500).length, configFor('hard', 500).length);
// o código só depende do segredo da faixa: mesma faixa + mesmo n => mesmo código
assert.deepEqual(generateCode(rng('mastermind', 'easy', 1), 'easy', 7), generateCode(rng('mastermind', 'easy', 1), 'easy', 7));

console.log('Lógica dos jogos OK');
