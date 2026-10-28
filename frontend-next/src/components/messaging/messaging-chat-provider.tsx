import { serverCanAccessRoute, serverFeatureFlag } from '@/lib/server-context';
import { ChatWindowsProvider } from './chat-windows-provider';

/** Liga o chat ao layout privado quando a flag e o acesso a /comunicacao permitem; senão openChat é no-op. */
export async function MessagingChatProvider({ children }: { children: React.ReactNode }) {
  const [chatFlag, canAccess] = await Promise.all([
    serverFeatureFlag('MESSAGING_CHAT'),
    serverCanAccessRoute('/comunicacao'),
  ]);

  return <ChatWindowsProvider chatEnabled={chatFlag && canAccess}>{children}</ChatWindowsProvider>;
}
