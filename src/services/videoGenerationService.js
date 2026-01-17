import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Utils
import { cleanScript, validateScript } from '../utils/textCleaner.js';
import { validatePrompts } from '../utils/jsonCleaner.js';
import { generateSRT, generateSubtitlesWithTimestamps } from '../utils/srtGenerator.js';

// Services
import { generateImagePrompts } from './openaiService.js';
import { generateImagesInBatch } from './replicateService.js';
import { generateViralThumbnail, generateThumbnailVariations } from './thumbnailService.js';
import {
  extractTimestampsFromChunks,
  flattenWordTimestamps
} from './whisperService.js';
import {
  splitScriptIntoChunks,
  generateAudioChunks,
  addAudioDurations,
  validateAudioFiles
} from './audioService.js';

// FFmpeg helpers
import {
  getAudioDuration,
  concatenateAudio,
  addBackgroundMusic,
  compileVideoWithEffects
} from '../utils/ffmpegHelper.js';

// Supabase storage
import {
  uploadImages,
  uploadVideo,
  uploadThumbnail,
  uploadMusic
} from './supabaseStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../..');

// Output paths
const OUTPUT_PATHS = {
  images: path.join(PROJECT_ROOT, 'output', 'images'),
  audio: path.join(PROJECT_ROOT, 'output', 'audio'),
  subtitles: path.join(PROJECT_ROOT, 'output', 'subtitles'),
  videos: path.join(PROJECT_ROOT, 'output', 'videos'),
  thumbnails: path.join(PROJECT_ROOT, 'output', 'thumbnails'),
  assets: path.join(PROJECT_ROOT, 'assets')
};

/**
 * Main video generation pipeline
 * @param {Object} config - Video generation configuration
 * @param {string} config.script - Video script text
 * @param {Buffer} [config.musicBuffer] - Background music file buffer
 * @param {string} [config.musicFileName] - Background music file name
 * @param {number} [config.musicVolume=0.15] - Music volume (0.0 - 1.0)
 * @param {string} [config.quality='medium'] - Video quality preset (fast, medium, slow)
 * @param {boolean} [config.addTVOverlay=true] - Add vintage TV effect
 * @param {number} [config.overlayOpacity=0.3] - TV overlay opacity (0.0 - 1.0)
 * @param {boolean} [config.generateThumbnail=true] - Generate thumbnail
 * @param {string} [config.thumbnailMode='single'] - Thumbnail mode (single, multiple)
 * @param {Function} [config.onProgress] - Progress callback function
 * @returns {Promise<Object>} Generation result with URLs
 */
export async function generateVideo(config) {
  const {
    script,
    musicBuffer,
    musicFileName,
    musicVolume = 0.15,
    quality = 'medium',
    addTVOverlay = true,
    overlayOpacity = 0.3,
    generateThumbnail = true,
    thumbnailMode = 'single',
    onProgress = () => {}
  } = config;

  const startTime = Date.now();
  let musicPath = null;

  try {
    // STEP 1: Clean Script
    onProgress({ step: 1, message: 'Cleaning script...' });
    const cleanedScript = cleanScript(script);
    const validation = validateScript(cleanedScript);

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    onProgress({
      step: 1,
      message: 'Script validated',
      data: {
        wordCount: validation.wordCount,
        estimatedDuration: validation.estimatedDuration,
        category: validation.category
      }
    });

    // STEP 2: Generate Image Prompts
    onProgress({ step: 2, message: 'Generating image prompts with AI...' });
    const promptsData = await generateImagePrompts(cleanedScript);

    const promptValidation = validatePrompts(promptsData);
    if (promptValidation.issues.length > 0) {
      onProgress({
        step: 2,
        message: 'Prompt quality warnings',
        warnings: promptValidation.issues
      });
    }

    // STEP 3: Generate Images
    onProgress({ step: 3, message: 'Generating images with Replicate...' });

    const ensureOldPaintingStyle = (prompt, index) => {
      const oldPaintingKeywords = ['old master painting', 'classical oil painting', 'Renaissance', 'chiaroscuro'];
      const hasOldPaintingStyle = oldPaintingKeywords.some(keyword =>
        prompt.toLowerCase().includes(keyword.toLowerCase())
      );

      if (!hasOldPaintingStyle) {
        return `${prompt}, painted in old master painting style, classical oil painting technique, chiaroscuro lighting, dark Renaissance aesthetic, canvas texture, brushstroke visible, ancient painting style`;
      }

      return prompt;
    };

    const imagePrompts = promptsData.image_prompts.map((item, index) => ({
      prompt: ensureOldPaintingStyle(item.prompt, index),
      outputPath: path.join(OUTPUT_PATHS.images, `image_${Date.now()}_${index + 1}.jpg`),
      metadata: item
    }));

    const imageResults = await generateImagesInBatch(imagePrompts, {}, 1, 12000, 3);
    const successfulImages = imageResults.filter(r => r.success);

    if (successfulImages.length === 0) {
      throw new Error('No images were generated successfully');
    }

    const imagePaths = successfulImages.map(r => r.path);
    onProgress({ step: 3, message: `${imagePaths.length} images generated` });

    // Upload images to Supabase
    onProgress({ step: 3, message: 'Uploading images to Supabase...' });
    const imageUrls = await uploadImages(imagePaths);

    // STEP 4: Split Script
    onProgress({ step: 4, message: 'Splitting script for audio generation...' });
    const chunks = splitScriptIntoChunks(cleanedScript);

    // STEP 5: Generate Audio
    onProgress({ step: 5, message: 'Generating audio narration...' });
    let audioMetadata = await generateAudioChunks(chunks, OUTPUT_PATHS.audio);
    audioMetadata = await addAudioDurations(audioMetadata, getAudioDuration);

    const audioValid = await validateAudioFiles(audioMetadata);
    if (!audioValid) {
      throw new Error('Audio validation failed');
    }

    // STEP 6: Extract Timestamps
    onProgress({ step: 6, message: 'Extracting word timestamps with Whisper...' });
    const chunksWithTimestamps = await extractTimestampsFromChunks(audioMetadata);
    const allWords = flattenWordTimestamps(chunksWithTimestamps);

    // STEP 7: Generate Subtitles
    onProgress({ step: 7, message: 'Generating karaoke subtitles...' });
    const srtPath = path.join(OUTPUT_PATHS.subtitles, `subtitles_${Date.now()}.srt`);
    const subtitlePath = await generateSubtitlesWithTimestamps(allWords, srtPath);

    // STEP 8: Concatenate Audio
    onProgress({ step: 8, message: 'Concatenating audio chunks...' });
    const narrationPath = path.join(OUTPUT_PATHS.audio, `narration_full_${Date.now()}.mp3`);
    const audioPaths = audioMetadata.map(a => a.path);
    await concatenateAudio(audioPaths, narrationPath);

    // STEP 9: Add Background Music
    let finalAudioPath = narrationPath;

    if (musicBuffer) {
      onProgress({ step: 9, message: 'Uploading and adding background music...' });

      // Upload music to Supabase
      const musicUploadResult = await uploadMusic(musicBuffer, musicFileName);

      // Save music temporarily for processing
      musicPath = path.join(OUTPUT_PATHS.audio, `temp_music_${Date.now()}.mp3`);
      await fs.writeFile(musicPath, musicBuffer);

      const audioWithMusicPath = path.join(OUTPUT_PATHS.audio, `final_audio_${Date.now()}.mp3`);
      finalAudioPath = await addBackgroundMusic(
        narrationPath,
        musicPath,
        audioWithMusicPath,
        musicVolume
      );
    }

    // STEP 10: Compile Video
    onProgress({ step: 10, message: 'Compiling final video...' });
    const videoOutputPath = path.join(OUTPUT_PATHS.videos, `video_${Date.now()}.mp4`);

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

    // Upload video to Supabase
    onProgress({ step: 10, message: 'Uploading video to Supabase...' });
    const videoUploadResult = await uploadVideo(videoOutputPath);

    // STEP 11: Generate Thumbnail
    let thumbnailResults = null;

    if (generateThumbnail) {
      if (thumbnailMode === 'multiple') {
        onProgress({ step: 11, message: 'Generating thumbnail variations...' });
        const thumbnails = await generateThumbnailVariations(cleanedScript, OUTPUT_PATHS.thumbnails, 3);

        const successfulThumbnails = thumbnails.filter(t => !t.error);
        const thumbnailUploads = await Promise.all(
          successfulThumbnails.map(t => uploadThumbnail(t.imagePath))
        );

        thumbnailResults = successfulThumbnails.map((t, i) => ({
          ...t,
          url: thumbnailUploads[i].url
        }));
      } else {
        onProgress({ step: 11, message: 'Generating viral thumbnail...' });
        const thumbnailPath = path.join(OUTPUT_PATHS.thumbnails, `thumbnail_${Date.now()}.jpg`);
        const thumbnail = await generateViralThumbnail(cleanedScript, thumbnailPath);

        const thumbnailUpload = await uploadThumbnail(thumbnailPath);
        thumbnailResults = {
          ...thumbnail,
          url: thumbnailUpload.url
        };
      }
    }

    // Cleanup temporary files
    if (musicPath) {
      await fs.unlink(musicPath).catch(() => {});
    }

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000 / 60).toFixed(2);

    const result = {
      success: true,
      video: {
        url: videoUploadResult.url,
        duration: (audioMetadata.reduce((sum, a) => sum + a.duration, 0) / 60).toFixed(2)
      },
      images: imageUrls.map(img => img.url),
      thumbnails: thumbnailResults,
      metadata: {
        wordCount: validation.wordCount,
        estimatedDuration: validation.estimatedDuration,
        category: validation.category,
        imagesGenerated: imagePaths.length,
        audioChunks: audioMetadata.length,
        processingTime: totalTime
      }
    };

    onProgress({ step: 11, message: 'Video generation complete!', result });

    return result;

  } catch (error) {
    // Cleanup on error
    if (musicPath) {
      await fs.unlink(musicPath).catch(() => {});
    }

    throw error;
  }
}
