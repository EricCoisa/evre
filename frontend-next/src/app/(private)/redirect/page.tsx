'use client';
import { redirect } from 'next/navigation';
import { useMe } from '@/lib/actions/auth/queries';

export default function RedirectPage() {
  const user = useMe();
  const home = user.data?.routes.find(route => route.isHome);
  redirect(home?.path || '/home');

  return (
    <div>...</div>
  );
}
