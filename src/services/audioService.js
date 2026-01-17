import { generateTTS } from './openaiService.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Divide o script em chunks para geração de áudio
 * @param {string} script - Script completo
 * @param {number} maxChars - Máximo de caracteres por chunk
 * @returns {Array} Array de chunks com metadados
 */
export function splitScriptIntoChunks(script, maxChars = 4000) {
  const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];
  const chunks = [];
  let currentChunk = '';
  let wordCount = 0;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();

    if ((currentChunk + ' ' + trimmedSentence).length > maxChars && currentChunk) {
      const chunkWordCount = currentChunk.trim().split(/\s+/).length;
      chunks.push({
        text: currentChunk.trim(),
        wordStart: wordCount - chunkWordCount,
        wordEnd: wordCount,
        chunkIndex: chunks.length
      });
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }

    wordCount += trimmedSentence.split(/\s+/).length;
  }

  if (currentChunk.trim()) {
    const chunkWordCount = currentChunk.trim().split(/\s+/).length;
    chunks.push({
      text: currentChunk.trim(),
      wordStart: wordCount - chunkWordCount,
      wordEnd: wordCount,
      chunkIndex: chunks.length
    });
  }

  return chunks;
}

/**
 * Gera áudio para múltiplos chunks de texto usando ElevenLabs
 * @param {Array} chunks - Chunks de texto
 * @param {string} outputDir - Diretório de saída
 * @param {object} options - Opções de TTS (reservado para uso futuro)
 * @returns {Promise<Array>} Array de metadados dos áudios gerados
 */
export async function generateAudioChunks(chunks, outputDir, options = {}) {
  console.log(`\n🎙️  Generating audio with ElevenLabs TTS...`);
  console.log(`   Total chunks: ${chunks.length}`);

  const audioMetadata = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const audioPath = path.join(outputDir, `chunk_${i + 1}.mp3`);

    console.log(`   Generating chunk ${i + 1}/${chunks.length}...`);

    await generateTTS(chunk.text, audioPath);

    // Obter duração do áudio (será calculado depois com FFmpeg)
    audioMetadata.push({
      path: audioPath,
      text: chunk.text,
      chunkIndex: i,
      wordStart: chunk.wordStart,
      wordEnd: chunk.wordEnd,
      duration: null // Será preenchido depois
    });
  }

  console.log(`✅ Audio generation complete: ${chunks.length} chunks`);

  return audioMetadata;
}

/**
 * Adiciona informações de duração aos metadados de áudio
 * @param {Array} audioMetadata - Metadados dos áudios
 * @param {Function} getDurationFunc - Função para obter duração
 * @returns {Promise<Array>} Metadados atualizados com duração
 */
export async function addAudioDurations(audioMetadata, getDurationFunc) {
  console.log('\n⏱️  Calculating audio durations...');

  for (const audio of audioMetadata) {
    audio.duration = await getDurationFunc(audio.path);
    console.log(`   ${path.basename(audio.path)}: ${audio.duration.toFixed(2)}s`);
  }

  const totalDuration = audioMetadata.reduce((sum, a) => sum + a.duration, 0);
  console.log(`✅ Total audio duration: ${totalDuration.toFixed(2)}s (${Math.floor(totalDuration / 60)}m ${Math.floor(totalDuration % 60)}s)`);

  return audioMetadata;
}

/**
 * Cria arquivo de lista para concatenação FFmpeg
 * @param {Array} audioPaths - Array de caminhos de áudio
 * @param {string} outputPath - Caminho do arquivo de lista
 * @returns {Promise<string>} Caminho do arquivo criado
 */
export async function createAudioFileList(audioPaths, outputPath) {
  const fileList = audioPaths
    .map(audioPath => `file '${path.resolve(audioPath)}'`)
    .join('\n');

  await fs.writeFile(outputPath, fileList, 'utf-8');
  return outputPath;
}

/**
 * Valida que todos os arquivos de áudio existem
 * @param {Array} audioMetadata - Metadados dos áudios
 * @returns {Promise<boolean>} True se todos existem
 */
export async function validateAudioFiles(audioMetadata) {
  console.log('\n🔍 Validating audio files...');

  const validations = await Promise.all(
    audioMetadata.map(async (audio) => {
      try {
        await fs.access(audio.path);
        return { path: audio.path, exists: true };
      } catch {
        return { path: audio.path, exists: false };
      }
    })
  );

  const missing = validations.filter(v => !v.exists);

  if (missing.length > 0) {
    console.error('❌ Missing audio files:');
    missing.forEach(m => console.error(`   - ${m.path}`));
    return false;
  }

  console.log(`✅ All ${audioMetadata.length} audio files validated`);
  return true;
}
