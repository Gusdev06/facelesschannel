import fs from 'fs/promises';

/**
 * Formata tempo em formato SRT (HH:MM:SS,mmm)
 * @param {number} seconds - Tempo em segundos
 * @returns {string} Tempo formatado
 */
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis, 3)}`;
}

/**
 * Preenche número com zeros à esquerda
 * @param {number} num - Número
 * @param {number} size - Tamanho total
 * @returns {string} Número formatado
 */
function pad(num, size = 2) {
  return String(num).padStart(size, '0');
}

/**
 * Formata tempo em formato ASS (H:MM:SS.cc)
 * @param {number} seconds - Tempo em segundos
 * @returns {string} Tempo formatado
 */
function formatASSTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centisecs = Math.floor((seconds % 1) * 100);

  return `${hours}:${pad(minutes)}:${pad(secs)}.${pad(centisecs)}`;
}

/**
 * Calcula durações proporcionais para cada palavra baseado no tamanho
 * @param {Array<string>} words - Array de palavras
 * @param {number} totalDuration - Duração total disponível em segundos
 * @returns {Array<number>} Array com duração para cada palavra
 */
function calculateProportionalWordDurations(words, totalDuration) {
  // Calcula o peso de cada palavra (baseado no número de caracteres + fator de complexidade)
  const weights = words.map(word => {
    const baseWeight = word.length;
    // Adiciona peso extra para palavras mais longas (mais sílabas)
    const complexityBonus = word.length > 8 ? word.length * 0.2 : 0;
    return baseWeight + complexityBonus;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Calcula duração proporcional inicial
  const rawDurations = weights.map(weight => (weight / totalWeight) * totalDuration);

  // Normalização: ajusta para garantir que a soma seja exatamente totalDuration
  const sumRaw = rawDurations.reduce((sum, d) => sum + d, 0);
  const normalizationFactor = totalDuration / sumRaw;
  const normalizedDurations = rawDurations.map(d => d * normalizationFactor);

  // Verificação final: arredonda e ajusta o último valor se necessário
  const roundedDurations = normalizedDurations.map(d => Math.round(d * 1000) / 1000);
  const finalSum = roundedDurations.reduce((sum, d) => sum + d, 0);
  const diff = totalDuration - finalSum;

  if (Math.abs(diff) > 0.001 && roundedDurations.length > 0) {
    // Ajusta o último valor para compensar erro de arredondamento
    roundedDurations[roundedDurations.length - 1] += diff;
  }

  return roundedDurations;
}

/**
 * Gera arquivo ASS simples (sem karaoke) usando timestamps REAIS do Whisper
 * @param {Array} wordsWithTimestamps - Array de palavras com timestamps precisos
 * @param {string} outputPath - Caminho do arquivo ASS de saída
 * @param {object} options - Opções de configuração
 * @returns {Promise<string>} Caminho do arquivo gerado
 */
export async function generateSimpleASSWithTimestamps(wordsWithTimestamps, outputPath, options = {}) {
  const {
    maxWordsPerLine = 8, // Máximo de palavras por linha
    fontSize = 52,
    fontName = 'Arial Bold',
    primaryColor = '&H00FFFFFF', // Branco
    outlineColor = '&H00000000', // Preto (contorno)
    outline = 3,
    alignment = 5, // 5 = centro da tela
    marginV = 40
  } = options;

  // Cabeçalho ASS
  let assContent = `[Script Info]
Title: Simple Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${primaryColor},${outlineColor},&H00000000,-1,0,0,0,100,100,0,0,1,${outline},0,${alignment},10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  if (wordsWithTimestamps.length === 0) {
    console.warn('⚠️  No words with timestamps provided');
    await fs.writeFile(outputPath, assContent, 'utf-8');
    return outputPath;
  }

  // Agrupa palavras em linhas respeitando maxWordsPerLine
  for (let i = 0; i < wordsWithTimestamps.length; i += maxWordsPerLine) {
    const lineWords = wordsWithTimestamps.slice(i, Math.min(i + maxWordsPerLine, wordsWithTimestamps.length));

    const lineStartTime = lineWords[0].start;
    const lineEndTime = lineWords[lineWords.length - 1].end;

    // Cria texto simples sem efeito karaoke
    const simpleText = lineWords.map(w => w.word).join(' ');

    // Adiciona diálogo
    assContent += `Dialogue: 0,${formatASSTime(lineStartTime)},${formatASSTime(lineEndTime)},Default,,0,0,0,,${simpleText}\n`;
  }

  await fs.writeFile(outputPath, assContent, 'utf-8');
  console.log(`✅ ASS subtitle file generated: ${outputPath}`);
  console.log(`   Simple subtitles: centered on screen`);
  console.log(`   Timing: REAL timestamps from Whisper (100% accurate sync)`);

  return outputPath;
}

/**
 * Gera arquivo ASS com efeito karaoke usando timestamps REAIS do Whisper
 * @param {Array} wordsWithTimestamps - Array de palavras com timestamps precisos
 * @param {string} outputPath - Caminho do arquivo ASS de saída
 * @param {object} options - Opções de configuração
 * @returns {Promise<string>} Caminho do arquivo gerado
 */
export async function generateKaraokeASSWithTimestamps(wordsWithTimestamps, outputPath, options = {}) {
  const {
    maxWordsPerLine = 8, // Máximo de palavras por linha
    fontSize = 52,
    fontName = 'Arial Bold',
    primaryColor = '&H00FFFFFF', // Branco (texto não cantado)
    karaokeColor = '&H0000FFFF', // Amarelo (texto sendo cantado)
    outlineColor = '&H00000000', // Preto (contorno)
    outline = 3,
    marginV = 80
  } = options;

  // Cabeçalho ASS
  let assContent = `[Script Info]
Title: Karaoke Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${karaokeColor},${outlineColor},&H00000000,-1,0,0,0,100,100,0,0,1,${outline},0,2,10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  if (wordsWithTimestamps.length === 0) {
    console.warn('⚠️  No words with timestamps provided');
    await fs.writeFile(outputPath, assContent, 'utf-8');
    return outputPath;
  }

  // Agrupa palavras em linhas respeitando maxWordsPerLine
  for (let i = 0; i < wordsWithTimestamps.length; i += maxWordsPerLine) {
    const lineWords = wordsWithTimestamps.slice(i, Math.min(i + maxWordsPerLine, wordsWithTimestamps.length));

    const lineStartTime = lineWords[0].start;
    const lineEndTime = lineWords[lineWords.length - 1].end;

    // Cria texto com tags de karaoke usando timestamps REAIS
    let karaokeText = '';
    let previousEndTime = lineStartTime;

    for (const wordData of lineWords) {
      const wordStart = wordData.start;
      const wordEnd = wordData.end;

      // Tempo que a palavra leva para ser falada (em segundos)
      const wordDuration = wordEnd - wordStart;

      // Duração em centésimos de segundo (ASS usa centisegundos para \k)
      const kDuration = Math.max(1, Math.round(wordDuration * 100));

      karaokeText += `{\\k${kDuration}}${wordData.word} `;
      previousEndTime = wordEnd;
    }

    // Remove espaço extra no final
    karaokeText = karaokeText.trim();

    // Adiciona diálogo
    assContent += `Dialogue: 0,${formatASSTime(lineStartTime)},${formatASSTime(lineEndTime)},Default,,0,0,0,,${karaokeText}\n`;
  }

  await fs.writeFile(outputPath, assContent, 'utf-8');
  console.log(`✅ ASS karaoke file generated: ${outputPath}`);
  console.log(`   Karaoke effect: words highlight in yellow as spoken`);
  console.log(`   Timing: REAL timestamps from Whisper (100% accurate sync)`);

  return outputPath;
}

/**
 * Gera arquivo ASS com efeito karaoke (VERSÃO ANTIGA - usa estimativas)
 * @param {Array} audioChunks - Array de chunks com texto e duração
 * @param {string} outputPath - Caminho do arquivo ASS de saída
 * @param {object} options - Opções de configuração
 * @returns {Promise<string>} Caminho do arquivo gerado
 */
export async function generateKaraokeASS(audioChunks, outputPath, options = {}) {
  const {
    maxWordsPerLine = 8, // Máximo de palavras por linha
    fontSize = 52,
    fontName = 'Arial Bold',
    primaryColor = '&H00FFFFFF', // Branco (texto não cantado)
    karaokeColor = '&H0000FFFF', // Amarelo (texto sendo cantado)
    outlineColor = '&H00000000', // Preto (contorno)
    outline = 3,
    marginV = 80
  } = options;

  // Cabeçalho ASS
  let assContent = `[Script Info]
Title: Karaoke Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${karaokeColor},${outlineColor},&H00000000,-1,0,0,0,100,100,0,0,1,${outline},0,2,10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let cumulativeTime = 0;

  for (const chunk of audioChunks) {
    const words = chunk.text.split(/\s+/).filter(w => w.length > 0);

    // Calcula durações proporcionais para cada palavra
    const wordDurations = calculateProportionalWordDurations(words, chunk.duration);

    // Agrupa palavras em linhas
    for (let i = 0; i < words.length; i += maxWordsPerLine) {
      const lineWords = words.slice(i, Math.min(i + maxWordsPerLine, words.length));
      const lineWordDurations = wordDurations.slice(i, Math.min(i + maxWordsPerLine, words.length));
      const lineStartTime = cumulativeTime;

      // Calcula tempo total da linha somando as durações individuais
      const lineDuration = lineWordDurations.reduce((sum, d) => sum + d, 0);
      const lineEndTime = lineStartTime + lineDuration;

      // Cria texto com tags de karaoke
      let karaokeText = '';
      for (let j = 0; j < lineWords.length; j++) {
        const word = lineWords[j];
        const wordDuration = lineWordDurations[j];
        // Duração em centésimos de segundo (ASS usa centisegundos para \k)
        const kDuration = Math.round(wordDuration * 100);
        karaokeText += `{\\k${kDuration}}${word} `;
      }

      // Remove espaço extra no final
      karaokeText = karaokeText.trim();

      // Adiciona diálogo
      assContent += `Dialogue: 0,${formatASSTime(lineStartTime)},${formatASSTime(lineEndTime)},Default,,0,0,0,,${karaokeText}\n`;

      cumulativeTime = lineEndTime;
    }
  }

  await fs.writeFile(outputPath, assContent, 'utf-8');
  console.log(`✅ ASS karaoke file generated: ${outputPath}`);
  console.log(`   Karaoke effect: words highlight in yellow as spoken`);
  console.log(`   Timing: proportional to word length for better sync`);

  return outputPath;
}

/**
 * Gera arquivo SRT/ASS com timestamps REAIS do Whisper
 * @param {Array} wordsWithTimestamps - Array de palavras com timestamps precisos
 * @param {string} outputPath - Caminho do arquivo de saída
 * @param {object} options - Opções de configuração
 * @returns {Promise<string>} Caminho do arquivo gerado
 */
export async function generateSubtitlesWithTimestamps(wordsWithTimestamps, outputPath, options = {}) {
  const {
    karaoke = false, // Modo simples por padrão (sem karaoke)
    ...otherOptions
  } = options;

  // Se karaoke estiver habilitado, gera ASS com efeito karaoke
  if (karaoke) {
    const assPath = outputPath.replace('.srt', '.ass');
    return generateKaraokeASSWithTimestamps(wordsWithTimestamps, assPath, otherOptions);
  }

  // Caso contrário, gera ASS simples (centralizado, sem karaoke)
  const assPath = outputPath.replace('.srt', '.ass');
  return generateSimpleASSWithTimestamps(wordsWithTimestamps, assPath, otherOptions);
}

/**
 * Gera arquivo SRT com timestamps REAIS
 * @param {Array} wordsWithTimestamps - Array de palavras com timestamps precisos
 * @param {string} outputPath - Caminho do arquivo SRT de saída
 * @param {object} options - Opções de configuração
 * @returns {Promise<string>} Caminho do arquivo gerado
 */
export async function generateSRTWithTimestamps(wordsWithTimestamps, outputPath, options = {}) {
  const {
    wordsPerSubtitle = 1, // 1 palavra por vez = estilo karaokê
    maxCharsPerLine = 42
  } = options;

  let srtContent = '';
  let subtitleIndex = 1;

  // Agrupa palavras em subtítulos
  for (let i = 0; i < wordsWithTimestamps.length; i += wordsPerSubtitle) {
    const subtitleWords = wordsWithTimestamps.slice(i, Math.min(i + wordsPerSubtitle, wordsWithTimestamps.length));

    const startTime = subtitleWords[0].start;
    const endTime = subtitleWords[subtitleWords.length - 1].end;

    let subtitleText = subtitleWords.map(w => w.word).join(' ');

    // Quebra linha se exceder limite de caracteres
    if (subtitleText.length > maxCharsPerLine && subtitleWords.length > 1) {
      const midPoint = Math.floor(subtitleWords.length / 2);
      const line1 = subtitleWords.slice(0, midPoint).map(w => w.word).join(' ');
      const line2 = subtitleWords.slice(midPoint).map(w => w.word).join(' ');
      subtitleText = `${line1}\n${line2}`;
    }

    srtContent += `${subtitleIndex}\n`;
    srtContent += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
    srtContent += `${subtitleText}\n\n`;

    subtitleIndex++;
  }

  await fs.writeFile(outputPath, srtContent, 'utf-8');
  console.log(`✅ SRT file generated: ${outputPath}`);
  console.log(`   Total subtitles: ${subtitleIndex - 1}`);
  console.log(`   Timing: REAL timestamps from Whisper (100% accurate sync)`);

  return outputPath;
}

/**
 * Gera arquivo SRT a partir de chunks de áudio (VERSÃO ANTIGA - usa estimativas)
 * @param {Array} audioChunks - Array de chunks com texto e duração
 * @param {string} outputPath - Caminho do arquivo SRT de saída
 * @param {object} options - Opções de configuração
 * @returns {Promise<string>} Caminho do arquivo gerado
 */
export async function generateSRT(audioChunks, outputPath, options = {}) {
  const {
    wordsPerSubtitle = 1, // 1 palavra por vez = estilo karaokê
    maxCharsPerLine = 42,
    karaoke = true // Modo karaokê por padrão
  } = options;

  // Se karaoke estiver habilitado, gera ASS ao invés de SRT
  if (karaoke) {
    const assPath = outputPath.replace('.srt', '.ass');
    return generateKaraokeASS(audioChunks, assPath, options);
  }

  let srtContent = '';
  let subtitleIndex = 1;
  let cumulativeTime = 0;

  for (const chunk of audioChunks) {
    const words = chunk.text.split(/\s+/).filter(w => w.length > 0);

    // Calcula durações proporcionais para cada palavra
    const wordDurations = calculateProportionalWordDurations(words, chunk.duration);

    // Modo tradicional: agrupa palavras em subtítulos
    for (let i = 0; i < words.length; i += wordsPerSubtitle) {
      const subtitleWords = words.slice(i, i + wordsPerSubtitle);
      const subtitleWordDurations = wordDurations.slice(i, i + wordsPerSubtitle);
      let subtitleText = subtitleWords.join(' ');

      // Quebra linha se exceder limite de caracteres
      if (subtitleText.length > maxCharsPerLine) {
        const midPoint = Math.floor(subtitleWords.length / 2);
        const line1 = subtitleWords.slice(0, midPoint).join(' ');
        const line2 = subtitleWords.slice(midPoint).join(' ');
        subtitleText = `${line1}\n${line2}`;
      }

      const startTime = cumulativeTime;
      const subtitleDuration = subtitleWordDurations.reduce((sum, d) => sum + d, 0);
      const endTime = cumulativeTime + subtitleDuration;

      srtContent += `${subtitleIndex}\n`;
      srtContent += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
      srtContent += `${subtitleText}\n\n`;

      cumulativeTime = endTime;
      subtitleIndex++;
    }
  }

  await fs.writeFile(outputPath, srtContent, 'utf-8');
  console.log(`✅ SRT file generated: ${outputPath}`);
  console.log(`   Total subtitles: ${subtitleIndex - 1}`);

  return outputPath;
}

/**
 * Estilo de legendas para FFmpeg - Estilo Karaokê
 * BorderStyle: 1 = outline sem fundo (transparente)
 * BorderStyle: 3 = fundo opaco (antigo)
 */
export const SUBTITLE_STYLE = {
  fontName: 'Arial Bold',
  fontSize: 32,
  primaryColor: '&H00FFFFFF', // Branco puro
  outlineColor: '&H00000000', // Preto (outline)
  backColor: '&H00000000', // Fundo preto (não usado com BorderStyle=1)
  borderStyle: 1, // 1 = outline sem fundo, apenas borda
  outline: 3, // Espessura do outline (maior para melhor contraste)
  shadow: 0, // Sem sombra (karaokê clean)
  alignment: 2, // Centro inferior
  marginV: 80, // Margem vertical maior
  bold: -1, // Negrito ativado
  spacing: 0 // Espaçamento entre letras
};

/**
 * Gera string de estilo para FFmpeg subtitle filter
 * @param {object} customStyle - Estilo customizado (opcional)
 * @returns {string} String de estilo formatada
 */
export function getSubtitleStyleString(customStyle = {}) {
  const style = { ...SUBTITLE_STYLE, ...customStyle };

  return `FontName=${style.fontName},FontSize=${style.fontSize},` +
    `PrimaryColour=${style.primaryColor},OutlineColour=${style.outlineColor},` +
    `BackColour=${style.backColor},BorderStyle=${style.borderStyle},` +
    `Outline=${style.outline},Shadow=${style.shadow},` +
    `Alignment=${style.alignment},MarginV=${style.marginV},` +
    `Bold=${style.bold},Spacing=${style.spacing}`;
}
