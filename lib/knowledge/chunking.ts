/**
 * File parsing utilities for TXT and Markdown uploads
 */

/**
 * Parse Markdown content — strips formatting for better embeddings
 */
export function parseMarkdownContent(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, '[code block]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[image: $1]')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .trim();
}

/**
 * Determine file type and parse accordingly
 */
export function parseFileContent(filename: string, content: string): string {
  const ext = filename.toLowerCase().split('.').pop();

  switch (ext) {
    case 'md':
    case 'markdown':
      return parseMarkdownContent(content);
    case 'txt':
    case 'text':
      return content.trim();
    default:
      throw new Error(`Tipo de arquivo não suportado: ${ext}. Apenas TXT e MD são aceitos.`);
  }
}
