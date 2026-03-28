export interface RetryOptions {
    retries?: number;
    retryDelayMs?: number;
    retryOnStatus?: number[];
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
    input: RequestInfo | URL,
    init?: RequestInit,
    options: RetryOptions = {}
): Promise<Response> {
    const retries = options.retries ?? 2;
    const retryDelayMs = options.retryDelayMs ?? 750;
    const retryOnStatus = options.retryOnStatus ?? [408, 429, 500, 502, 503, 504];

    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const response = await fetch(input, init);
            if (!retryOnStatus.includes(response.status) || attempt === retries) {
                return response;
            }
        } catch (error) {
            lastError = error;
            if (attempt === retries) {
                throw error;
            }
        }

        await delay(retryDelayMs * (attempt + 1));
    }

    throw lastError instanceof Error ? lastError : new Error("Request failed");
}
