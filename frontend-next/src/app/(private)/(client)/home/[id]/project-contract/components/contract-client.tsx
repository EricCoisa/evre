'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { ContractDocument } from '@/lib/actions/contract-document/types';
import { ContractRenderer } from '@/app/contract-public/components';


interface ApproveActionProps {
  contract: ContractDocument;
}

export function ContractClient({ contract }: ApproveActionProps) {
  const { t } = useTranslation('projectContract');
  
  return (
    <div className="p-2 max-w-4xl mx-auto">
      <div className="space-y-3 md:space-y-6">
        {/* Content Card com Tabs */}
        <ContractRenderer content={contract.content} />

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('info_title')}</CardTitle>
            <CardDescription>{t('info_description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('contract_id')}</p>
                <p className="text-sm font-mono">{contract.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('contract_version')}</p>
                <p className="text-sm">{contract.contentSchemaVersion}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('contract_created_at')}</p>
                <p className="text-sm">
                  {new Date(contract.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('contract_updated_at')}</p>
                <p className="text-sm">
                  {new Date(contract.updatedAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
