import React, { useEffect } from 'react';
import Logo from '../components/Logo';
import { SUPPORT_EMAIL } from '../config';
import { GAME_PAGES, LINK_LABELS, PUBLIC_BY_PATH, PublicPageData } from '../content/public';

// Páginas públicas (sem login) com conteúdo próprio: início, jogos, Sobre e Perguntas frequentes.
// O mesmo texto é pré-renderizado em HTML no build (vite.config.ts), que é o que o Google lê; aqui ele ganha o visual do app.
const NAV = [PUBLIC_BY_PATH['/jogos'], PUBLIC_BY_PATH['/sobre'], PUBLIC_BY_PATH['/faq']];

const PublicPage: React.FC<{ page: PublicPageData }> = ({ page }) => {
  useEffect(() => {
    document.title = page.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', page.description);
  }, [page]);

  const showGames = page.path === '/' || page.path === '/jogos';

  return (
    <div className="min-h-screen bg-white text-slate-700">
      <header className="bg-gradient-main text-white pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <a href="/" aria-label="Thinkrplay, página inicial"><Logo tone="dark" size={34} /></a>
          <nav aria-label="Principal" className="hidden sm:flex items-center gap-5 text-sm font-semibold text-brand-100">
            {NAV.map((n) => <a key={n.path} href={n.path} className="hover:text-white">{n.navLabel}</a>)}
          </nav>
          <a href="/entrar" className="bg-white text-brand-700 font-black text-sm rounded-xl px-4 py-2 hover:bg-brand-50">Entrar</a>
        </div>
        <div className="max-w-3xl mx-auto px-4 pt-8 pb-14 text-center">
          {page.icon && <p className="text-5xl mb-3" aria-hidden="true">{page.icon}</p>}
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight">{page.h1}</h1>
          <p className="text-lg text-brand-200 mt-4">{page.lead}</p>
          <a href="/entrar" className="inline-block mt-7 bg-mint-400 text-ink-900 font-black rounded-xl px-7 py-3.5 hover:bg-mint-300">{page.cta}</a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        {page.blocks.map((b) => (
          <section key={b.heading}>
            <h2 className="text-xl sm:text-2xl font-extrabold text-ink-900 mb-3">{b.heading}</h2>
            {b.paragraphs?.map((p) => <p key={p} className="leading-relaxed mb-3">{p}</p>)}
            {b.list && (b.ordered
              ? <ol className="list-decimal pl-6 space-y-2 leading-relaxed">{b.list.map((i) => <li key={i}>{i}</li>)}</ol>
              : <ul className="list-disc pl-6 space-y-2 leading-relaxed">{b.list.map((i) => <li key={i}>{i}</li>)}</ul>)}
          </section>
        ))}

        {showGames && (
          <section>
            <h2 className="text-xl sm:text-2xl font-extrabold text-ink-900 mb-3">Conheça cada jogo</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {GAME_PAGES.map((g) => (
                <li key={g.path}>
                  <a href={g.path} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-brand-50 p-4 font-bold text-ink-800">
                    <span className="text-2xl" aria-hidden="true">{g.icon}</span>
                    <span>{g.navLabel}<span className="block text-xs font-medium text-slate-500">Como jogar e dicas</span></span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-3xl bg-brand-600 text-white p-8 text-center">
          <h2 className="text-2xl font-black mb-2">Pronto para começar?</h2>
          <p className="text-brand-100 mb-5">Crie a sua conta grátis e comece pelo nível Easy.</p>
          <a href="/entrar" className="inline-block bg-white text-brand-700 font-black rounded-xl px-7 py-3 hover:bg-brand-50">{page.cta}</a>
        </section>

        {page.related && page.related.length > 0 && (
          <nav aria-label="Veja também">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">Veja também</h2>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
              {page.related.map((p) => <li key={p}><a href={p} className="text-brand-700 hover:underline">{LINK_LABELS[p] ?? p}</a></li>)}
            </ul>
          </nav>
        )}
      </main>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400 space-x-3">
        <a href="/sobre" className="hover:underline">Sobre</a>
        <a href="/faq" className="hover:underline">Perguntas frequentes</a>
        <a href="/termos" className="hover:underline">Termos de Uso</a>
        <a href="/privacidade" className="hover:underline">Política de Privacidade</a>
        {SUPPORT_EMAIL && <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:underline">Suporte</a>}
        <p className="mt-3">© Thinkrplay</p>
      </footer>
    </div>
  );
};

export default PublicPage;
