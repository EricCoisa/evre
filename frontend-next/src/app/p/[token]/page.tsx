import { ItemNotFound } from '@/components/ui/item-not-found';
import { getPublicProposal } from '@/lib/actions/proposal-public/api';
import {
  getAppNameConfiguration,
  getAppTaglineConfiguration,
} from '@/lib/actions/systemConfiguration/api';
import { PublicProposalHeader } from './components/public-proposal-header';
import { ProposalUnavailable } from './components/proposal-unavailable';
import { PublicProposalView } from './components/public-proposal-view';

function renewalReason(errors: unknown): 'REVOKED' | 'EXPIRED' | null {
  const reason = (errors as { reason?: string } | undefined)?.reason;
  return reason === 'REVOKED' || reason === 'EXPIRED' ? reason : null;
}

/** Server Component — busca no servidor e renderiza, sem sessão nem `serverMe()`: é a única
 * tela deste produto aberta por quem não tem conta. `LayoutBody` (dentro de `PublicProposalView`)
 * não depende de hook autenticado — ver `f0-02-layout-profile.md`. O nome/descritor da marca vêm
 * das rotas anônimas `system-configuration/app-name` e `/app-tagline` e aparecem em qualquer
 * estado — feliz ou indisponível — para quem abre um link revogado saber de quem era a proposta. */
export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [response, appName, appTagline] = await Promise.all([
    getPublicProposal(token),
    getAppNameConfiguration(),
    getAppTaglineConfiguration(),
  ]);
  const header = <PublicProposalHeader name={appName.data?.value ?? ''} tagline={appTagline.data?.value ?? ''} />;

  if (!response.success || !response.data) {
    const reason = renewalReason(response.errors);
    if (reason) {
      return (
        <>
          {header}
          <ProposalUnavailable token={token} reason={reason} />
        </>
      );
    }
    // Token inexistente: página genérica, sem distinguir de revogada (sem enumeração de token).
    return (
      <>
        {header}
        <ItemNotFound itemName="proposta" returnPage="/" returnLabel="Início" />
      </>
    );
  }

  return (
    <>
      {header}
      <PublicProposalView token={token} proposal={response.data} />
    </>
  );
}
