import assert from 'node:assert/strict';
import { generateSudoku, countSolutions, cluesForLevel } from '../lib/sudoku.js';
import { generateSequence } from '../lib/sequence.js';
import { generateLights, isSolved, press } from '../lib/lights.js';
import { evaluate, generateCode, configForLevel } from '../lib/mastermind.js';
import { mulberry32, seedFor } from '../lib/rng.js';

for (const level of [1, 40, 120, 500, 1000]) {
  const { puzzle, solution } = generateSudoku(mulberry32(seedFor('sudoku', level)), level);
  assert.equal(countSolutions(puzzle.map((r) => [...r])), 1, `sudoku nível ${level} deve ter solução única`);
  puzzle.forEach((row, r) => row.forEach((v, c) => v && assert.equal(v, solution[r][c])));
  const clues = puzzle.flat().filter(Boolean).length;
  assert.ok(clues <= cluesForLevel(level) + 4, `dicas (${clues}) próximas do alvo`);
  const again = generateSudoku(mulberry32(seedFor('sudoku', level)), level);
  assert.deepEqual(again.puzzle, puzzle, 'determinístico');
}

for (let level = 1; level <= 1000; level += 7) {
  const p = generateSequence(mulberry32(seedFor('sequence', level)), level);
  assert.equal(p.options.length, 4);
  assert.equal(new Set(p.options).size, 4, 'opções únicas');
  assert.ok(p.options.includes(p.answer));
}

for (let level = 1; level <= 200; level += 3) {
  const { board, par } = generateLights(mulberry32(seedFor('lights', level)), level);
  assert.ok(!isSolved(board) && par >= 1);
  assert.equal(isSolved(press(press(board, 0, 0), 0, 0)), false);
}

assert.deepEqual(evaluate([0, 1, 2, 3], [0, 2, 1, 1]), { exact: 1, partial: 2 });
assert.deepEqual(evaluate([1, 1, 2, 2], [1, 1, 2, 2]), { exact: 4, partial: 0 });
assert.equal(generateCode(mulberry32(1), 40).length, configForLevel(40).length);

console.log('Lógica dos jogos OK');
