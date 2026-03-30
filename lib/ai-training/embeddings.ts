/**
 * AI Training / RAG - OpenAI Embeddings
 * Gera embeddings vetoriais usando a API da OpenAI
 */

import type { EmbeddingResult } from './types';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_BATCH_SIZE = 2048; // Limite da API OpenAI
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 segundo

interface OpenAIEmbeddingResponse {
    data: Array<{
        embedding: number[];
        index: number;
    }>;
    usage: {
        prompt_tokens: number;
        total_tokens: number;
    };
}

interface OpenAIError {
    error: {
        message: string;
        type: string;
        code: string;
    };
}

/**
 * Gera embeddings para um array de textos.
 *
 * @param texts - Array de textos para gerar embeddings
 * @param apiKey - Chave da API OpenAI
 * @returns Array de resultados com embedding e contagem de tokens
 * @throws Error se a API falhar após retries
 */
export async function generateEmbeddings(
    texts: string[],
    apiKey: string
): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
        return [];
    }

    // Divide em batches se necessário
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
        batches.push(texts.slice(i, i + MAX_BATCH_SIZE));
    }

    const allResults: EmbeddingResult[] = [];

    for (const batch of batches) {
        const batchResults = await generateEmbeddingsBatch(batch, apiKey);
        allResults.push(...batchResults);
    }

    return allResults;
}

/**
 * Gera embeddings para um único batch de textos.
 */
async function generateEmbeddingsBatch(
    texts: string[],
    apiKey: string
): Promise<EmbeddingResult[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(OPENAI_EMBEDDINGS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: EMBEDDING_MODEL,
                    input: texts,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json() as OpenAIError;
                const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

                // Rate limit - espera e tenta novamente
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const delay = retryAfter
                        ? parseInt(retryAfter, 10) * 1000
                        : INITIAL_RETRY_DELAY * Math.pow(2, attempt);

                    await sleep(delay);
                    continue;
                }

                throw new Error(`OpenAI API error: ${errorMessage}`);
            }

            const data = await response.json() as OpenAIEmbeddingResponse;

            // Ordena por index para garantir ordem correta
            const sortedData = [...data.data].sort((a, b) => a.index - b.index);

            // Distribui tokens proporcionalmente entre os textos
            const tokensPerText = Math.ceil(data.usage.total_tokens / texts.length);

            return sortedData.map((item, index) => ({
                embedding: item.embedding,
                tokenCount: index === texts.length - 1
                    ? data.usage.total_tokens - (tokensPerText * (texts.length - 1))
                    : tokensPerText,
            }));

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Se não é rate limit, espera com backoff exponencial
            if (attempt < MAX_RETRIES - 1) {
                await sleep(INITIAL_RETRY_DELAY * Math.pow(2, attempt));
            }
        }
    }

    throw lastError || new Error('Failed to generate embeddings after retries');
}

/**
 * Gera embedding para um único texto.
 * Conveniência para quando só há um texto.
 */
export async function generateEmbedding(
    text: string,
    apiKey: string
): Promise<EmbeddingResult> {
    const results = await generateEmbeddings([text], apiKey);
    return results[0];
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
