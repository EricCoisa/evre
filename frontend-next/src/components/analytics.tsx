'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const CONSENT_KEY = 'cookie-consent';

export function Analytics({ ga4Id, clarityId }: { ga4Id: string; clarityId: string }) {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const check = () => {
      try {
        setConsented(localStorage.getItem(CONSENT_KEY) === '"accepted"');
      } catch {}
    };

    check();
    window.addEventListener('cookie-consent-change', check);
    return () => window.removeEventListener('cookie-consent-change', check);
  }, []);

  if (!consented) return null;

  return (
    <>
      {ga4Id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${ga4Id}');
          `}</Script>
        </>
      )}
      {clarityId && (
        <Script id="clarity-init" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window,document,"clarity","script","${clarityId}");
        `}</Script>
      )}
    </>
  );
}
