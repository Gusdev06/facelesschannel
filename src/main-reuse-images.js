#!/usr/bin/env node

/**
 * GERADOR DE VÍDEO COM REUSO DE IMAGENS
 *
 * Este script reutiliza imagens já geradas na pasta output/images
 * para economizar créditos da API do Replicate
 */

import dotenv from 'dotenv';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Utils
import { cleanScript, validateScript } from './utils/textCleaner.js';
import { generateSubtitlesWithTimestamps } from './utils/srtGenerator.js';

// Services
import {
  extractTimestampsFromChunks,
  flattenWordTimestamps
} from './services/whisperService.js';
import {
  splitScriptIntoChunks,
  generateAudioChunks,
  addAudioDurations,
  validateAudioFiles
} from './services/audioService.js';

// FFmpeg helpers
import {
  validateFFmpeg,
  getAudioDuration,
  concatenateAudio,
  addBackgroundMusic,
  compileVideoWithEffects
} from './utils/ffmpegHelper.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// Caminhos de output
const OUTPUT_PATHS = {
  images: path.join(PROJECT_ROOT, 'output', 'images'),
  audio: path.join(PROJECT_ROOT, 'output', 'audio'),
  subtitles: path.join(PROJECT_ROOT, 'output', 'subtitles'),
  videos: path.join(PROJECT_ROOT, 'output', 'videos'),
  assets: path.join(PROJECT_ROOT, 'assets')
};

/**
 * Banner inicial
 */
function printBanner() {
  console.clear();
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                                                            ║'));
  console.log(chalk.cyan.bold('║      🎬 GERADOR DE VÍDEO - MODO REUSO DE IMAGENS 🎬      ║'));
  console.log(chalk.cyan.bold('║                                                            ║'));
  console.log(chalk.cyan.bold('║         💰 Economize créditos da API Replicate!           ║'));
  console.log(chalk.cyan.bold('║                                                            ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════╝\n'));
}

/**
 * Lista imagens disponíveis na pasta output/images
 */
async function listAvailableImages() {
  try {
    const files = await fs.readdir(OUTPUT_PATHS.images);
    const imageFiles = files
      .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))
      .sort();

    return imageFiles.map(file => path.join(OUTPUT_PATHS.images, file));
  } catch (error) {
    return [];
  }
}

/**
 * Valida ambiente e dependências
 */
async function validateEnvironment() {
  console.log(chalk.yellow('🔍 Validando ambiente...\n'));

  // Valida apenas OPENAI_API_KEY (não precisa de Replicate)
  if (!process.env.OPENAI_API_KEY) {
    console.error(chalk.red('❌ Missing OPENAI_API_KEY'));
    console.error(chalk.yellow('   Please create a .env file with OPENAI_API_KEY'));
    process.exit(1);
  }

  // Valida FFmpeg
  const ffmpegAvailable = await validateFFmpeg();
  if (!ffmpegAvailable) {
    console.error(chalk.red('❌ FFmpeg is required but not found'));
    console.error(chalk.yellow('   Install FFmpeg: https://ffmpeg.org/download.html'));
    process.exit(1);
  }

  console.log(chalk.green('✅ Environment validation passed\n'));
}

/**
 * Prompt para coletar informações do usuário
 */
async function getUserInput(availableImages) {
  console.log(chalk.cyan(`\n📁 Imagens disponíveis: ${availableImages.length}`));

  if (availableImages.length > 0) {
    console.log(chalk.gray('   Primeiras 5 imagens:'));
    availableImages.slice(0, 5).forEach((img, i) => {
      console.log(chalk.gray(`   ${i + 1}. ${path.basename(img)}`));
    });
    if (availableImages.length > 5) {
      console.log(chalk.gray(`   ... e mais ${availableImages.length - 5} imagens`));
    }
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'scriptPath',
      message: 'Enter the path to your script file (or press Enter to type script):',
      default: ''
    },
    {
      type: 'editor',
      name: 'scriptText',
      message: 'Enter your video script (will open editor):',
      when: (answers) => !answers.scriptPath
    },
    {
      type: 'confirm',
      name: 'addMusic',
      message: 'Add background music?',
      default: true
    },
    {
      type: 'input',
      name: 'musicPath',
      message: 'Enter path to background music file (MP3):',
      when: (answers) => answers.addMusic,
      default: path.join(OUTPUT_PATHS.assets, 'background_music.mp3')
    },
    {
      type: 'number',
      name: 'musicVolume',
      message: 'Background music volume (0.0 - 1.0):',
      when: (answers) => answers.addMusic,
      default: 0.15,
      validate: (input) => input >= 0 && input <= 1 ? true : 'Must be between 0.0 and 1.0'
    },
    {
      type: 'list',
      name: 'quality',
      message: 'Select video quality preset:',
      choices: [
        { name: 'Fast (lower quality, faster render)', value: 'fast' },
        { name: 'Medium (balanced)', value: 'medium' },
        { name: 'Slow (higher quality, slower render)', value: 'slow' }
      ],
      default: 'medium'
    }
  ]);

  return answers;
}

/**
 * Carrega script de arquivo ou texto direto
 */
async function loadScript(scriptPath, scriptText) {
  if (scriptPath) {
    console.log(chalk.blue(`\n📄 Loading script from: ${scriptPath}`));
    const content = await fs.readFile(scriptPath, 'utf-8');
    return content;
  } else {
    return scriptText;
  }
}

/**
 * Pipeline principal de geração de vídeo COM REUSO DE IMAGENS
 */
async function generateVideo(config) {
  const { script, addMusic, musicPath, musicVolume, quality, imagePaths } = config;

  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('🚀 STARTING VIDEO GENERATION PIPELINE (REUSING IMAGES)'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));

  const startTime = Date.now();

  try {
    // ETAPA 1: Limpar Script
    console.log(chalk.yellow('📝 STEP 1: Cleaning script...'));
    const cleanedScript = cleanScript(script);
    const validation = validateScript(cleanedScript);

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    console.log(chalk.green(`✅ Script cleaned and validated`));
    console.log(`   Words: ${validation.wordCount}`);
    console.log(`   Estimated duration: ~${validation.estimatedDuration} min`);

    // ETAPA 2: Usar imagens existentes
    console.log(chalk.yellow('\n🖼️  STEP 2: Using existing images...'));
    console.log(chalk.green(`✅ ${imagePaths.length} images ready (no API calls needed!)`));
    console.log(chalk.cyan(`   💰 Saved Replicate API credits!`));

    // ETAPA 3: Dividir Script em Chunks
    console.log(chalk.yellow('\n✂️  STEP 3: Splitting script for audio generation...'));
    const chunks = splitScriptIntoChunks(cleanedScript);
    console.log(chalk.green(`✅ Script split into ${chunks.length} chunks`));

    // ETAPA 4: Gerar Áudio (TTS)
    console.log(chalk.yellow('\n🎙️  STEP 4: Generating audio narration...'));
    let audioMetadata = await generateAudioChunks(
      chunks,
      OUTPUT_PATHS.audio
    );

    // Adiciona durações
    audioMetadata = await addAudioDurations(audioMetadata, getAudioDuration);

    // Valida arquivos
    const audioValid = await validateAudioFiles(audioMetadata);
    if (!audioValid) {
      throw new Error('Audio validation failed');
    }

    // ETAPA 5: Extrair Timestamps com Whisper
    console.log(chalk.yellow('\n🎯 STEP 5: Extracting precise word timestamps with Whisper...'));
    const chunksWithTimestamps = await extractTimestampsFromChunks(audioMetadata);
    const allWords = flattenWordTimestamps(chunksWithTimestamps);

    console.log(chalk.green(`✅ Extracted ${allWords.length} word timestamps with 100% accuracy`));

    // ETAPA 6: Gerar Legendas com Timestamps Reais
    console.log(chalk.yellow('\n📝 STEP 6: Generating karaoke subtitles with real timestamps...'));
    const srtPath = path.join(OUTPUT_PATHS.subtitles, 'subtitles.srt');
    const subtitlePath = await generateSubtitlesWithTimestamps(allWords, srtPath);

    // ETAPA 7: Concatenar Áudios
    console.log(chalk.yellow('\n🔗 STEP 7: Concatenating audio chunks...'));
    const narrationPath = path.join(OUTPUT_PATHS.audio, 'narration_full.mp3');
    const audioPaths = audioMetadata.map(a => a.path);
    await concatenateAudio(audioPaths, narrationPath);

    // ETAPA 8: Adicionar Música de Fundo
    let finalAudioPath = narrationPath;

    if (addMusic) {
      console.log(chalk.yellow('\n🎵 STEP 8: Adding background music...'));
      const audioWithMusicPath = path.join(OUTPUT_PATHS.audio, 'final_audio_with_music.mp3');
      finalAudioPath = await addBackgroundMusic(
        narrationPath,
        musicPath,
        audioWithMusicPath,
        musicVolume
      );
    } else {
      console.log(chalk.yellow('\n⏭️  STEP 8: Skipping background music...'));
    }

    // ETAPA 9: Compilar Vídeo Final
    console.log(chalk.yellow('\n🎬 STEP 9: Compiling final video...'));
    const videoOutputPath = path.join(
      OUTPUT_PATHS.videos,
      `video_reused_${Date.now()}.mp4`
    );

    await compileVideoWithEffects(
      imagePaths,
      finalAudioPath,
      subtitlePath,
      videoOutputPath,
      {
        resolution: '1920:1080',
        fps: 30,
        crf: quality === 'fast' ? 28 : quality === 'slow' ? 18 : 22,
        preset: quality,
        transitionDuration: 0.5
      }
    );

    // Conclusão
    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000 / 60).toFixed(2);

    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.green.bold('✅ VIDEO GENERATION COMPLETE!'));
    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.white(`\n📊 Summary:`));
    console.log(`   Images reused: ${imagePaths.length} (no API costs!)`);
    console.log(`   Audio chunks: ${audioMetadata.length}`);
    console.log(`   Total duration: ${(audioMetadata.reduce((sum, a) => sum + a.duration, 0) / 60).toFixed(2)} min`);
    console.log(`   Processing time: ${totalTime} min`);
    console.log(chalk.green.bold(`\n🎉 Your video is ready: ${videoOutputPath}\n`));
    console.log(chalk.cyan(`💰 Money saved: No Replicate API calls were made!\n`));

  } catch (error) {
    console.error(chalk.red('\n❌ ERROR:'), error.message);
    console.error(chalk.yellow('\nStack trace:'), error.stack);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  printBanner();

  // Valida ambiente
  await validateEnvironment();

  // Lista imagens disponíveis
  const availableImages = await listAvailableImages();

  if (availableImages.length === 0) {
    console.error(chalk.red('❌ No images found in output/images directory'));
    console.error(chalk.yellow('   Please run the main script first to generate images, or'));
    console.error(chalk.yellow('   manually place images in the output/images folder'));
    process.exit(1);
  }

  // Coleta input do usuário
  const userInput = await getUserInput(availableImages);

  // Carrega script
  const script = await loadScript(userInput.scriptPath, userInput.scriptText);

  if (!script || script.trim().length === 0) {
    console.error(chalk.red('❌ No script provided'));
    process.exit(1);
  }

  // Configuração final
  const config = {
    script,
    addMusic: userInput.addMusic,
    musicPath: userInput.musicPath,
    musicVolume: userInput.musicVolume || 0.15,
    quality: userInput.quality,
    imagePaths: availableImages
  };

  // Inicia geração
  await generateVideo(config);
}

// Execute
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
