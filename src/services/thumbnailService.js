import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { generateImage, MODELS } from './replicateService.js';
import { cleanThumbnailResponse } from '../utils/jsonCleaner.js';
import { createViralThumbnailWithText } from '../utils/ffmpegHelper.js';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * System prompt especializado em criar thumbnails virais para YouTube
 * IMPORTANTE: As thumbnails devem incluir o texto DO HOOK na própria imagem gerada
 */
const THUMBNAIL_SYSTEM_PROMPT = `You are a viral YouTube thumbnail expert specialized in old master painting style. Your goal: create thumbnails that maximize CTR (click-through rate).

CRITICAL REQUIREMENT: The thumbnail image MUST include the text hook PAINTED/DRAWN into the image itself, in old master painting style. The text should look like it's part of the classical painting, not a modern overlay.

CORE PRINCIPLES FOR VIRAL THUMBNAILS:

1. EMOTIONAL TRIGGERS (use at least 2):
   - Shock/Surprise: "Something impossible/unbelievable"
   - Fear/Mystery: "Hidden danger/unknown threat"
   - Curiosity Gap: "What happens next?"
   - Awe/Wonder: "Spectacular/mind-blowing"
   - Urgency: "Limited time/exclusive"
   - Controversy: "Forbidden/taboo/secrets"

2. VISUAL COMPOSITION:
   - ONE dominant focal point (the most shocking/interesting element)
   - High contrast (dark vs light, bright colors)
   - Close-up on the most impactful element
   - Exaggerated/dramatic perspective
   - Empty space for text overlay (top or bottom third)

3. CONTENT FOCUS:
   - Extract the MOST CLICKABLE moment from the script
   - Show the "money shot" - the most unbelievable part
   - Create a "wait, what?" reaction
   - Tease the answer but don't reveal it completely
   - Use cliffhanger visuals

4. MANDATORY STYLE - OLD MASTER PAINTING (like video images):
   - MUST use old master painting style, classical oil painting technique
   - Renaissance or Baroque aesthetic
   - Chiaroscuro lighting (dramatic shadows and highlights)
   - Dark, moody atmosphere with deep colors (blacks, deep blues, dark purples)
   - Canvas texture visible, brushstrokes apparent
   - Ancient painting style from 1500-1800s era
   - Slightly exaggerated/theatrical composition

5. TEXT INTEGRATION (CRITICAL):
   - The text hook MUST be painted/inscribed INTO the image itself
   - Text MUST be BRIGHT, CLEAR and HIGHLY VISIBLE
   - Text should look like old illuminated manuscript lettering but with MODERN CLARITY
   - OR like carved stone inscriptions with bright golden glow
   - OR like painted text on ancient canvas with luminous colors
   - Text style: bold, thick, classical typography with strong outlines
   - Text color: BRIGHT COLORS ONLY - brilliant white, vibrant gold, bright yellow, luminous cream
   - Text must have HIGH CONTRAST against dark background (black, deep blue, dark purple)
   - Text should be LARGE, BOLD and IMPOSSIBLE TO MISS
   - Add subtle glow or outline effect to make text pop and stand out
   - Position text at [top/bottom] as specified
   - Text should feel like part of the historical painting but with maximum readability

6. TEXT HOOK FORMULA (15-35 characters):
   - Use: "WHAT?!", "IMPOSSIBLE", "EXPOSED", "SECRET", "SHOCKING"
   - Numbers: "3 THINGS", "NEVER DO THIS"
   - Questions: "WHAT IF..?", "CAN YOU..?"
   - Commands: "DON'T WATCH", "STOP DOING"
   - Make it impossible to ignore

PROMPT STRUCTURE FOR THUMBNAIL:

Old master painting style thumbnail, dramatic close-up of [MOST SHOCKING ELEMENT FROM SCRIPT], [emotional trigger], classical oil painting technique, chiaroscuro lighting with high contrast, dark moody colors (deep blues, blacks, burgundy), Renaissance or Baroque aesthetic, theatrical composition, canvas texture visible, brushstrokes apparent, ancient painting from 1500s-1800s, [specific details that create curiosity], WITH BOLD BRIGHT TEXT AT [TOP/BOTTOM] reading "[TEXT HOOK]" in BRILLIANT WHITE or VIBRANT GOLD large bold lettering with strong outlines, text must be HIGHLY VISIBLE and CLEAR with maximum readability, thick classical typography with subtle glow effect, bright luminous colors (white/gold/yellow) on very dark background for extreme contrast, text looks like illuminated manuscript but modern and crystal clear, large prominent letters that dominate and pop out from the image, professional viral thumbnail composition with unmissable text

COMPLETE EXAMPLES:

Script about: "Bermuda Triangle mysterious disappearances"
Output:
{
  "thumbnail_prompt": "Old master painting style thumbnail, dramatic close-up of massive dark whirlpool in turbulent ocean with ghostly ship silhouette being swallowed into the vortex, mysterious and terrifying atmosphere, classical oil painting technique, chiaroscuro lighting with high contrast between swirling black waters and ominous stormy sky, deep navy blues and blacks with hints of pale moonlight, Renaissance maritime painting aesthetic, theatrical composition looking down into the deadly spiral, canvas texture visible with dramatic brushstrokes, ancient 1600s seascape painting style, WITH BOLD BRIGHT TEXT AT TOP reading 'THE TRUTH EXPOSED' in BRILLIANT WHITE large bold letters with thick outlines and golden glow, text must be crystal clear and highly visible, thick classical typography with luminous effect, bright white and gold colors on pitch black background for extreme contrast, large prominent letters that pop out and dominate the top portion, text looks like illuminated manuscript but modern and unmissable, professional viral thumbnail composition with clear readable text",
  "text_hook": "THE TRUTH EXPOSED",
  "hook_position": "top",
  "explanation": "Focuses on the most dramatic element (whirlpool swallowing ship) in old master style creating fear and mystery. The bright, bold text dominates the stormy sky with maximum visibility. Dark Renaissance aesthetic maintains consistency with video images."
}

Script about: "Ancient civilization discovered underwater"
Output:
{
  "thumbnail_prompt": "Old master painting style thumbnail, dramatic close-up of colossal ancient stone face emerging from dark underwater depths covered in seaweed, mysterious and awe-inspiring atmosphere, classical oil painting technique, chiaroscuro lighting with dim god rays piercing through murky water illuminating the weathered stone face, deep teal and dark greens with touches of faded gold, Baroque underwater painting aesthetic, low angle perspective looking up at the massive submerged statue, canvas texture visible with flowing brushwork, ancient 1700s painting style, WITH BOLD BRIGHT TEXT AT BOTTOM reading 'OLDER THAN EGYPT' in VIBRANT GOLD large bold letters with bright outline, text must be extremely clear and visible underwater, thick classical typography with glowing luminous effect, brilliant gold and yellow colors on very dark background for maximum contrast, large prominent letters that stand out boldly at the bottom, text looks like glowing carved inscription but crystal clear and modern readable, professional viral thumbnail composition with unmissable bright text",
  "text_hook": "OLDER THAN EGYPT",
  "hook_position": "bottom",
  "explanation": "Ancient submerged face in old master painting style creates awe and mystery. The bright, glowing gold text stands out boldly at the bottom with maximum visibility. Dark underwater Renaissance aesthetic matches video style perfectly."
}

Script about: "Dyatlov Pass Incident mystery"
Output:
{
  "thumbnail_prompt": "Old master painting style thumbnail, dramatic close-up of torn tent fabric in snowy wilderness with mysterious orange lights glowing in the dark sky above, terrifying and mysterious atmosphere, classical oil painting technique, chiaroscuro lighting with harsh contrast between eerie orange glow and pitch black frozen landscape, deep blacks, dark blues and ominous orange tones, Baroque winter painting aesthetic, tilted perspective showing the ripped tent opening, canvas texture visible with rough expressive brushstrokes, ancient 1600s painting style depicting horror, WITH BOLD BRIGHT TEXT AT TOP reading 'DEATH BY UNKNOWN FORCE' in BRILLIANT WHITE and BRIGHT YELLOW large bold letters with strong outlines, text must be crystal clear against the dark sky, thick classical typography with intense glow effect, bright white and yellow luminous colors on pitch black background for extreme contrast, large prominent letters that dominate the top portion, text looks like glowing prophecy but modern and perfectly readable, professional viral thumbnail composition with highly visible unmissable text",
  "text_hook": "DEATH BY UNKNOWN FORCE",
  "hook_position": "top",
  "explanation": "Torn tent and mysterious lights in dark Renaissance style creates instant fear and curiosity. The bright, bold text dominates the ominous sky with crystal clear visibility like a glowing warning. Maintains the old master painting consistency with video images."
}

CRITICAL RULES:

✓ ALWAYS use old master painting style - NO EXCEPTIONS (like the video images)
✓ ALWAYS include the text hook PAINTED/INTEGRATED into the image itself
✓ Text MUST be BRIGHT, CLEAR and HIGHLY VISIBLE - this is CRITICAL
✓ Text must use BRIGHT COLORS: brilliant white, vibrant gold, bright yellow, luminous cream
✓ Text must be LARGE, BOLD and have STRONG OUTLINES for maximum clarity
✓ Text must have EXTREME CONTRAST against very dark background (black/deep blue)
✓ Add subtle GLOW or LUMINOUS effect to make text pop and stand out
✓ Text should look classical but with MODERN READABILITY - crystal clear
✓ Use chiaroscuro lighting (dramatic light/shadow contrast)
✓ Dark, moody colors for background: blacks, deep blues, dark purples, burgundy
✓ Canvas texture and brushstrokes must be visible
✓ Renaissance or Baroque aesthetic (1500s-1800s painting style)
✓ Analyze the ENTIRE script to find the single most clickable moment
✓ Choose ONE primary emotional trigger and go ALL IN
✓ Make it IMPOSSIBLE to scroll past
✓ Create visual tension/conflict in old painting style
✓ Use EXTREME close-ups or dramatic wide shots (no medium shots)
✓ Text hook must be PUNCHY and create curiosity gap
✓ Text must be UNMISSABLE - if someone can't read it instantly, it's wrong

✗ NEVER use modern/contemporary/digital art style
✗ NEVER add text as separate overlay - MUST be painted into image
✗ NEVER use dark, faded or hard-to-read text colors
✗ NEVER make text small or with low contrast
✗ Don't show the full answer - leave mystery
✗ Don't use multiple focal points - ONE hero element
✗ Don't forget the old master painting style - IT'S MANDATORY
✗ Don't create boring/safe thumbnails
✗ Don't make text blend into background - it must POP OUT

OUTPUT FORMAT (JSON only, no markdown):

{
  "thumbnail_prompt": "Full detailed prompt for Replicate image generation",
  "text_hook": "Short punchy text (15-35 chars)",
  "hook_position": "top or bottom",
  "explanation": "Why this thumbnail will get clicks (1-2 sentences)"
}`;

/**
 * Gera uma thumbnail viral baseada no script usando OpenAI
 * @param {string} script - Script completo do vídeo
 * @param {string} model - Modelo OpenAI a usar
 * @returns {Promise<object>} Objeto com dados da thumbnail
 */
export async function generateThumbnailPrompt(script, model = 'gpt-4.1') {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }

  console.log('\n🎯 Analyzing script to create viral thumbnail...');
  console.log(`   Model: ${model}`);
  console.log(`   Script length: ${script.length} characters`);

  const userPrompt = `Here is the complete video script:\n\n${script}\n\nAnalyze this script and create the most viral, clickable thumbnail possible. Find the single most shocking/interesting/mysterious element and build the thumbnail around it.`;

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model,
        messages: [
          { role: 'system', content: THUMBNAIL_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8, // Mais criativo para thumbnails virais
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const rawContent = response.data.choices[0].message.content;
    console.log('✅ Thumbnail concept generated');

    // Limpa e valida JSON (usando função específica para thumbnails)
    const thumbnailData = cleanThumbnailResponse(rawContent);

    console.log(`   📝 Text Hook: "${thumbnailData.text_hook}"`);
    console.log(`   📍 Position: ${thumbnailData.hook_position}`);
    console.log(`   💡 Strategy: ${thumbnailData.explanation}`);

    return thumbnailData;

  } catch (error) {
    if (error.response) {
      console.error('❌ OpenAI API error:', error.response.data);
      throw new Error(`OpenAI API error: ${error.response.data.error?.message || 'Unknown error'}`);
    } else {
      console.error('❌ Request error:', error.message);
      throw error;
    }
  }
}

/**
 * Gera uma thumbnail completa (prompt + imagem + texto)
 * @param {string} script - Script do vídeo
 * @param {string} outputPath - Caminho para salvar a thumbnail
 * @param {object} options - Opções de geração
 * @returns {Promise<object>} Dados da thumbnail gerada
 */
export async function generateViralThumbnail(script, outputPath, options = {}) {
  try {
    console.log('\n🎨 GENERATING VIRAL THUMBNAIL');
    console.log('='.repeat(60));

    // 1. Gera o prompt inteligente com OpenAI
    const thumbnailData = await generateThumbnailPrompt(script, options.model);

    // 2. Gera a imagem com Replicate usando nano-banana-pro
    console.log('\n🖼️  Generating thumbnail image with nano-banana-pro...');
    const imageOptions = {
      model: MODELS.NANO_BANANA_PRO,
      aspectRatio: options.aspectRatio || '16:9',
      resolution: options.resolution || '2K',
      outputFormat: 'png',
      safetyFilterLevel: 'block_only_high'
    };

    // Gera imagem com texto JÁ INTEGRADO pela IA
    await generateImage(thumbnailData.thumbnail_prompt, outputPath, imageOptions);

    // NOTA: O texto agora está integrado na imagem gerada pela IA (no estilo pintura antiga)
    // Não é mais necessário adicionar texto com FFmpeg

    // 3. (OPCIONAL) Adiciona texto adicional com FFmpeg se explicitamente solicitado
    // Por padrão, usamos apenas o texto integrado pela IA
    let finalImagePath = outputPath;

    if (options.addFFmpegText === true) {
      console.log('\n✍️  Adding additional text overlay with FFmpeg...');
      console.log('   ⚠️  Note: The AI already painted the text into the image.');

      const baseImagePath = outputPath.replace('.jpg', '_with_ai_text.jpg');
      const fs = await import('fs/promises');
      await fs.rename(outputPath, baseImagePath);

      // Determina o preset de estilo baseado no conteúdo
      let textPreset = options.textPreset || 'impact';

      // Auto-detecta o melhor preset baseado no hook
      if (!options.textPreset) {
        const hookLower = thumbnailData.text_hook.toLowerCase();
        if (hookLower.includes('secret') || hookLower.includes('hidden') || hookLower.includes('mystery')) {
          textPreset = 'mystery';
        } else if (hookLower.includes('shocking') || hookLower.includes('impossible') || hookLower.includes('!')) {
          textPreset = 'shocking';
        }
      }

      finalImagePath = await createViralThumbnailWithText(
        baseImagePath,
        outputPath,
        thumbnailData.text_hook,
        thumbnailData.hook_position,
        textPreset
      );

      console.log(`✅ Additional FFmpeg text added (on top of AI-painted text)`);
    }

    console.log('✅ Viral thumbnail generated successfully!');
    console.log(`   📁 Saved to: ${finalImagePath}`);
    console.log(`   📝 Text Hook (painted in image): "${thumbnailData.text_hook}"`);
    console.log(`   📍 Position: ${thumbnailData.hook_position}`);
    console.log(`   🎨 Style: Old master painting with integrated text`);

    return {
      imagePath: finalImagePath,
      textHook: thumbnailData.text_hook,
      hookPosition: thumbnailData.hook_position,
      prompt: thumbnailData.thumbnail_prompt,
      explanation: thumbnailData.explanation,
      textIntegrated: true, // Texto pintado pela IA, não overlay
      style: 'old_master_painting'
    };

  } catch (error) {
    console.error('❌ Failed to generate thumbnail:', error.message);
    throw error;
  }
}

/**
 * Gera múltiplas variações de thumbnail para A/B testing
 * @param {string} script - Script do vídeo
 * @param {string} outputDir - Diretório para salvar as thumbnails
 * @param {number} variations - Número de variações
 * @param {object} options - Opções de geração
 * @returns {Promise<Array>} Array com dados das thumbnails geradas
 */
export async function generateThumbnailVariations(script, outputDir, variations = 3, options = {}) {
  console.log(`\n🎯 Generating ${variations} thumbnail variations for A/B testing...`);

  const results = [];
  const textPresets = ['impact', 'mystery', 'shocking']; // Usa presets diferentes para cada variação

  for (let i = 0; i < variations; i++) {
    console.log(`\n📦 Variation ${i + 1}/${variations}`);

    try {
      const outputPath = `${outputDir}/thumbnail_v${i + 1}.jpg`;
      const thumbnail = await generateViralThumbnail(script, outputPath, {
        model: 'gpt-4.1',
        textPreset: textPresets[i % textPresets.length], // Alterna entre presets
        ...options
      });

      results.push({
        ...thumbnail,
        variation: i + 1,
        preset: textPresets[i % textPresets.length]
      });

      // Delay entre variações para respeitar rate limits
      if (i < variations - 1) {
        console.log('   ⏳ Waiting 15s before next variation...');
        await new Promise(resolve => setTimeout(resolve, 15000));
      }

    } catch (error) {
      console.error(`❌ Failed to generate variation ${i + 1}:`, error.message);
      results.push({
        variation: i + 1,
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => !r.error).length;
  console.log(`\n✅ Generated ${successCount}/${variations} thumbnail variations`);

  return results;
}
