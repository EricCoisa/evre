"use server";

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { ApiError } from "next/dist/server/api-utils";
import { ApiErrorResponse } from "../actions/auth/types";
import { getServerAccessToken, getServerLang } from "../actions/auth/server-auth";
import { clientIpHeader } from "./client-ip";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

const api: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
});


api.interceptors.request.use(async (config) => {
    const token = await getServerAccessToken();
    config.headers = config.headers || {};
    if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
    }
    // Detecta idioma do lado do client ou do cookie (SSR)
    let lang = 'pt-BR';
    lang = await getServerLang() || lang;

    config.headers["Accept-Language"] = lang;
    Object.assign(config.headers, await clientIpHeader());
    return config;
});


/** Normaliza qualquer falha de axios num `ApiError` com status e mensagem. */
function handleError(error: unknown): ApiError {
    if (error instanceof AxiosError && error.response) {
        const errorData = error.response.data as ApiErrorResponse | undefined;
        return new ApiError(
            errorData?.statusCode || error.response.status,
            errorData?.message || "Erro desconhecido"
        );
    }

    if (error instanceof AxiosError && error.request) {
        return new ApiError(0, "Erro de conexão com o servidor");
    }

    if (error instanceof Error) {
        return new ApiError(500, error.message);
    }

    return new ApiError(500, "Erro desconhecido");
}


export type ApiResponse<T> = {
    success: boolean;
    data: T;
    message: string;
    status: number;
    /** Detalhe estruturado opcional (ex. validação, ou `{purpose,channel,target}` de 428 de verificação). */
    errors?: unknown;
};

function buildResponse<T>(data: T, message: string, status: number, success: boolean): ApiResponse<T> {
    return { success, data, message, status };
}

export async function GET<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
        const response = await api.get<T>(url, config);
        return buildResponse(response.data, "", response.status, true);
    } catch (error) {
        const err = handleError(error);
        return buildResponse<T>(null as T, err.message, err.statusCode || 500, false);
    }
}

export async function POST<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
        const response = await api.post<T>(url, data, config);
        return buildResponse(response.data, "", response.status, true);
    } catch (error) {
        const err = handleError(error);
        return buildResponse<T>(null as T, err.message, err.statusCode || 500, false);
    }
}
