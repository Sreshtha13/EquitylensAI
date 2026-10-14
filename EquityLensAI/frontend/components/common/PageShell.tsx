import { type ReactNode } from 'react';

export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-300/80">EquityLensAI</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{description}</p>
      {children ? <div className="mt-10">{children}</div> : null}
    </main>
  );
}
