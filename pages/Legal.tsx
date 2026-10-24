import React, { useEffect } from 'react';
import Logo from '../components/Logo';
import { LegalDocument, PRIVACY, TERMS } from '../content/legal';

// Página pública (não exige login): é a URL que as lojas de apps pedem para a política de privacidade.
const LegalPage: React.FC<{ doc: LegalDocument }> = ({ doc }) => {
  useEffect(() => {
    document.title = `${doc.title} - Thinkrplay`;
  }, [doc.title]);

  const back = (e: React.MouseEvent) => {
    // volta para onde a pessoa estava (ex.: o cadastro); sem histórico, vai ao início
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
      e.preventDefault();
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <a href="/" onClick={back} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 transition-colors">
            <span aria-hidden="true">&lsaquo;</span> Voltar
          </a>
        </div>
        <div className="flex justify-center mb-8">
          <Logo tone="light" size={36} />
        </div>

        <h1 className="text-2xl font-bold mb-2">{doc.title}</h1>
        <p className="text-sm text-slate-500 mb-8">Última atualização: {doc.updated}</p>

        <div className="space-y-6">
          {doc.sections.map((section, i) => (
            <section key={section.title}>
              <h2 className="text-base font-semibold mb-2">{i + 1}. {section.title}</h2>
              <p className="text-sm text-slate-700 leading-relaxed">{section.text}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 text-center">
          <a href={doc.otherPath} className="text-sm text-brand-600 hover:underline">{doc.otherLabel}</a>
        </div>
      </div>
    </div>
  );
};

export const LEGAL_ROUTES: Record<string, LegalDocument> = { [TERMS.path]: TERMS, [PRIVACY.path]: PRIVACY };

export default LegalPage;
