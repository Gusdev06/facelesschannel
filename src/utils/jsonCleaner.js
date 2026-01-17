/**
 * Limpa e valida a resposta JSON do OpenAI
 * @param {string} response - Resposta bruta da API
 * @returns {object} Objeto JSON parseado e validado
 */
export function cleanJsonResponse(response) {
  try {
    let jsonText = response;

    // Remove markdown code blocks
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Remove espaços em branco extras
    jsonText = jsonText.trim();

    // Tenta encontrar o JSON caso tenha texto antes ou depois
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    // Parse JSON
    const data = JSON.parse(jsonText);

    // Valida estrutura
    if (!data.total_images || !Array.isArray(data.image_prompts)) {
      throw new Error('Invalid JSON structure: missing total_images or image_prompts array');
    }

    if (data.total_images !== data.image_prompts.length) {
      console.warn(`Warning: total_images (${data.total_images}) doesn't match array length (${data.image_prompts.length})`);
      data.total_images = data.image_prompts.length;
    }

    // Valida cada prompt
    data.image_prompts.forEach((item, index) => {
      if (!item.prompt || typeof item.prompt !== 'string') {
        throw new Error(`Invalid prompt at index ${index}: missing or invalid 'prompt' field`);
      }

      if (!item.image || typeof item.image !== 'string') {
        throw new Error(`Invalid prompt at index ${index}: missing or invalid 'image' field`);
      }

      // Garante que tem os campos necessários
      if (!item.segment) {
        item.segment = `Segment ${index + 1}`;
      }

      if (typeof item.start_word !== 'number') {
        item.start_word = 0;
      }

      if (typeof item.end_word !== 'number') {
        item.end_word = 0;
      }
    });

    return data;

  } catch (error) {
    console.error('JSON parsing error:', error.message);
    console.error('Raw response:', response.substring(0, 500));
    throw new Error(`Failed to parse OpenAI response: ${error.message}`);
  }
}

/**
 * Limpa e valida a resposta JSON de thumbnails do OpenAI
 * @param {string} response - Resposta bruta da API
 * @returns {object} Objeto JSON parseado e validado
 */
export function cleanThumbnailResponse(response) {
  try {
    let jsonText = response;

    // Remove markdown code blocks
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Remove espaços em branco extras
    jsonText = jsonText.trim();

    // Tenta encontrar o JSON caso tenha texto antes ou depois
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    // Parse JSON
    const data = JSON.parse(jsonText);

    // Valida estrutura de thumbnail
    if (!data.thumbnail_prompt || typeof data.thumbnail_prompt !== 'string') {
      throw new Error('Invalid thumbnail structure: missing or invalid thumbnail_prompt field');
    }

    if (!data.text_hook || typeof data.text_hook !== 'string') {
      throw new Error('Invalid thumbnail structure: missing or invalid text_hook field');
    }

    if (!data.hook_position || !['top', 'bottom'].includes(data.hook_position)) {
      console.warn('Warning: hook_position missing or invalid, defaulting to "top"');
      data.hook_position = 'top';
    }

    // explanation é opcional mas útil
    if (!data.explanation) {
      data.explanation = 'Strategy explanation not provided';
    }

    // Valida tamanho do text_hook (15-35 caracteres recomendado)
    if (data.text_hook.length > 40) {
      console.warn(`Warning: text_hook is too long (${data.text_hook.length} chars). Recommended: 15-35 chars`);
    }

    return data;

  } catch (error) {
    console.error('Thumbnail JSON parsing error:', error.message);
    console.error('Raw response:', response.substring(0, 500));
    throw new Error(`Failed to parse thumbnail response: ${error.message}`);
  }
}

/**
 * Valida se os prompts atendem aos requisitos de qualidade
 * @param {object} promptsData - Dados de prompts parseados
 * @returns {object} Resultado da validação
 */
export function validatePrompts(promptsData) {
  const issues = [];

  promptsData.image_prompts.forEach((item, index) => {
    // Verifica tamanho mínimo do prompt (25 palavras)
    const wordCount = item.prompt.split(/\s+/).length;
    if (wordCount < 25) {
      issues.push(`Prompt ${index + 1} muito curto (${wordCount} palavras, mínimo 25)`);
    }

    // Verifica se contém termos obrigatórios
    const prompt = item.prompt.toLowerCase();
    const hasArtStyle = /oil painting|impressionist|expressionist|contemporary art|classical painting|baroque|romantic era|renaissance/i.test(item.prompt);
    const hasDarkColors = /deep blue|dark amber|burnt sienna|prussian blue|dark ochre|shadowy|muted earth|dark emerald|charcoal|midnight blue|burgundy/i.test(item.prompt);
    const hasFacelessRule = /no text|no words|faceless|back view|obscured face|shadowed silhouette/i.test(item.prompt);

    if (!hasArtStyle) {
      issues.push(`Prompt ${index + 1} não contém estilo artístico`);
    }

    if (!hasDarkColors) {
      issues.push(`Prompt ${index + 1} não contém paleta de cores escuras`);
    }

    if (!hasFacelessRule) {
      issues.push(`Prompt ${index + 1} não contém regras faceless/no text`);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
    totalPrompts: promptsData.image_prompts.length
  };
}
