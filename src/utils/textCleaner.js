/**
 * Limpa e normaliza o script de texto para processamento
 * @param {string} script - Script bruto
 * @returns {string} Script limpo
 */
export function cleanScript(script) {
  if (!script || typeof script !== 'string') {
    throw new Error('Script must be a non-empty string');
  }

  return script
    // Remove símbolos especiais problemáticos
    .replace(/[™®©@#$%&*[\]{}<>|\\\/`]/g, '')
    // Normaliza aspas
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Remove emojis (Unicode ranges)
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Símbolos e pictogramas
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transporte e mapas
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Símbolos alquímicos
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Símbolos geométricos
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Setas suplementares
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Símbolos suplementares
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Símbolos estendidos
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Símbolos e pictogramas estendidos
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Símbolos diversos
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    // Remove espaços múltiplos
    .replace(/\s+/g, ' ')
    // Limita quebras de linha a no máximo 2
    .replace(/\n{3,}/g, '\n\n')
    // Remove espaços no início e fim
    .trim();
}

/**
 * Valida se o script limpo tem tamanho adequado
 * @param {string} script - Script limpo
 * @returns {object} Informações de validação
 */
export function validateScript(script) {
  const wordCount = script.split(/\s+/).length;
  const charCount = script.length;

  let estimatedDuration = wordCount / 150; // ~150 palavras por minuto
  let category = 'short';

  if (wordCount > 750) {
    category = 'very_long';
  } else if (wordCount > 450) {
    category = 'long';
  } else if (wordCount > 150) {
    category = 'medium';
  }

  return {
    valid: wordCount >= 10,
    wordCount,
    charCount,
    estimatedDuration: Math.ceil(estimatedDuration),
    category,
    message: wordCount < 10 ? 'Script muito curto (mínimo 10 palavras)' : 'Script válido'
  };
}
