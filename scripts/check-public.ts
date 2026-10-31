// Confere as páginas públicas (content/public.ts): títulos e descrições únicos e de tamanho razoável, links internos que existem
// e uma página por jogo do app. É o que o Google lê antes do login.
import assert from 'node:assert/strict';
import { GAME_PAGES, LINK_LABELS, PUBLIC_PAGES } from '../content/public';

const GAME_SLUGS = ['sudoku', 'memory', 'sequence', 'hanoi', 'lights', 'mastermind']; // os mesmos jogos do app (config.ts)
const known = new Set([...PUBLIC_PAGES.map((p) => p.path), '/termos', '/privacidade']);
const titles = new Set<string>();
const descriptions = new Set<string>();
for (const page of PUBLIC_PAGES) {
  assert.ok(page.title.length >= 20 && page.title.length <= 75, `título com tamanho estranho: ${page.path} (${page.title.length})`);
  assert.ok(page.description.length >= 80 && page.description.length <= 175, `descrição com tamanho estranho: ${page.path} (${page.description.length})`);
  assert.ok(!titles.has(page.title), `título repetido: ${page.title}`);
  assert.ok(!descriptions.has(page.description), `descrição repetida: ${page.path}`);
  titles.add(page.title);
  descriptions.add(page.description);
  assert.ok(page.blocks.length >= 2, `pouco conteúdo: ${page.path}`);
  const words = page.blocks.flatMap((b) => [...(b.paragraphs ?? []), ...(b.list ?? [])]).join(' ').split(/\s+/).length;
  assert.ok(words >= 120, `página com pouco texto (${words} palavras): ${page.path}`);
  for (const link of page.related ?? []) {
    assert.ok(known.has(link), `link interno inexistente em ${page.path}: ${link}`);
    assert.ok(LINK_LABELS[link], `link sem rótulo: ${link}`);
  }
}
for (const slug of GAME_SLUGS) assert.ok(GAME_PAGES.some((p) => p.slug === slug), `jogo sem página pública: ${slug}`);
assert.equal(GAME_PAGES.length, GAME_SLUGS.length);
console.log(`Páginas públicas OK (${PUBLIC_PAGES.length} páginas)`);
