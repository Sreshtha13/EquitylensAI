import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/market', label: 'Markets' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/login', label: 'Login' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-wide text-white">
          EquityLensAI
        </Link>
        <nav className="flex items-center gap-5 text-sm text-slate-300">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
