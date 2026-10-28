import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          {SITE_NAME}
        </Link>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {SITE_NAME}
      </footer>
    </div>
  );
}
