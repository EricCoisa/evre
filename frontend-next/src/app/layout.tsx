import "./globals.css";


import { AppProvider } from "@/contexts/appProvider";
import { QueryProvider } from "@/contexts/query-provider";
import { ThemeProvider } from "@/contexts/theme-provider";
import { SystemConfiguration } from "@/lib/actions/systemConfiguration/types";
import { APINEXT } from "@/lib/api/apiNext";
import { Toaster } from "sonner";
import { headers } from 'next/headers';
import { isServerAuthenticated } from "@/lib/actions/auth/server-auth";
import { redirect } from 'next/navigation';
import { getCookieConsent } from "@/lib/actions/cms/cookie-consent/api";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const config = await APINEXT.GET<SystemConfiguration<string>>(`/public-proxy?url=/system-configuration/default-theme`, { cache: 'no-store' }).catch(() => null);

  const headersList = headers();
  const pathname = (await headersList).get('x-pathname') || '/';

  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) {

      const isAuthenticated = await isServerAuthenticated();

      if (!isAuthenticated) {
        redirect('/login');
      }
    return children;
  }

  const cookieConsent = await getCookieConsent();

  return (
    <html lang="pt-br" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <QueryProvider>
          <AppProvider>
            <ThemeProvider defaultTheme={config ? config.value : undefined}>
              {children}
              <CookieConsentBanner data={cookieConsent} />
              <Toaster />
            </ThemeProvider>
          </AppProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
