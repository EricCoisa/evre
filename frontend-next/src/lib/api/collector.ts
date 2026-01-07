"use client";

import { useApp } from "@/contexts/appProvider";
import { toast } from "sonner";
import { APINEXT, ApiNextError } from "./apiNext";
import { logout } from "../actions/auth/auth-action";

//Emulates errors de retorno da api
// Novo tipo de resposta padronizada
type ApiResponse<T> = {
    success: boolean;
    data: T | null;
    message: string;
    status: number;
};

export function Collector<TArgs extends unknown[], T>(action: (...args: TArgs) => Promise<ApiResponse<T>>): (...args: TArgs) => Promise<T> {
    const { emulateError } = useApp();

    return async (...args: TArgs): Promise<T> => {
        if (emulateError) {
            const errorMessage = "Emulated error from Collector";
            toast.error(errorMessage);
            return Promise.reject(new Error(errorMessage));
        }
        return await Alive(action)(...args);
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

//Tenta refazer a action uma vez se der erro 401 (Unauthorized)
export function Alive<TArgs extends unknown[], T>(action: (...args: TArgs) => Promise<ApiResponse<T>>) {
    return async (...args: TArgs): Promise<T> => {
        let response: ApiResponse<T>;
        try {
            response = await action(...args);
        } catch (error) {
            // Falha inesperada (ex: erro de rede, exceção não tratada)
            console.error("Collector caught an error:", error);
            toast.error(String(error));
            throw error;
        }

        // Se não for sucesso, trata como erro
        if (!response.success) {
            // Se for erro 401 ou Unauthorized, tenta refresh e repete a action uma vez
            if (response.status === 401 || response.message === "Unauthorized") {
                try {
                    await APINEXT.POST("/auth/refresh");
                    response = await action(...args);
                } catch {
                    toast.error("Sessão expirada. Faça login novamente.");
                    logout()
                    throw new Error(response.message || "Sessão expirada");
                }
                if (!response.success) {
                    toast.error(response.message);
                    throw new Error(response.message);
                }
            } else {
                toast.error(response.message);
                throw new Error(response.message);
            }
        }
        return response.data as T;
    };
}