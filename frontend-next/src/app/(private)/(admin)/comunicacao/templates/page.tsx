import { redirect } from 'next/navigation';
import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import { AsyncBoundary } from '@/components/async-boundary';
import { SubNavLayout, type SubNavSection, TabsContent } from '@/components/sub-nav-layout';
import LangLabel from '@/components/ui/langLabel';
import { serverCanAccessRoute, serverFeatureFlag } from '@/lib/server-context';
import { TemplateListTab } from '../components/template-list-tab';
import { TemplateTypeTab } from '../components/template-type-tab';
import { FileText, Layers } from 'lucide-react';

const templateSections: SubNavSection[] = [
  {
    items: [
      {
        id: 'templates',
        label: <LangLabel text="templatesTab" langJson="messaging" />,
        icon: <FileText className="size-4" />,
      },
      {
        id: 'types',
        label: <LangLabel text="templateTypesTab" langJson="messaging" />,
        icon: <Layers className="size-4" />,
      },
    ],
  },
];

export default async function CommunicationTemplatesPage() {
  const [enabled, canAccess] = await Promise.all([
    serverFeatureFlag('MESSAGING_TEMPLATES'),
    serverCanAccessRoute('/comunicacao/templates'),
  ]);
  if (!enabled || !canAccess) redirect('/home');

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={<LangLabel text="templatesPageTitle" langJson="messaging" />}
        description={<LangLabel text="templatesPageDescription" langJson="messaging" />}
      />
      <SubNavLayout sections={templateSections} defaultTab="templates">
        <AsyncBoundary>
          <TabsContent value="templates" className="mt-0 space-y-4">
            <TemplateListTab />
          </TabsContent>
          <TabsContent value="types" className="mt-0 space-y-4">
            <TemplateTypeTab />
          </TabsContent>
        </AsyncBoundary>
      </SubNavLayout>
    </Container>
  );
}
