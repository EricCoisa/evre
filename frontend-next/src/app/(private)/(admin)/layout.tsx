// Access check moved to middleware — runs on every request including soft nav
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
