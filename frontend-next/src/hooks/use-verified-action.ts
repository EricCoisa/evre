'use client';

import { useCallback, useRef, useState } from 'react';
import type { ApiResponse } from '@/lib/api/api';
import type { VerificationChallenge } from '@/lib/actions/verification/types';

function extractChallenge(res: ApiResponse<unknown>): VerificationChallenge | null {
  if (res.status !== 428) return null;
  const e = res.errors as Partial<VerificationChallenge> | undefined;
  if (!e?.purpose || !e?.channel || !e?.target) return null;
  return { purpose: e.purpose, channel: e.channel, target: e.target };
}

/** Envolve uma server action, reexecutando-a com o mesmo call após uma verificação (428) ser confirmada. */
export function useVerifiedAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ApiResponse<T>>,
) {
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  const pending = useRef<{ args: Args; resolve: (res: ApiResponse<T>) => void } | null>(null);

  const run = useCallback(
    (...args: Args): Promise<ApiResponse<T>> =>
      action(...args).then((res) => {
        const next = extractChallenge(res);
        if (!next) return res;
        return new Promise<ApiResponse<T>>((resolve) => {
          pending.current = { args, resolve };
          setChallenge(next);
        });
      }),
    [action],
  );

  const onConfirmed = useCallback(async () => {
    const task = pending.current;
    pending.current = null;
    setChallenge(null);
    if (task) task.resolve(await action(...task.args));
  }, [action]);

  const onCancelled = useCallback(() => {
    const task = pending.current;
    pending.current = null;
    setChallenge(null);
    task?.resolve({ success: false, data: null as never, message: 'cancelled', status: 0 });
  }, []);

  return { run, challenge, onConfirmed, onCancelled };
}
