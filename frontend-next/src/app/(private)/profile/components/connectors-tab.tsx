"use client";

import { useState, useSyncExternalStore, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Container } from "@/components/container";
import { CopyField } from "@/components/copy-field";
import { ErrorState } from "@/components/ui/error-state";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";
import {
  useMcpConnections,
  useRevokeMcpConnection,
} from "@/lib/actions/mcp/queries";
import type { McpConnection } from "@/lib/actions/mcp/types";
import { HelpButton, useTour } from "@/components/tour";

const subscribeToNothing = () => () => {};

/** Aba de conectores MCP: mostra a URL do endpoint e lista as conexões ativas para revogar. */
export function ConnectorsTab() {
  const { t } = useTranslation("profile");
  const { registerTour } = useTour();
  const { data: connections, error } = useMcpConnections();
  const revoke = useRevokeMcpConnection();

  // A URL sai do browser: é o domínio que o usuário está olhando e vai colar no cliente.
  const endpointUrl = useSyncExternalStore(
    subscribeToNothing,
    () => `${window.location.origin}/mcp`,
    () => "", // SSR: sem window; o valor real entra na hidratação, sem mismatch
  );

  const [revoking, setRevoking] = useState<McpConnection | null>(null);

  useEffect(() => {
    registerTour("profile-connectors", [
      {
        content: t("tour_connectors_intro"),
        selectorId: "connectors-url-section",
        position: "bottom",
      },
      {
        content: t("tour_connectors_url"),
        selectorId: "connectors-url-section",
        position: "bottom",
      },
      {
        content: t("tour_connectors_instructions"),
        selectorId: "connectors-howto-section",
        position: "top",
      },
      {
        content: t("tour_connectors_list"),
        selectorId: "connectors-list-section",
        position: "top",
      },
    ]);
  }, [registerTour, t]);

  if (error) return <ErrorState />;

  const handleRevoke = async () => {
    if (!revoking) return;
    try {
      await revoke.mutateAsync(revoking.id);
      toast.success(t("connectorRevokeSuccess"));
    } catch {
      // Alive já exibiu o toast de erro.
    } finally {
      setRevoking(null);
    }
  };

  return (
    <Container variant="form" border={false}>
      <div className="space-y-8">
        <section id="connectors-url-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("connectorsUrlTitle")}</h2>
            <HelpButton tourId="profile-connectors" startDirect />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("connectorsUrlDescription")}
          </p>
          <CopyField value={endpointUrl} label={t("connectorsUrlLabel")} />
        </section>

        <section id="connectors-howto-section" className="space-y-2">
          <h2 className="text-lg font-semibold">{t("connectorsHowToTitle")}</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("connectorsStepClaude")}</li>
            <li>{t("connectorsStepChatgpt")}</li>
            <li>{t("connectorsStepPaste")}</li>
            <li>{t("connectorsStepConsent")}</li>
          </ol>
        </section>

        <section id="connectors-list-section" className="space-y-3">
          <h2 className="text-lg font-semibold">{t("connectorsListTitle")}</h2>
          {connections?.length ? (
            <ul className="divide-y rounded-md border">
              {connections.map((connection) => (
                <li
                  key={connection.id}
                  className="flex items-start justify-between gap-4 p-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{connection.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {connection.lastUsedAt
                        ? t("connectorLastUsed", {
                            date: new Date(connection.lastUsedAt).toLocaleString(),
                          })
                        : t("connectorNeverUsed")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {connection.scopes.length ? (
                        connection.scopes.map((scope) => (
                          <Badge key={scope} variant="secondary">
                            {scope}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline">{t("connectorReadOnly")}</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setRevoking(connection)}
                    aria-label={t("revoke")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("connectorsEmpty")}
            </p>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(revoking)}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        onConfirm={handleRevoke}
        title={t("connectorRevokeTitle")}
        description={t("connectorRevokeDescription", {
          name: revoking?.clientName ?? "",
        })}
        confirmLabel={t("revoke")}
        confirmVariant="destructive"
      />
    </Container>
  );
}
