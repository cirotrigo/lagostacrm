/**
 * AI Training / RAG - PDF Text Extractor
 * Extrai texto de arquivos PDF usando pdf-parse v2.x
 */

import { PDFParse } from 'pdf-parse';

/**
 * Converte ArrayBuffer para Uint8Array de forma segura
 */
function toUint8Array(data: ArrayBuffer | Buffer | Uint8Array): Uint8Array {
    if (data instanceof Uint8Array) {
        return data;
    }
    // Para Buffer ou ArrayBuffer, usa conversão direta
    return new Uint8Array(data as ArrayBuffer);
}

/**
 * Extrai texto de um buffer de PDF.
 *
 * @param buffer - ArrayBuffer ou Buffer contendo o PDF
 * @returns Texto extraído do PDF
 * @throws Error se o PDF não puder ser processado ou não tiver texto
 */
export async function extractTextFromPdf(buffer: ArrayBuffer | Buffer): Promise<string> {
    const pdfData = toUint8Array(buffer);

    try {
        const parser = new PDFParse({ data: pdfData });
        const result = await parser.getText();

        // Concatena texto de todas as páginas
        const text = result.text.trim();

        if (!text || text.length < 10) {
            await parser.destroy();
            throw new Error(
                'Não foi possível extrair texto deste PDF. ' +
                'Verifique se não é uma imagem escaneada sem OCR.'
            );
        }

        // Normaliza espaços e quebras de linha
        const normalizedText = text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n')  // Máximo 2 quebras consecutivas
            .replace(/[ \t]+/g, ' ')      // Múltiplos espaços viram um
            .trim();

        await parser.destroy();
        return normalizedText;
    } catch (error) {
        if (error instanceof Error && error.message.includes('Não foi possível')) {
            throw error;
        }

        throw new Error(
            'Erro ao processar PDF: ' +
            (error instanceof Error ? error.message : 'formato inválido ou corrompido')
        );
    }
}

/**
 * Extrai metadados básicos de um PDF.
 */
export async function extractPdfMetadata(buffer: ArrayBuffer | Buffer): Promise<{
    pageCount: number;
    hasText: boolean;
}> {
    const pdfData = toUint8Array(buffer);

    try {
        const parser = new PDFParse({ data: pdfData });
        const textResult = await parser.getText();

        const pageCount = textResult.pages.length;
        const hasText = textResult.text.trim().length > 10;

        await parser.destroy();

        return {
            pageCount,
            hasText,
        };
    } catch {
        return {
            pageCount: 0,
            hasText: false,
        };
    }
}
