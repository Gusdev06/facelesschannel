#!/usr/bin/env node

import dotenv from 'dotenv';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Utils
import { cleanScript, validateScript } from './utils/textCleaner.js';
import { validatePrompts } from './utils/jsonCleaner.js';
import { generateSRT, generateSubtitlesWithTimestamps } from './utils/srtGenerator.js';

// Services
import { generateImagePrompts } from './services/openaiService.js';
import { generateImagesInBatch } from './services/replicateService.js';
import { generateViralThumbnail, generateThumbnailVariations } from './services/thumbnailService.js';
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
  thumbnails: path.join(PROJECT_ROOT, 'output', 'thumbnails'),
  assets: path.join(PROJECT_ROOT, 'assets')
};

/**
 * Banner inicial
 */
function printBanner() {
  console.clear();
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                                                            ║'));
  console.log(chalk.cyan.bold('║        🎬 GERADOR AUTOMÁTICO DE VÍDEOS FACELESS 🎬        ║'));
  console.log(chalk.cyan.bold('║                                                            ║'));
  console.log(chalk.cyan.bold('║   Com Legendas, Zoom/Pan, Transições + Film Grain Pro     ║'));
  console.log(chalk.cyan.bold('║                                                            ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════╝\n'));
}

/**
 * Valida ambiente e dependências
 */
async function validateEnvironment() {
  console.log(chalk.yellow('🔍 Validating environment...\n'));

  // Valida variáveis de ambiente
  const requiredEnvVars = ['OPENAI_API_KEY', 'REPLICATE_API_KEY'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.error(chalk.red(`❌ Missing environment variables: ${missingVars.join(', ')}`));
    console.error(chalk.yellow('   Please create a .env file with the required API keys'));
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
async function getUserInput() {
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
      default: path.join(OUTPUT_PATHS.assets, 'background-music.mp3')
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
    },
    {
      type: 'confirm',
      name: 'addTVOverlay',
      message: 'Add vintage TV effect overlay (particles and grain)?',
      default: false
    },
    {
      type: 'number',
      name: 'overlayOpacity',
      message: 'TV overlay opacity (0.0 - 1.0):',
      when: (answers) => answers.addTVOverlay,
      default: 0.3,
      validate: (input) => input >= 0 && input <= 1 ? true : 'Must be between 0.0 and 1.0'
    },
    {
      type: 'confirm',
      name: 'generateThumbnail',
      message: 'Generate viral thumbnail for the video?',
      default: true
    },
    {
      type: 'list',
      name: 'thumbnailMode',
      message: 'Thumbnail generation mode:',
      when: (answers) => answers.generateThumbnail,
      choices: [
        { name: 'Single thumbnail (best option)', value: 'single' },
        { name: 'Multiple variations for A/B testing (3 versions)', value: 'multiple' }
      ],
      default: 'single'
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
 * Pipeline principal de geração de vídeo
 */
async function generateVideo(config) {
  const { script, addMusic, musicPath, musicVolume, quality, addTVOverlay, overlayOpacity, generateThumbnail, thumbnailMode } = config;

  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('🚀 STARTING VIDEO GENERATION PIPELINE'));
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
    console.log(`   Category: ${validation.category}`);

    // ETAPA 2: Gerar Prompts de Imagens
    console.log(chalk.yellow('\n🎨 STEP 2: Generating image prompts with AI...'));
    const promptsData = await generateImagePrompts(cleanedScript);

    // Valida qualidade dos prompts
    const promptValidation = validatePrompts(promptsData);
    if (promptValidation.issues.length > 0) {
      console.warn(chalk.yellow('\n⚠️  Prompt quality warnings:'));
      promptValidation.issues.forEach(issue => console.warn(`   - ${issue}`));
    }

    // ETAPA 3: Gerar Imagens
    console.log(chalk.yellow('\n🖼️  STEP 3: Generating images with Replicate...'));

    // Reforça o estilo de pintura antiga em TODOS os prompts (camada de segurança)
    let promptsModified = 0;
    const ensureOldPaintingStyle = (prompt, index) => {
      const oldPaintingKeywords = ['old master painting', 'classical oil painting', 'Renaissance', 'chiaroscuro'];
      const hasOldPaintingStyle = oldPaintingKeywords.some(keyword =>
        prompt.toLowerCase().includes(keyword.toLowerCase())
      );

      if (!hasOldPaintingStyle) {
        // Se o prompt não tem o estilo de pintura antiga, adiciona
        promptsModified++;
        console.log(chalk.yellow(`   ⚠️  Adding old painting style to prompt ${index + 1}`));
        return `${prompt}, painted in old master painting style, classical oil painting technique, chiaroscuro lighting, dark Renaissance aesthetic, canvas texture, brushstroke visible, ancient painting style`;
      }

      return prompt;
    };

    const imagePrompts = promptsData.image_prompts.map((item, index) => ({
      prompt: ensureOldPaintingStyle(item.prompt, index),
      outputPath: path.join(OUTPUT_PATHS.images, `image_${index + 1}.jpg`),
      metadata: item
    }));

    if (promptsModified > 0) {
      console.log(chalk.green(`   ✅ Reinforced old painting style on ${promptsModified} prompts`));
    } else {
      console.log(chalk.green(`   ✅ All prompts already have old painting style`));
    }

    // Use concurrency=1 and 12s delay to respect Replicate rate limits (6 req/min)
    const imageResults = await generateImagesInBatch(
      imagePrompts,
      {},
      1,      // concurrency: 1 image at a time (respects burst limit)
      12000,  // 12 second delay between requests (allows 5 req/min safely)
      3       // max 3 retries per image
    );
    const successfulImages = imageResults.filter(r => r.success);

    if (successfulImages.length === 0) {
      throw new Error('No images were generated successfully');
    }

    const imagePaths = successfulImages.map(r => r.path);
    console.log(chalk.green(`✅ ${imagePaths.length} images ready`));

    // ETAPA 4: Dividir Script em Chunks
    console.log(chalk.yellow('\n✂️  STEP 4: Splitting script for audio generation...'));
    const chunks = splitScriptIntoChunks(cleanedScript);
    console.log(chalk.green(`✅ Script split into ${chunks.length} chunks`));

    // ETAPA 5: Gerar Áudio (TTS)
    console.log(chalk.yellow('\n🎙️  STEP 5: Generating audio narration...'));
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

    // ETAPA 6: Extrair Timestamps com Whisper
    console.log(chalk.yellow('\n🎯 STEP 6: Extracting precise word timestamps with Whisper...'));
    const chunksWithTimestamps = await extractTimestampsFromChunks(audioMetadata);
    const allWords = flattenWordTimestamps(chunksWithTimestamps);

    console.log(chalk.green(`✅ Extracted ${allWords.length} word timestamps with 100% accuracy`));

    // ETAPA 7: Gerar Legendas com Timestamps Reais
    console.log(chalk.yellow('\n📝 STEP 7: Generating karaoke subtitles with real timestamps...'));
    const srtPath = path.join(OUTPUT_PATHS.subtitles, 'subtitles.srt');
    // generateSubtitlesWithTimestamps usa os timestamps REAIS do Whisper
    const subtitlePath = await generateSubtitlesWithTimestamps(allWords, srtPath);

    // ETAPA 8: Concatenar Áudios
    console.log(chalk.yellow('\n🔗 STEP 8: Concatenating audio chunks...'));
    const narrationPath = path.join(OUTPUT_PATHS.audio, 'narration_full.mp3');
    const audioPaths = audioMetadata.map(a => a.path);
    await concatenateAudio(audioPaths, narrationPath);

    // ETAPA 9: Adicionar Música de Fundo
    let finalAudioPath = narrationPath;

    if (addMusic) {
      console.log(chalk.yellow('\n🎵 STEP 9: Adding background music...'));
      const audioWithMusicPath = path.join(OUTPUT_PATHS.audio, 'final_audio_with_music.mp3');
      finalAudioPath = await addBackgroundMusic(
        narrationPath,
        musicPath,
        audioWithMusicPath,
        musicVolume
      );
    } else {
      console.log(chalk.yellow('\n⏭️  STEP 9: Skipping background music...'));
    }

    // ETAPA 10: Compilar Vídeo Final
    console.log(chalk.yellow('\n🎬 STEP 10: Compiling final video...'));
    const videoOutputPath = path.join(
      OUTPUT_PATHS.videos,
      `video_${Date.now()}.mp4`
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
        transitionDuration: 0.5,
        overlayVideoPath: addTVOverlay ? path.join(OUTPUT_PATHS.assets, 'video.mp4') : null,
        overlayOpacity: overlayOpacity || 0.3
      }
    );

    // ETAPA 11: Gerar Thumbnail (Opcional)
    let thumbnailResult = null;

    if (generateThumbnail) {
      if (thumbnailMode === 'multiple') {
        console.log(chalk.yellow('\n🎯 STEP 11: Generating thumbnail variations for A/B testing...'));
        thumbnailResult = await generateThumbnailVariations(
          cleanedScript,
          OUTPUT_PATHS.thumbnails,
          3
        );
        console.log(chalk.green(`✅ Generated ${thumbnailResult.filter(r => !r.error).length} thumbnail variations`));
      } else {
        console.log(chalk.yellow('\n🎯 STEP 11: Generating viral thumbnail...'));
        const thumbnailPath = path.join(
          OUTPUT_PATHS.thumbnails,
          `thumbnail_${Date.now()}.jpg`
        );
        thumbnailResult = await generateViralThumbnail(cleanedScript, thumbnailPath);
        console.log(chalk.green(`✅ Thumbnail ready: ${thumbnailPath}`));
      }
    } else {
      console.log(chalk.yellow('\n⏭️  STEP 11: Skipping thumbnail generation...'));
    }

    // Conclusão
    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000 / 60).toFixed(2);

    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.green.bold('✅ VIDEO GENERATION COMPLETE!'));
    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.white(`\n📊 Summary:`));
    console.log(`   Images generated: ${imagePaths.length}`);
    console.log(`   Audio chunks: ${audioMetadata.length}`);
    console.log(`   Total duration: ${(audioMetadata.reduce((sum, a) => sum + a.duration, 0) / 60).toFixed(2)} min`);
    console.log(`   Processing time: ${totalTime} min`);
    console.log(chalk.green.bold(`\n🎉 Your video is ready: ${videoOutputPath}`));

    if (thumbnailResult) {
      if (Array.isArray(thumbnailResult)) {
        console.log(chalk.cyan(`\n📸 Viral Thumbnails (Old Master Painting Style):`));
        thumbnailResult.filter(r => !r.error).forEach(t => {
          console.log(`   Variation ${t.variation}: ${t.imagePath}`);
          console.log(`   → Text painted in image: "${t.textHook}" (${t.hookPosition})`);
          console.log(`   → Style: Old master painting with integrated text`);
        });
      } else {
        console.log(chalk.cyan(`\n📸 Viral Thumbnail (Old Master Painting Style):`));
        console.log(`   File: ${thumbnailResult.imagePath}`);
        console.log(`   ✨ Text painted in image: "${thumbnailResult.textHook}" (${thumbnailResult.hookPosition})`);
        console.log(`   🎨 Style: ${thumbnailResult.style || 'old_master_painting'}`);
        console.log(`   💡 Strategy: ${thumbnailResult.explanation}`);
        console.log(chalk.green(`   ✅ Ready to upload - no editing needed!`));
      }
    }

    console.log();

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

  // Coleta input do usuário
  const userInput = await getUserInput();

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
    addTVOverlay: userInput.addTVOverlay,
    overlayOpacity: userInput.overlayOpacity || 0.3,
    generateThumbnail: userInput.generateThumbnail,
    thumbnailMode: userInput.thumbnailMode || 'single'
  };

  // Inicia geração
  await generateVideo(config);
}

// Execute
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
