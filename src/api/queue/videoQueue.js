import { Queue, Worker } from 'bullmq';
import { generateVideo } from '../../services/videoGenerationService.js';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD })
};

// Create video generation queue
export const videoQueue = new Queue('video-generation', { connection });

// Job storage for progress tracking (in production, use Redis or database)
const jobProgress = new Map();

/**
 * Add a video generation job to the queue
 */
export async function addVideoJob(jobData) {
  const job = await videoQueue.add('generate-video', jobData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      count: 100 // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50 // Keep last 50 failed jobs
    }
  });

  // Initialize progress
  jobProgress.set(job.id, {
    jobId: job.id,
    status: 'waiting',
    progress: 0,
    step: 0,
    message: 'Job queued',
    createdAt: new Date().toISOString()
  });

  return job.id;
}

/**
 * Get job status and progress
 */
export async function getJobStatus(jobId) {
  const job = await videoQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = jobProgress.get(jobId) || {};

  let result = {
    jobId,
    status: state,
    ...progress
  };

  // If completed, include the result
  if (state === 'completed' && job.returnvalue) {
    result.result = job.returnvalue;
  }

  // If failed, include the error
  if (state === 'failed' && job.failedReason) {
    result.error = job.failedReason;
  }

  return result;
}

/**
 * Video generation worker
 */
export const videoWorker = new Worker(
  'video-generation',
  async (job) => {
    const { script, musicBuffer, musicFileName, musicVolume, quality, addTVOverlay, overlayOpacity, generateThumbnail, thumbnailMode } = job.data;

    // Progress callback
    const onProgress = (progressData) => {
      const { step, message, data, warnings, result } = progressData;

      const progressInfo = {
        jobId: job.id,
        status: 'processing',
        progress: Math.round((step / 11) * 100),
        step,
        message,
        ...(data && { data }),
        ...(warnings && { warnings }),
        updatedAt: new Date().toISOString()
      };

      jobProgress.set(job.id, progressInfo);

      // Update job progress in BullMQ
      job.updateProgress(progressInfo);
    };

    try {
      // Generate video
      const result = await generateVideo({
        script,
        musicBuffer: musicBuffer ? Buffer.from(musicBuffer) : null,
        musicFileName,
        musicVolume,
        quality,
        addTVOverlay,
        overlayOpacity,
        generateThumbnail,
        thumbnailMode,
        onProgress
      });

      // Update final status
      jobProgress.set(job.id, {
        jobId: job.id,
        status: 'completed',
        progress: 100,
        step: 11,
        message: 'Video generation complete',
        completedAt: new Date().toISOString()
      });

      return result;

    } catch (error) {
      // Update error status
      jobProgress.set(job.id, {
        jobId: job.id,
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString()
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '1'), // Process 1 video at a time by default
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000 // per 60 seconds
    }
  }
);

// Worker event handlers
videoWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

videoWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

videoWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Video generation worker started');
