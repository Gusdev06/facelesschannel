import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Bucket names
const BUCKETS = {
  music: 'music',
  images: 'images',
  videos: 'videos',
  thumbnails: 'thumbnails'
};

/**
 * Upload a file buffer to Supabase Storage
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} fileName - Name for the file
 * @param {string} bucketName - Supabase bucket name
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<{url: string, path: string}>}
 */
export async function uploadToSupabase(fileBuffer, fileName, bucketName, contentType) {
  const filePath = `${Date.now()}-${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: false
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    path: data.path
  };
}

/**
 * Upload a local file to Supabase Storage
 * @param {string} localPath - Path to local file
 * @param {string} bucketName - Supabase bucket name
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<{url: string, path: string}>}
 */
export async function uploadFileToSupabase(localPath, bucketName, contentType) {
  const fileBuffer = await fs.readFile(localPath);
  const fileName = path.basename(localPath);
  return uploadToSupabase(fileBuffer, fileName, bucketName, contentType);
}

/**
 * Upload music file
 */
export async function uploadMusic(fileBuffer, fileName) {
  return uploadToSupabase(fileBuffer, fileName, BUCKETS.music, 'audio/mpeg');
}

/**
 * Upload generated image
 */
export async function uploadImage(localPath) {
  return uploadFileToSupabase(localPath, BUCKETS.images, 'image/jpeg');
}

/**
 * Upload generated video
 */
export async function uploadVideo(localPath) {
  return uploadFileToSupabase(localPath, BUCKETS.videos, 'video/mp4');
}

/**
 * Upload thumbnail
 */
export async function uploadThumbnail(localPath) {
  return uploadFileToSupabase(localPath, BUCKETS.thumbnails, 'image/jpeg');
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFromSupabase(filePath, bucketName) {
  const { error } = await supabase.storage
    .from(bucketName)
    .remove([filePath]);

  if (error) {
    console.error(`Failed to delete ${filePath} from ${bucketName}:`, error.message);
  }
}

/**
 * Upload multiple images from local paths
 */
export async function uploadImages(localPaths) {
  const uploadPromises = localPaths.map(uploadImage);
  return Promise.all(uploadPromises);
}

export { BUCKETS, supabase };
