import { redirect } from 'next/navigation';
import { serverCanAccessRoute, serverFeatureFlag } from '@/lib/server-context';
import { MessagingContacts } from './components/messaging-contacts';
import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import LangLabel from '@/components/ui/langLabel';

export default async function CommunicationPage() {
  const [contactsEnabled, canAccess] = await Promise.all([
    serverFeatureFlag('MESSAGING_CONTACTS'),
    serverCanAccessRoute('/comunicacao'),
  ]);

  if (!contactsEnabled || !canAccess) redirect('/home');

  // As janelas de conversa vêm do MessagingChatProvider, no layout privado.
  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={<LangLabel text="pageTitle" langJson="messaging" />}
        description={<LangLabel text="pageDescription" langJson="messaging" />}
      />
      <MessagingContacts/>
    </Container>
  );
}
