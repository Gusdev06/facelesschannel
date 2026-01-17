import express from 'express';
import upload from '../middleware/upload.js';
import { addVideoJob, getJobStatus } from '../queue/videoQueue.js';

const router = express.Router();

/**
 * POST /api/videos
 * Create a new video generation job
 *
 * Body (multipart/form-data):
 * - script (required): Video script text
 * - musicFile (optional): Background music file (MP3/WAV)
 * - useDefaultMusic (optional): true|false - Use default music from assets folder
 * - musicVolume (optional): Music volume 0.0-1.0 (default: 0.15)
 * - quality (optional): fast|medium|slow (default: medium)
 * - addTVOverlay (optional): true|false (default: true)
 * - overlayOpacity (optional): 0.0-1.0 (default: 0.3)
 * - generateThumbnail (optional): true|false (default: true)
 * - thumbnailMode (optional): single|multiple (default: single)
 */
router.post('/', upload.single('musicFile'), async (req, res, next) => {
  try {
    const { script, useDefaultMusic, musicVolume, quality, addTVOverlay, overlayOpacity, generateThumbnail, thumbnailMode } = req.body;

    // Validate required fields
    if (!script || script.trim().length === 0) {
      return res.status(400).json({
        error: {
          message: 'Script is required',
          field: 'script'
        }
      });
    }

    // Parse and validate numeric fields
    const parsedMusicVolume = musicVolume ? parseFloat(musicVolume) : 0.15;
    const parsedOverlayOpacity = overlayOpacity ? parseFloat(overlayOpacity) : 0.3;

    if (parsedMusicVolume < 0 || parsedMusicVolume > 1) {
      return res.status(400).json({
        error: {
          message: 'musicVolume must be between 0.0 and 1.0',
          field: 'musicVolume'
        }
      });
    }

    if (parsedOverlayOpacity < 0 || parsedOverlayOpacity > 1) {
      return res.status(400).json({
        error: {
          message: 'overlayOpacity must be between 0.0 and 1.0',
          field: 'overlayOpacity'
        }
      });
    }

    // Validate quality
    const validQualities = ['fast', 'medium', 'slow'];
    const parsedQuality = quality || 'medium';
    if (!validQualities.includes(parsedQuality)) {
      return res.status(400).json({
        error: {
          message: `quality must be one of: ${validQualities.join(', ')}`,
          field: 'quality'
        }
      });
    }

    // Validate thumbnail mode
    const validThumbnailModes = ['single', 'multiple'];
    const parsedThumbnailMode = thumbnailMode || 'single';
    if (!validThumbnailModes.includes(parsedThumbnailMode)) {
      return res.status(400).json({
        error: {
          message: `thumbnailMode must be one of: ${validThumbnailModes.join(', ')}`,
          field: 'thumbnailMode'
        }
      });
    }

    // Parse boolean fields
    const parsedAddTVOverlay = addTVOverlay === 'false' ? false : true;
    const parsedGenerateThumbnail = generateThumbnail === 'false' ? false : true;
    const parsedUseDefaultMusic = useDefaultMusic === 'true' ? true : false;

    // Prepare job data
    const jobData = {
      script: script.trim(),
      musicBuffer: req.file ? Array.from(req.file.buffer) : null, // Convert Buffer to array for Redis
      musicFileName: req.file ? req.file.originalname : null,
      useDefaultMusic: parsedUseDefaultMusic,
      musicVolume: parsedMusicVolume,
      quality: parsedQuality,
      addTVOverlay: parsedAddTVOverlay,
      overlayOpacity: parsedOverlayOpacity,
      generateThumbnail: parsedGenerateThumbnail,
      thumbnailMode: parsedThumbnailMode
    };

    // Add job to queue
    const jobId = await addVideoJob(jobData);

    res.status(202).json({
      jobId,
      message: 'Video generation job created',
      statusUrl: `/api/videos/${jobId}`
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/videos/:jobId
 * Get video generation job status and result
 */
router.get('/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const jobStatus = await getJobStatus(jobId);

    if (!jobStatus) {
      return res.status(404).json({
        error: {
          message: 'Job not found',
          jobId
        }
      });
    }

    res.json(jobStatus);

  } catch (error) {
    next(error);
  }
});

export default router;
