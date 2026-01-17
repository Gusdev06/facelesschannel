import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;

// Modelo Flux Schnell para geração de imagens
const FLUX_MODEL = 'black-forest-labs/flux-schnell';
const REPLICATE_PREDICTIONS_URL = `https://api.replicate.com/v1/models/bytedance/seedream-4/predictions`;
const REPLICATE_STATUS_URL = 'https://api.replicate.com/v1/predictions';

/**
 * Inicia uma predição no Replicate
 * @param {string} prompt - Prompt da imagem
 * @param {object} options - Opções adicionais
 * @returns {Promise<object>} Resposta da API
 */
async function createPrediction(prompt, options = {}) {
  const {
    width = 1920,
    height = 1080,
    aspectRatio = '16:9',
    outputFormat = 'jpg',
    outputQuality = 90,
    safetyTolerance = 2
  } = options;

  if (!REPLICATE_API_KEY) {
    throw new Error('REPLICATE_API_KEY not found in environment variables');
  }

  try {
    const response = await fetch(REPLICATE_PREDICTIONS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          output_format: outputFormat,
          output_quality: outputQuality,
          safety_tolerance: safetyTolerance,
          prompt_upsampling: false
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Replicate API error:', errorData);
      throw new Error(`Replicate API error: ${errorData.detail || 'Unknown error'}`);
    }

    return await response.json();

  } catch (error) {
    console.error('❌ Request error:', error.message);
    throw error;
  }
}

/**
 * Verifica o status de uma predição
 * @param {string} statusUrl - URL para verificar o status (vem da resposta da criação)
 * @returns {Promise<object>} Status da predição
 */
async function getPredictionStatus(statusUrl) {
  if (!REPLICATE_API_KEY) {
    throw new Error('REPLICATE_API_KEY not found in environment variables');
  }

  try {
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Replicate status check error:', errorData);
      throw new Error(`Status check error: ${response.statusText}`);
    }

    return await response.json();

  } catch (error) {
    console.error('❌ Request error:', error.message);
    throw error;
  }
}

/**
 * Aguarda conclusão da predição (polling)
 * @param {string} statusUrl - URL para verificar o status (vem de urls.get)
 * @param {number} maxAttempts - Máximo de tentativas
 * @param {number} interval - Intervalo entre tentativas (ms)
 * @returns {Promise<object>} Predição completa
 */
async function waitForPrediction(statusUrl, maxAttempts = 60, interval = 2000) {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const prediction = await getPredictionStatus(statusUrl);

    if (prediction.status === 'succeeded') {
      return prediction;
    }

    if (prediction.status === 'failed') {
      throw new Error(`Prediction failed: ${prediction.error}`);
    }

    if (prediction.status === 'canceled') {
      throw new Error('Prediction was canceled');
    }

    // Status: starting, processing
    await new Promise(resolve => setTimeout(resolve, interval));
    attempts++;
  }

  throw new Error('Prediction timeout: max attempts reached');
}

/**
 * Baixa imagem de uma URL
 * @param {string} imageUrl - URL da imagem
 * @param {string} outputPath - Caminho de saída
 * @returns {Promise<string>} Caminho do arquivo salvo
 */
async function downloadImage(imageUrl, outputPath, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (!imageUrl) {
        throw new Error('Image URL is undefined or null');
      }

      if (attempt > 0) {
        console.log(`   🔄 Download retry ${attempt}/${retries - 1} after 3s...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      console.log(`   📥 Downloading from: ${imageUrl}`);

      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Downloaded image is empty');
      }

      await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
      console.log(`   💾 Saved to: ${outputPath}`);
      return outputPath;

    } catch (error) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        url: imageUrl
      };

      // If it's the last attempt, throw the error
      if (attempt === retries - 1) {
        console.error('❌ Image download error (final attempt):', errorDetails);
        throw new Error(`Failed to download image: ${error.message} (URL: ${imageUrl})`);
      }

      console.error(`❌ Image download error (attempt ${attempt + 1}):`, errorDetails);
    }
  }
}

/**
 * Gera uma imagem usando Replicate (processo completo)
 * @param {string} prompt - Prompt da imagem
 * @param {string} outputPath - Caminho de saída
 * @param {object} options - Opções de geração
 * @returns {Promise<string>} Caminho da imagem gerada
 */
export async function generateImage(prompt, outputPath, options = {}) {
  try {
    // Inicia predição
    console.log(`   Starting prediction for: ${path.basename(outputPath)}`);
    console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
    const prediction = await createPrediction(prompt, options);
    console.log(`   🆔 Prediction ID: ${prediction.id}`);
    console.log(`   🔗 Status URL: ${prediction.urls.get}`);

    // Aguarda conclusão usando a URL retornada pela API
    const completed = await waitForPrediction(prediction.urls.get);
    console.log(`   ✅ Prediction completed with status: ${completed.status}`);

    // Debug: mostra o output completo
    console.log(`   📤 Output type: ${typeof completed.output}`);
    console.log(`   📤 Output:`, completed.output);

    // Baixa imagem
    const imageUrl = Array.isArray(completed.output) ? completed.output[0] : completed.output;

    if (!imageUrl) {
      throw new Error('No image URL returned from Replicate API');
    }

    await downloadImage(imageUrl, outputPath);

    console.log(`   ✅ Generated: ${path.basename(outputPath)}`);
    return outputPath;

  } catch (error) {
    console.error(`   ❌ Failed to generate ${path.basename(outputPath)}:`, error.message);
    throw error;
  }
}

/**
 * Gera múltiplas imagens em batch com retry e rate limiting
 * @param {Array} prompts - Array de objetos com prompt e caminho
 * @param {object} options - Opções de geração
 * @param {number} concurrency - Número de gerações simultâneas
 * @param {number} delayBetweenRequests - Delay em ms entre requisições
 * @param {number} maxRetries - Número máximo de tentativas
 * @returns {Promise<Array>} Array de caminhos das imagens geradas
 */
export async function generateImagesInBatch(prompts, options = {}, concurrency = 1, delayBetweenRequests = 12000, maxRetries = 3) {
  console.log(`\n🎨 Generating ${prompts.length} images with Replicate...`);
  console.log(`   Concurrency: ${concurrency} images at a time`);
  console.log(`   Delay between requests: ${delayBetweenRequests / 1000}s`);
  console.log(`   Max retries per image: ${maxRetries}`);

  const results = [];
  const errors = [];

  for (let i = 0; i < prompts.length; i += concurrency) {
    const batch = prompts.slice(i, i + concurrency);

    console.log(`\n📦 Batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(prompts.length / concurrency)}`);

    const batchPromises = batch.map(async (item) => {
      let lastError = null;

      // Retry logic with exponential backoff
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const retryDelay = Math.min(30000, delayBetweenRequests * Math.pow(2, attempt - 1));
            console.log(`   🔄 Retry ${attempt}/${maxRetries} for ${path.basename(item.outputPath)} (waiting ${retryDelay / 1000}s)...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }

          const imagePath = await generateImage(item.prompt, item.outputPath, options);
          return { success: true, path: imagePath, prompt: item };
        } catch (error) {
          lastError = error;

          // Check if it's a rate limit error
          if (error.message.includes('throttled') || error.message.includes('rate limit')) {
            // Extract retry_after from error message if available
            const retryMatch = error.message.match(/resets in ~(\d+)s/);
            if (retryMatch && attempt < maxRetries) {
              const retryAfter = parseInt(retryMatch[1]) * 1000;
              console.log(`   ⏳ Rate limited. Waiting ${retryAfter / 1000}s before retry...`);
              await new Promise(resolve => setTimeout(resolve, retryAfter + 1000));
              continue;
            }
          }

          // If not a rate limit error or max retries reached, break
          if (attempt === maxRetries) {
            break;
          }
        }
      }

      // All retries failed
      errors.push({ prompt: item, error: lastError.message });
      return { success: false, prompt: item, error: lastError.message };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Delay between batches to respect rate limits
    if (i + concurrency < prompts.length) {
      console.log(`   ⏳ Waiting ${delayBetweenRequests / 1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`\n✅ Image generation complete: ${successCount}/${prompts.length} successful`);

  if (errors.length > 0) {
    console.warn(`⚠️  ${errors.length} images failed to generate`);
  }

  return results;
}
