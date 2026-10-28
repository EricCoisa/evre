'use client';

import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Power, QrCode, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collector } from '@/lib/api/collector';
import {
  connectMessagingSession,
  disconnectMessagingSession,
  getMessagingSession,
} from '@/lib/actions/messaging/api';
import type { MessagingSession } from '@/lib/actions/messaging/types';
import { useMessagingRealtime } from '@/hooks/use-messaging-realtime';
import { useTranslation } from '@/hooks/use-translation';
import { useEffect } from 'react';

type MessagingSessionStatus = MessagingSession['status'];
type TranslateFn = ReturnType<typeof useTranslation>['t'];

const STATUS_KEY: Record<MessagingSessionStatus, string> = {
  CONNECTED: 'sessionConnected',
  CONNECTING: 'sessionConnecting',
  DISCONNECTED: 'sessionDisconnected',
  NOT_CREATED: 'sessionNotCreated',
};

/** Por que a sessão foi desfeita: o número pareado não é o da conexão (que é fixo). */
function sessionError(
  session: MessagingSession | undefined,
  t: TranslateFn,
): string | null {
  if (session?.error === 'PHONE_MISMATCH') {
    return t('sessionPhoneMismatch', {
      phone: session.expectedPhone ? ` (${session.expectedPhone})` : '',
    });
  }
  if (session?.error === 'PHONE_IN_USE') return t('sessionPhoneInUse');
  if (session?.error === 'PHONE_ARCHIVED') return t('sessionPhoneArchived');
  return null;
}

/** Pareamento de UMA conexão. O número é fixo desde o primeiro pareamento: reconectar exige o mesmo. */
function resolveSessionSubtitle(
  status: MessagingSessionStatus,
  phoneNumber: string | undefined,
  boundPhone: string | null | undefined,
  t: TranslateFn,
) {
  if (status === 'CONNECTED' && phoneNumber) {
    return t('sessionNumberConnected', { phone: phoneNumber });
  }
  if (boundPhone) {
    return t('sessionPairWithNumber', { phone: boundPhone });
  }
  return t('sessionPairFirstTime');
}

function SessionQrSection({
  status,
  qrCode,
  pairingCode,
  t,
}: {
  status: MessagingSessionStatus;
  qrCode?: string;
  pairingCode?: string;
  t: TranslateFn;
}) {
  if (status !== 'CONNECTING') return null;

  if (!qrCode) {
    return (
      <p role="status" className="py-2 text-sm text-muted-foreground">
        {t('sessionQrPending')}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <Image
        src={qrCode}
        alt={t('sessionQrAlt')}
        width={240}
        height={240}
        unoptimized
        className="rounded border bg-white p-2"
      />
      {pairingCode && (
        <p className="text-sm">
          {t('sessionPairingCode')}{' '}
          <span className="font-mono font-semibold">{pairingCode}</span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('sessionQrHint')}</p>
    </div>
  );
}

function SessionActionButtons({
  status,
  busy,
  connectPending,
  disconnectPending,
  onConnect,
  onDisconnect,
  t,
}: {
  status: MessagingSessionStatus;
  busy: boolean;
  connectPending: boolean;
  disconnectPending: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  t: TranslateFn;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'CONNECTED' && (
        <Button type="button" onClick={onConnect} disabled={busy}>
          {connectPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : status === 'CONNECTING' ? (
            <RefreshCw className="mr-2 size-4" />
          ) : (
            <QrCode className="mr-2 size-4" />
          )}
          {status === 'CONNECTING' ? t('sessionNewQr') : t('sessionConnect')}
        </Button>
      )}

      {(status === 'CONNECTED' || status === 'CONNECTING') && (
        <Button
          type="button"
          variant="outline"
          onClick={onDisconnect}
          disabled={busy}
        >
          {disconnectPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Power className="mr-2 size-4" />
          )}
          {t('sessionDisconnect')}
        </Button>
      )}
    </div>
  );
}

function SessionMutationErrors({
  connectError,
  disconnectError,
  t,
}: {
  connectError: Error | null;
  disconnectError: Error | null;
  t: TranslateFn;
}) {
  return (
    <>
      {connectError && (
        <p className="mt-2 text-sm text-destructive">
          {connectError.message || t('sessionConnectFailed')}
        </p>
      )}
      {disconnectError && (
        <p className="mt-2 text-sm text-destructive">
          {disconnectError.message || t('sessionDisconnectFailed')}
        </p>
      )}
    </>
  );
}

function useMessagingSessionActions(
  connectionId: string,
  t: TranslateFn,
) {
  const queryClient = useQueryClient();

  const connect = useMutation<MessagingSession, Error, void>({
    mutationFn: Collector(() => connectMessagingSession(connectionId)),
    onSuccess: (session) => {
      queryClient.setQueryData(['messaging', 'session', connectionId], session);
    },
  });

  const disconnect = useMutation({
    mutationFn: Collector(() => disconnectMessagingSession(connectionId)),
    onSuccess: async () => {
      toast.success(t('sessionDisconnectedSuccess', { defaultValue: 'WhatsApp desconectado.' }));
      queryClient.setQueryData(
        ['messaging', 'session', connectionId],
        (prev: MessagingSession | undefined) => ({
          ...prev,
          status: 'DISCONNECTED' as const,
          qrCode: undefined,
          pairingCode: undefined,
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ['messaging', 'session', connectionId] });
      await queryClient.invalidateQueries({ queryKey: ['messaging', 'health', connectionId] });
      await queryClient.invalidateQueries({ queryKey: ['messaging', 'connections'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || t('sessionDisconnectFailed'));
    },
  });

  return { connect, disconnect };
}

function SessionCardHeader({
  status,
  phoneNumber,
  boundPhone,
  t,
}: {
  status: MessagingSessionStatus;
  phoneNumber?: string | null;
  boundPhone?: string | null;
  t: TranslateFn;
}) {
  const isConnected = status === 'CONNECTED';
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div>
        <p className="font-medium">{t('sessionTitle')}</p>
        <p className="text-sm text-muted-foreground">
          {resolveSessionSubtitle(status, phoneNumber ?? undefined, boundPhone, t)}
        </p>
      </div>
      <Badge
        variant={isConnected ? 'default' : 'outline'}
        className={isConnected ? 'bg-green-600' : undefined}
      >
        {t(STATUS_KEY[status])}
      </Badge>
    </div>
  );
}

function MessagingSessionCardContent({
  data,
  phone,
  connect,
  disconnect,
  t,
}: {
  data: MessagingSession;
  phone?: string | null;
  connect: ReturnType<typeof useMessagingSessionActions>['connect'];
  disconnect: ReturnType<typeof useMessagingSessionActions>['disconnect'];
  t: TranslateFn;
}) {
  const status = data.status;
  const error = sessionError(data, t);
  const boundPhone = phone || data.expectedPhone;
  const busy = connect.isPending || disconnect.isPending;

  return (
    <div className="mt-6 rounded-lg border p-4">
      <SessionCardHeader
        status={status}
        phoneNumber={data.phoneNumber}
        boundPhone={boundPhone}
        t={t}
      />

      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <SessionQrSection status={status} qrCode={data.qrCode} pairingCode={data.pairingCode} t={t} />

      <SessionActionButtons
        status={status}
        busy={busy}
        connectPending={connect.isPending}
        disconnectPending={disconnect.isPending}
        onConnect={() => connect.mutate()}
        onDisconnect={() => disconnect.mutate()}
        t={t}
      />

      <SessionMutationErrors
        connectError={connect.error}
        disconnectError={disconnect.error}
        t={t}
      />
    </div>
  );
}

/** Pareamento de UMA conexão. O número é fixo desde o primeiro pareamento: reconectar exige o mesmo. */
export function MessagingSessionCard({
  connectionId,
  phone,
  onConnected,
}: {
  connectionId: string;
  phone?: string | null;
  onConnected?: () => void;
}) {
  const { t } = useTranslation('messaging');
  useMessagingRealtime();

  const { data, isLoading } = useQuery<MessagingSession>({
    queryKey: ['messaging', 'session', connectionId],
    queryFn: Collector(() => getMessagingSession(connectionId)),
  });

  const { connect, disconnect } = useMessagingSessionActions(connectionId, t);

  const isConnected = data?.status === 'CONNECTED';
  useEffect(() => {
    if (isConnected && onConnected) {
      onConnected();
    }
  }, [isConnected, onConnected]);

  if (isLoading || !data || data.supported === false) return null;

  return (
    <MessagingSessionCardContent
      data={data}
      phone={phone}
      connect={connect}
      disconnect={disconnect}
      t={t}
    />
  );
}
