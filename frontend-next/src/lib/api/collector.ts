"use client";

import { useApp } from "@/contexts/appProvider";
import { toast } from "sonner";
import { logout, refresh } from "../actions/auth/auth-action";

//Emulates errors de retorno da api
// Novo tipo de resposta padronizada
type ApiResponse<T> = {
    success: boolean;
    data: T | null;
    message: string;
    status: number;
};

export interface CollectorOptions {
    /** Status HTTP que o chamador trata sozinho na UI e não devem virar toast. */
    silentStatuses?: number[];
}

/** O status HTTP que causou a falha, quando conhecido. `undefined` em erro de rede. */
export function errorStatus(error: unknown): number | undefined {
    return typeof error === 'object' && error !== null && 'status' in error
        ? (error as { status?: number }).status
        : undefined;
}

/** Carimba o status no Error — sem isto quem chama só recebe a mensagem e perde o código. */
function withStatus(error: Error, status: number): Error {
    return Object.assign(error, { status });
}

export function Collector<TArgs extends unknown[], T>(action: (...args: TArgs) => Promise<ApiResponse<T>>, options?: CollectorOptions): (...args: TArgs) => Promise<T> {
    const { emulateError } = useApp();

    return async (...args: TArgs): Promise<T> => {
        if (emulateError) {
            const errorMessage = "Emulated error from Collector";
            toast.error(errorMessage);
            return Promise.reject(new Error(errorMessage));
        }
        return await Alive(action, options)(...args);
    };
}

//Emula erros em mutations não usando hooks
export function EmulateMutationError<T>(emulateError: boolean, errorMessage = 'Emulated error from mutation'): T {
    if (emulateError) {
        toast.error(errorMessage);
        throw new Error(errorMessage);
    }
    // Se não houver erro, apenas continue normalmente
    return undefined as unknown as T;
}

/** Extrai a mensagem de um erro capturado, qualquer que seja seu formato. */
function describeError(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message?: unknown }).message);
    }
    return String(error);
}

/** Mostra o toast (salvo silenciado) e lança o erro da resposta com o status carimbado. */
function throwForFailure<T>(response: ApiResponse<T>, isSilent: (status: number) => boolean): never {
    const message = response.message || 'Erro desconhecido';
    if (!isSilent(response.status)) toast.error(message);
    throw withStatus(new Error(message), response.status);
}

// refresh() é single-flight: N queries falhando juntas compartilham uma renovação só,
// em vez de disputarem rotações concorrentes.
async function retryAfterRefresh<TArgs extends unknown[], T>(
    action: (...args: TArgs) => Promise<ApiResponse<T>>,
    args: TArgs,
): Promise<ApiResponse<T>> {
    try {
        await refresh();
        return await action(...args);
    } catch {
        toast.error("Sessão expirada. Faça login novamente.");
        logout();
        throw new Error("Sessão expirada");
    }
}

//Tenta refazer a action uma vez se der erro 401 (Unauthorized)
export function Alive<TArgs extends unknown[], T>(action: (...args: TArgs) => Promise<ApiResponse<T>>, options?: CollectorOptions) {
    const isSilent = (status: number) => !!options?.silentStatuses?.includes(status);

    return async (...args: TArgs): Promise<T> => {
        // Adia a chamada da action para depois do passe de render atual.
        await Promise.resolve();

        let response: ApiResponse<T>;
        try {
            response = await action(...args);
        } catch (error) {
            // Falha inesperada (ex: erro de rede, exceção não tratada)
            console.error("Collector caught an error:", error);
            const msg = describeError(error);
            toast.error(msg || 'Erro desconhecido');
            throw error instanceof Error ? error : new Error(msg);
        }

        if (response.success) return response.data as T;

        // `message` já chega string: o backend serializa todo erro no mesmo envelope (AllExceptionsFilter).
        const isUnauthorized = response.status === 401 || response.message === "Unauthorized";
        if (!isUnauthorized) throwForFailure(response, isSilent);

        response = await retryAfterRefresh(action, args);
        if (!response.success) throwForFailure(response, isSilent);
        return response.data as T;
    };
}