import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Extrai timestamps de palavras usando Whisper API
 * @param {string} audioPath - Caminho do arquivo de áudio
 * @returns {Promise<Array>} Array de palavras com timestamps
 */
export async function extractWordTimestamps(audioPath) {
  try {
    console.log(`   Extracting timestamps from: ${path.basename(audioPath)}`);

    const audioFile = fs.createReadStream(audioPath);

    // Usa o Whisper com timestamp_granularities para obter word-level timestamps
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    });

    // Extrai palavras com timestamps
    const words = transcription.words || [];

    if (words.length === 0) {
      console.warn(`   ⚠️  No word timestamps found for ${path.basename(audioPath)}`);
      return [];
    }

    console.log(`   ✅ Extracted ${words.length} word timestamps`);

    return words.map(word => ({
      word: word.word,
      start: word.start,
      end: word.end
    }));

  } catch (error) {
    console.error(`   ❌ Error extracting timestamps: ${error.message}`);
    throw error;
  }
}

/**
 * Processa múltiplos chunks de áudio e extrai timestamps
 * @param {Array} audioMetadata - Metadados dos chunks de áudio
 * @returns {Promise<Array>} Metadados atualizados com timestamps de palavras
 */
export async function extractTimestampsFromChunks(audioMetadata) {
  console.log('\n🎯 Extracting precise word timestamps with Whisper...');

  let cumulativeTime = 0;
  const updatedMetadata = [];

  for (const chunk of audioMetadata) {
    console.log(`\n   Processing chunk ${chunk.chunkIndex + 1}/${audioMetadata.length}...`);

    // Extrai timestamps do chunk
    const words = await extractWordTimestamps(chunk.path);

    // Ajusta timestamps para tempo cumulativo (relativo ao vídeo completo)
    const adjustedWords = words.map(word => ({
      word: word.word.trim(),
      start: cumulativeTime + word.start,
      end: cumulativeTime + word.end
    }));

    updatedMetadata.push({
      ...chunk,
      words: adjustedWords,
      wordCount: adjustedWords.length
    });

    cumulativeTime += chunk.duration;
  }

  const totalWords = updatedMetadata.reduce((sum, chunk) => sum + chunk.wordCount, 0);
  console.log(`\n✅ Extracted timestamps for ${totalWords} words across ${audioMetadata.length} chunks`);

  return updatedMetadata;
}

/**
 * Converte metadados com timestamps em formato plano de palavras
 * @param {Array} chunksWithTimestamps - Chunks com timestamps
 * @returns {Array} Array plano de todas as palavras com timestamps
 */
export function flattenWordTimestamps(chunksWithTimestamps) {
  const allWords = [];

  for (const chunk of chunksWithTimestamps) {
    if (chunk.words && chunk.words.length > 0) {
      allWords.push(...chunk.words);
    }
  }

  return allWords;
}
