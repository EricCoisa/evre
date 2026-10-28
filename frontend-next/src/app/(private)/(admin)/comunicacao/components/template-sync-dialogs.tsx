'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { MessagingConnection, MessagingTemplateCatalogItem } from '@/lib/actions/messaging/types';
import { connectionDisplayName } from '@/lib/messaging/connection';

/** Submissões em conexões ainda ativas: numa arquivada (provedor trocado) não há mais o que sincronizar ou remover lá. */
function activeSubmissions(
  template: MessagingTemplateCatalogItem | null,
  connections: MessagingConnection[],
) {
  return (template?.submissions ?? []).filter((s) => connections.some((c) => c.id === s.connectionId));
}

export function hasActiveSubmission(
  template: MessagingTemplateCatalogItem | null,
  connections: MessagingConnection[],
): boolean {
  return activeSubmissions(template, connections).length > 0;
}

function submittedConnections(
  template: MessagingTemplateCatalogItem | null,
  connections: MessagingConnection[],
): string {
  return activeSubmissions(template, connections)
    .map((s) => connections.find((c) => c.id === s.connectionId))
    .map((c) => (c ? connectionDisplayName(c) : null))
    .filter(Boolean)
    .join(', ');
}

/** Avisa que a edição local não atualiza a Meta e pergunta se o operador quer reenviar agora. */
export function TemplateSyncPrompt({
  template,
  onSync,
  onClose,
}: {
  template: MessagingTemplateCatalogItem | null;
  onSync: (template: MessagingTemplateCatalogItem) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('messaging');
  return (
    <AlertDialog open={!!template} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('syncPromptTitle')}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="grid gap-2">
              <p>{t('syncPromptBody')}</p>
              <p>{t('syncPromptWarn')}</p>
              <p>{t('syncPromptLater')}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('syncLater')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (template) onSync(template);
            }}
          >
            {t('syncNow')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Avisa que remover um template submetido também afeta a Meta e deixa o operador escolher. */
export function TemplateDeleteDialog({
  template,
  connections,
  pending,
  onConfirm,
  onClose,
}: {
  template: MessagingTemplateCatalogItem | null;
  connections: MessagingConnection[];
  pending: boolean;
  onConfirm: (template: MessagingTemplateCatalogItem, remote: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('messaging');
  const [remote, setRemote] = useState(true);
  // Só pergunta pelo provedor se o template está submetido numa conexão ativa; senão é só apagar.
  const submitted = hasActiveSubmission(template, connections);

  return (
    <AlertDialog open={!!template} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteTemplateTitle')}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="grid gap-3">
              {submitted ? (
                <>
                  <p>{t('deleteSubmittedBody', { connections: submittedConnections(template, connections) })}</p>
                  <div className="flex items-start gap-2 rounded-md border p-3">
                    <Checkbox
                      id="delete-remote"
                      checked={remote}
                      onCheckedChange={(checked) => setRemote(checked === true)}
                    />
                    <div className="grid gap-1">
                      <Label htmlFor="delete-remote">{t('deleteRemoteLabel')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {remote ? t('deleteRemoteHelp') : t('deleteLocalOnlyHelp')}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p>{t('deleteTemplateDescription')}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              // Não fecha sozinho: fica aberto enquanto a Meta responde (e se recusar, o erro aparece).
              event.preventDefault();
              if (template) onConfirm(template, submitted && remote);
            }}
          >
            {t('deleteConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
