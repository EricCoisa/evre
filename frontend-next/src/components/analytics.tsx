'use client';

import Script from 'next/script';
import { useCookieConsent } from '@/hooks/use-cookie-consent';

const GA4_ID_PATTERN = /^G-[A-Z0-9]+$/;
const CLARITY_ID_PATTERN = /^[a-z0-9]+$/i;

export function Analytics({ ga4Id, clarityId }: { ga4Id: string; clarityId: string }) {
  const consented = useCookieConsent();

  if (!consented) return null;
  const ga4 = GA4_ID_PATTERN.test(ga4Id) ? ga4Id : '';
  const clarity = CLARITY_ID_PATTERN.test(clarityId) ? clarityId : '';

  return (
    <>
      {ga4 && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${ga4}');
          `}</Script>
        </>
      )}
      {clarity && (
        <Script id="clarity-init" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window,document,"clarity","script","${clarity}");
        `}</Script>
      )}
    </>
  );
}
