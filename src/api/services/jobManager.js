import { generateVideo } from '../../services/videoGenerationService.js';
import { randomUUID } from 'crypto';

// In-memory job storage
const jobs = new Map();

/**
 * Create and start a video generation job
 */
export function createVideoJob(jobData) {
  const jobId = randomUUID();

  console.log(`[JobManager] Creating job ${jobId}`);

  // Initialize job
  jobs.set(jobId, {
    jobId,
    status: 'processing',
    progress: 0,
    step: 0,
    message: 'Starting video generation',
    createdAt: new Date().toISOString()
  });

  // Process video in background using setImmediate to ensure it runs after response is sent
  setImmediate(() => {
    console.log(`[JobManager] Starting background processing for job ${jobId}`);
    processVideoJob(jobId, jobData).catch(error => {
      console.error(`Job ${jobId} failed:`, error);
    });
  });

  console.log(`[JobManager] Job ${jobId} created, returning immediately`);
  return jobId;
}

/**
 * Process video job in background
 */
async function processVideoJob(jobId, jobData) {
  const { script, musicBuffer, musicFileName, useDefaultMusic, musicVolume, quality, addTVOverlay, overlayOpacity, generateThumbnail, thumbnailMode } = jobData;

  try {
    // Progress callback
    const onProgress = (progressData) => {
      const { step, message, data, warnings } = progressData;

      const progressInfo = {
        jobId,
        status: 'processing',
        progress: Math.round((step / 11) * 100),
        step,
        message,
        ...(data && { data }),
        ...(warnings && { warnings }),
        updatedAt: new Date().toISOString()
      };

      jobs.set(jobId, progressInfo);
    };

    // Generate video
    const result = await generateVideo({
      script,
      musicBuffer,
      musicFileName,
      useDefaultMusic,
      musicVolume,
      quality,
      addTVOverlay,
      overlayOpacity,
      generateThumbnail,
      thumbnailMode,
      onProgress
    });

    // Update final status
    jobs.set(jobId, {
      jobId,
      status: 'completed',
      progress: 100,
      step: 11,
      message: 'Video generation complete',
      result,
      completedAt: new Date().toISOString()
    });

    console.log(`Job ${jobId} completed successfully`);

  } catch (error) {
    // Update error status
    jobs.set(jobId, {
      jobId,
      status: 'failed',
      progress: jobs.get(jobId)?.progress || 0,
      error: error.message,
      failedAt: new Date().toISOString()
    });

    console.error(`Job ${jobId} failed:`, error.message);
  }
}

/**
 * Get job status
 */
export function getJobStatus(jobId) {
  return jobs.get(jobId) || null;
}

/**
 * Delete old jobs (cleanup)
 * Call this periodically to prevent memory leaks
 */
export function cleanupOldJobs(maxAgeHours = 24) {
  const now = new Date();
  const maxAge = maxAgeHours * 60 * 60 * 1000;

  for (const [jobId, job] of jobs.entries()) {
    const completedAt = job.completedAt || job.failedAt;
    if (completedAt) {
      const age = now - new Date(completedAt);
      if (age > maxAge) {
        jobs.delete(jobId);
        console.log(`Cleaned up old job: ${jobId}`);
      }
    }
  }
}

// Cleanup old jobs every hour
setInterval(() => cleanupOldJobs(), 60 * 60 * 1000);
