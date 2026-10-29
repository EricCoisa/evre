'use client';

import { useState } from 'react';
import { FileText, History, Receipt, Send } from 'lucide-react';
import { SubNavLayout, type SubNavSection, TabsContent } from '@/components/sub-nav-layout';
import LangLabel from '@/components/ui/langLabel';
import type { Proposal } from '@/lib/actions/proposal/types';
import { ProposalCommercialTab } from './proposal-commercial-tab';
import { ProposalContentTab } from './proposal-content-tab';
import { ProposalPublicationTab } from './proposal-publication-tab';
import { ProposalVersionsTab } from './proposal-versions-tab';

const proposalDetailSections: SubNavSection[] = [
  {
    items: [
      {
        id: 'conteudo',
        label: <LangLabel text="tabContent" langJson="proposal" />,
        icon: <FileText className="size-4" />,
      },
      {
        id: 'comercial',
        label: <LangLabel text="tabCommercial" langJson="proposal" />,
        icon: <Receipt className="size-4" />,
      },
      {
        id: 'publicacao',
        label: <LangLabel text="tabPublication" langJson="proposal" />,
        icon: <Send className="size-4" />,
      },
      {
        id: 'versoes',
        label: <LangLabel text="tabVersions" langJson="proposal" />,
        icon: <History className="size-4" />,
      },
    ],
  },
];

/** Dono do `SubNavLayout` da página de detalhe — fica em Client Component porque precisa do
 * estado de edição da aba `conteudo` para esconder a sidebar enquanto o editor está aberto (A5). */
export function ProposalDetailTabs({ proposal }: { proposal: Proposal }) {
  const [editingContent, setEditingContent] = useState(false);

  return (
    <SubNavLayout
      sections={proposalDetailSections}
      defaultTab="conteudo"
      sidebarHidden={editingContent}
    >
      <TabsContent value="conteudo" className="mt-0 space-y-4">
        <ProposalContentTab proposal={proposal} onEditingChange={setEditingContent} />
      </TabsContent>
      <TabsContent value="comercial" className="mt-0 space-y-4">
        <ProposalCommercialTab proposal={proposal} />
      </TabsContent>
      <TabsContent value="publicacao" className="mt-0 space-y-4">
        <ProposalPublicationTab proposal={proposal} />
      </TabsContent>
      <TabsContent value="versoes" className="mt-0 space-y-4">
        <ProposalVersionsTab proposal={proposal} />
      </TabsContent>
    </SubNavLayout>
  );
}
