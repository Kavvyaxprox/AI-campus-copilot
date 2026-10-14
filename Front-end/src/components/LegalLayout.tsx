import { Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap, ShieldCheck } from 'lucide-react';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

interface LegalLayoutProps {
  title: string;
  updated: string;
  summary: string;
  sections: LegalSection[];
}

export default function LegalLayout({ title, updated, summary, sections }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
              <GraduationCap className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">AI Campus Copilot</p>
              <p className="text-xs text-slate-500">{title}</p>
            </div>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <article className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            AI Campus Copilot
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>
          <p className="mt-4 border-l-4 border-emerald-500 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            {summary}
          </p>

          <div className="mt-8 space-y-8">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg font-bold text-slate-900">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-2 text-sm leading-7 text-slate-700">
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-3 space-y-2">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2 text-sm leading-6 text-slate-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm">
            <Link to="/login" className="font-semibold text-slate-700 hover:text-slate-900 hover:underline">
              Sign in
            </Link>
            <Link to="/privacy" className="font-semibold text-slate-700 hover:text-slate-900 hover:underline">
              Privacy Policy
            </Link>
            <Link to="/terms" className="font-semibold text-slate-700 hover:text-slate-900 hover:underline">
              Terms and Conditions
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
