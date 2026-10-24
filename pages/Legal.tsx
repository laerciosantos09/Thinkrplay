import React from 'react';
import Logo from '../components/Logo';
import { LegalDocument, PRIVACY, TERMS } from '../content/legal';

// Página pública (não exige login): é a URL que as lojas de apps pedem para a política de privacidade.
const LegalPage: React.FC<{ doc: LegalDocument }> = ({ doc }) => (
  <div className="min-h-screen bg-brand-50/40">
    <header className="bg-ink-900 text-white">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" aria-label="Ir para o início"><Logo size={32} /></a>
        <a href="/" className="text-sm font-bold text-slate-300 hover:text-white">Voltar ao app &rarr;</a>
      </div>
    </header>

    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <nav className="flex gap-2 mb-6" aria-label="Documentos legais">
        {[TERMS, PRIVACY].map((d) => (
          <a
            key={d.path} href={d.path} aria-current={d.path === doc.path ? 'page' : undefined}
            className={`px-4 py-2 rounded-full text-sm font-bold ${d.path === doc.path ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            {d.title}
          </a>
        ))}
      </nav>

      <article className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-10">
        <h1 className="text-3xl font-extrabold text-ink-900 mb-3">{doc.title}</h1>
        <p className="text-slate-500 mb-8">{doc.intro}</p>
        <div className="space-y-7">
          {doc.sections.map((section, i) => (
            <section key={section.title}>
              <h2 className="text-lg font-extrabold text-ink-800 mb-2">{i + 1}. {section.title}</h2>
              {section.paragraphs?.map((p) => <p key={p} className="text-slate-600 leading-relaxed mb-2">{p}</p>)}
              {section.items && (
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600 leading-relaxed mb-2">
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
              {section.after?.map((p) => <p key={p} className="text-slate-600 leading-relaxed mb-2">{p}</p>)}
            </section>
          ))}
        </div>
      </article>
    </main>
  </div>
);

export const LEGAL_ROUTES: Record<string, LegalDocument> = { '/termos': TERMS, '/privacidade': PRIVACY };

export default LegalPage;
