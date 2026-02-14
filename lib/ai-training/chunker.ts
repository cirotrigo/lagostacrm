/**
 * AI Training / RAG - Text Chunker
 * Divide textos em chunks para processamento de embeddings
 */

import type { ChunkOptions } from './types';

const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;

/**
 * Estima o número de tokens em um texto.
 * Aproximação: 1 token ≈ 4 caracteres para português/inglês.
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Estima o número de caracteres para uma quantidade de tokens.
 */
function tokensToChars(tokens: number): number {
    return tokens * 4;
}

/**
 * Divide texto em parágrafos, preservando estrutura.
 */
function splitIntoParagraphs(text: string): string[] {
    // Normaliza quebras de linha
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Divide por parágrafos (2+ quebras de linha ou linhas vazias)
    const paragraphs = normalized
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    return paragraphs;
}

/**
 * Divide texto em chunks com overlap.
 *
 * Estratégia:
 * 1. Divide o texto em parágrafos
 * 2. Agrupa parágrafos até atingir maxTokens
 * 3. Mantém overlap entre chunks para contexto
 *
 * @param text - Texto a ser dividido
 * @param options - Opções de chunking
 * @returns Array de chunks
 */
export function chunkText(text: string, options?: ChunkOptions): string[] {
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const overlapTokens = options?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
    const maxChars = tokensToChars(maxTokens);
    const overlapChars = tokensToChars(overlapTokens);

    // Texto pequeno demais para chunking
    if (text.length <= maxChars) {
        return [text.trim()];
    }

    const paragraphs = splitIntoParagraphs(text);

    // Se não há parágrafos claros, divide por tamanho fixo
    if (paragraphs.length <= 1) {
        return chunkBySize(text, maxChars, overlapChars);
    }

    const chunks: string[] = [];
    let currentChunk = '';
    let previousOverlap = '';

    for (const paragraph of paragraphs) {
        const potentialChunk = currentChunk
            ? `${currentChunk}\n\n${paragraph}`
            : `${previousOverlap}${previousOverlap ? '\n\n' : ''}${paragraph}`;

        if (potentialChunk.length <= maxChars) {
            // Cabe no chunk atual
            currentChunk = potentialChunk;
        } else {
            // Chunk atual está cheio
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                // Guarda overlap para o próximo chunk
                previousOverlap = extractOverlap(currentChunk, overlapChars);
            }

            // Parágrafo muito grande - divide ele também
            if (paragraph.length > maxChars) {
                const subChunks = chunkBySize(paragraph, maxChars, overlapChars);
                for (let i = 0; i < subChunks.length; i++) {
                    if (i === 0 && previousOverlap) {
                        chunks.push(`${previousOverlap}\n\n${subChunks[i]}`.trim());
                    } else {
                        chunks.push(subChunks[i].trim());
                    }
                }
                previousOverlap = extractOverlap(subChunks[subChunks.length - 1], overlapChars);
                currentChunk = '';
            } else {
                currentChunk = `${previousOverlap}${previousOverlap ? '\n\n' : ''}${paragraph}`;
            }
        }
    }

    // Adiciona o último chunk se houver
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks.filter(c => c.length > 0);
}

/**
 * Divide texto por tamanho fixo com overlap.
 * Usado quando não há estrutura de parágrafos clara.
 */
function chunkBySize(text: string, maxChars: number, overlapChars: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        let end = start + maxChars;

        // Tenta terminar em um espaço ou quebra de linha
        if (end < text.length) {
            const lastSpace = text.lastIndexOf(' ', end);
            const lastNewline = text.lastIndexOf('\n', end);
            const breakPoint = Math.max(lastSpace, lastNewline);

            if (breakPoint > start + maxChars / 2) {
                end = breakPoint;
            }
        }

        const chunk = text.slice(start, end).trim();
        if (chunk) {
            chunks.push(chunk);
        }

        // Move o início considerando overlap
        start = end - overlapChars;

        // Evita loop infinito
        if (start <= 0 || end >= text.length) {
            if (end < text.length) {
                const remaining = text.slice(end).trim();
                if (remaining) {
                    chunks.push(remaining);
                }
            }
            break;
        }
    }

    return chunks;
}

/**
 * Extrai as últimas palavras/frases para overlap.
 */
function extractOverlap(text: string, overlapChars: number): string {
    if (text.length <= overlapChars) {
        return text;
    }

    const overlap = text.slice(-overlapChars);

    // Tenta começar em uma palavra completa
    const firstSpace = overlap.indexOf(' ');
    if (firstSpace > 0 && firstSpace < overlapChars / 2) {
        return overlap.slice(firstSpace + 1);
    }

    return overlap;
}

/**
 * Formata um par Q&A em texto para embedding.
 */
export function formatQAContent(question: string, answer: string): string {
    return `Pergunta: ${question.trim()}\nResposta: ${answer.trim()}`;
}
