import "./globals.css";


import { QueryProvider } from "@/contexts/query-provider";
import { ThemeProvider } from "@/contexts/theme-provider";
import { SystemConfiguration } from "@/lib/actions/systemConfiguration/types";
import { APINEXT } from "@/lib/api/apiNext";
import { Toaster } from "sonner";


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

const config = await APINEXT.GET<SystemConfiguration<string>>(`/public-proxy?url=/system-configuration/default-theme`, { cache: 'no-store' });
  return (
    <html lang="pt-br" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <QueryProvider>
            <ThemeProvider defaultTheme={config ? config.value : undefined}>
              {children}
                            <Toaster />
            </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
