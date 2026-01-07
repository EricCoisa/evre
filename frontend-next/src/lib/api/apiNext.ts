// APINEXT: universal API handle using fetch, connecting to Next.js API routes

export const APINEXT = {
    async GET<T>(url: string, config?: RequestInit): Promise<T | null> {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const response = await fetch(`${siteUrl}/api${url}`, {
            method: 'GET',
            credentials: 'include',
            ...(config || {}),
        });
        if (!response.ok) {
            let errorData = null;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json') && response.status !== 204) {
                errorData = await response.json();
            }
            handleErrorNext(response, errorData, 'GET request failed');
        }
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json') && response.status !== 204) {
            return await response.json();
        }
        return null;
    },

    async POST<T>(url: string, data?: unknown, config?: RequestInit): Promise<T> {
        const response = await fetch(`/api${url}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(config?.headers || {}),
            },
            body: data ? JSON.stringify(data) : undefined,
            ...config,
        });
        if (!response.ok) {
            const errorData = await response.json();
            handleErrorNext(response, errorData, 'POST request failed');
        }
        return await response.json();
    },

    async PATCH<T>(url: string, data?: unknown, config?: RequestInit): Promise<T> {
        const response = await fetch(`/api${url}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(config?.headers || {}),
            },
            body: data ? JSON.stringify(data) : undefined,
            ...config,
        });
        if (!response.ok) {
            const errorData = await response.json();
            handleErrorNext(response, errorData, 'PATCH request failed');
        }
        return await response.json();
    },

    async PUT<T>(url: string, data?: unknown, config?: RequestInit): Promise<T> {
        const response = await fetch(`/api${url}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(config?.headers || {}),
            },
            body: data ? JSON.stringify(data) : undefined,
            ...config,
        });
        if (!response.ok) {
            const errorData = await response.json();
            handleErrorNext(response, errorData, 'PUT request failed');
        }
        return await response.json();
    },

    async DELETE<T>(url: string, config?: RequestInit): Promise<T> {
        const response = await fetch(`/api${url}`, {
            method: 'DELETE',
            credentials: 'include',
            ...(config || {}),
        });
        if (!response.ok) {
            const errorData = await response.json();
            handleErrorNext(response, errorData, 'DELETE request failed');
        }
        return await response.json();
    },
};


export class ApiNextError extends Error {
    statusCode: number;
    details?: Record<string, unknown>;
    constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
    }
}

function handleErrorNext(response: Response, errorData: Record<string, unknown>, fallback: string): never {
    let message: string = fallback;
    const statusCode = response.status;
    if (errorData) {
        if (typeof errorData.message === 'string') {
            message = errorData.message;
        } else if (Array.isArray(errorData.message)) {
            message = errorData.message.join(', ');
        } else if (
            errorData.message &&
            typeof errorData.message === 'object' &&
            'message' in errorData.message &&
            typeof (errorData.message as { message?: unknown }).message === 'string'
        ) {
            message = (errorData.message as { message?: string }).message || fallback;
        } else if (
            typeof errorData.error === 'string'
        ) {
            message = errorData.error;
        }
    }
    throw new ApiNextError(statusCode, message, errorData);
}