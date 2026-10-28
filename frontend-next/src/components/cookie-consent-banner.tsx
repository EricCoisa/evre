'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLocalStorage } from '@/hooks/use-localStorage';
import type { CookieConsentData } from '@/lib/actions/cms/cookie-consent/type';

const STORAGE_KEY = 'cookie-consent';
type Choice = 'accepted' | 'declined';

export function CookieConsentBanner({ data }: { data: CookieConsentData | null }) {
  const { getValue, setValue } = useLocalStorage<Choice>(STORAGE_KEY);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(!getValue());
  }, [getValue]);

  if (!data || !visible) return null;

  const choose = (choice: Choice) => {
    setValue(choice);
    setVisible(false);
  };

  return (
    <div role="dialog" aria-label="Consentimento de cookies" className="fixed inset-x-0 bottom-0 z-50 border-t bg-background p-4 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {data.message}{' '}
          {data.policyLinkSlug && (
            <Link href={`/legal/${data.policyLinkSlug}`} className="underline hover:text-foreground">
              {data.policyLinkText || 'Saiba mais'}
            </Link>
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose('declined')}>
            {data.declineButtonText}
          </Button>
          <Button size="sm" onClick={() => choose('accepted')}>
            {data.acceptButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
