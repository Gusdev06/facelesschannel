import axios from 'axios';
import dotenv from 'dotenv';
import { cleanJsonResponse } from '../utils/jsonCleaner.js';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = 'gUABw7pXQjhjt0kNFBTF';

/**
 * System prompt para geração de prompts de imagens
 */
const SYSTEM_PROMPT = `You are an expert in creating image prompts for videos. Your task: generate prompts that represent EXACTLY the narrated content.

MAIN RULE: Each image MUST literally show what is being said in the script at that moment.

EXAMPLES:
- Script: "Bermuda Triangle in the Atlantic Ocean" → Image: dark and turbulent ocean
- Script: "forest with circular clearing" → Image: dense forest with empty circle in the center
- Script: "compass going crazy" → Image: compass with spinning pointer
- Script: "scientist examining" → Image: figure from behind analyzing something

MANDATORY STYLE: Old Classical Painting with Dark Contemporary Art

CRITICAL: EVERY SINGLE IMAGE MUST BE IN OLD PAINTING STYLE - NO EXCEPTIONS!

Style characteristics:
- Old master painting style, classical oil painting technique, Renaissance/Baroque art style
- Painted with traditional painting aesthetic, brushstroke texture visible
- Dark tones: black, deep blue, dark purple, charcoal, midnight tones, shadowy atmosphere
- Mood: dark, moody, mysterious, ominous, eerie, haunting, unsettling
- Lighting: chiaroscuro technique, dramatic shadows, low-key lighting, darkness prevails
- Textures: oil painting texture, canvas grain, classical painting brushwork
- When people appear: painted figures in old master style, dark Renaissance portraits, faces obscured or shadowed, classical portrait composition
- When landscapes/objects appear: STILL painted in old master style, like classical landscape paintings, still life paintings, or historical artwork

PROMPT STRUCTURE (MANDATORY FOR ALL IMAGES):

[LITERAL SUBJECT FROM SCRIPT], painted in old master painting style, classical oil painting technique, [dark colors], chiaroscuro lighting, dark Renaissance aesthetic, moody and mysterious atmosphere, canvas texture, brushstroke visible, ancient painting style, no text, no words, no letters

COMPLETE EXAMPLES:

Script: "Bermuda Triangle"
Prompt: "Dark turbulent ocean waters in triangular formation, painted in old master painting style, classical oil painting technique, deep navy blue and black tones, chiaroscuro lighting, dark Renaissance aesthetic, ominous storm clouds painted with dramatic brushstrokes, moody and mysterious atmosphere, canvas texture, brushstroke visible, ancient seascape painting style, no text, no words, no letters"

Script: "Oregon Vortex with inverted gravity"
Prompt: "Tilted building structure with warped perspective and objects defying gravity, painted in old master painting style, classical oil painting technique, charcoal grays and deep purples, chiaroscuro lighting, dark Renaissance aesthetic, eerie and unsettling atmosphere, dramatic painted shadows, canvas texture, brushstroke visible, ancient painting style, no text, no words, no letters"

Script: "Hoia Baciu Forest with circular clearing"
Prompt: "Dense dark forest with perfectly circular clearing in center where nothing grows, painted in old master painting style, classical oil painting technique, deep forest greens and black shadows, chiaroscuro lighting, dark Renaissance aesthetic, haunting atmosphere with fog rolling through painted trees, moody and mysterious, canvas texture, brushstroke visible, ancient landscape painting style, no text, no words, no letters"

Script: "Scientist analyzing anomalies"
Prompt: "Figure of scientist from behind examining mysterious glowing anomaly, painted in old master painting style, classical oil painting technique, black and deep blue tones, chiaroscuro lighting, dark Renaissance aesthetic, mysterious and scientific atmosphere, dramatic contrast lighting, face obscured in shadow, classical portrait composition, canvas texture, brushstroke visible, ancient painting style, no text, no words, no letters"

Script: "Ancient explorer holding artifact"
Prompt: "Explorer figure holding mysterious artifact, painted in old master painting style, classical oil painting technique, charcoal and sepia tones, chiaroscuro lighting, dark Renaissance aesthetic, deep shadows obscuring facial features, moody and mysterious atmosphere, classical portrait composition, canvas texture, brushstroke visible, ancient painting style, no text, no words, no letters"

RULES:

✓ ALWAYS describe literally what the script mentions
✓ ALWAYS use "painted in old master painting style, classical oil painting technique" - MANDATORY FOR EVERY SINGLE IMAGE
✓ ALWAYS use "chiaroscuro lighting, dark Renaissance aesthetic" - MANDATORY FOR EVERY SINGLE IMAGE
✓ ALWAYS use dark colors (black, deep blue, dark purple, charcoal, etc)
✓ ALWAYS add "moody and mysterious atmosphere"
✓ ALWAYS add "canvas texture, brushstroke visible, ancient painting style" - MANDATORY FOR EVERY SINGLE IMAGE
✓ ALWAYS end with "no text, no words, no letters"
✓ For people: "painted in old master style", "faces obscured in shadow", "classical portrait composition"
✓ For landscapes/objects: "classical landscape painting style", "ancient seascape painting", "still life painting style"
✓ EVERYTHING must look like a painting from 1500-1800s era with dark atmosphere
✗ NEVER use: "contemporary", "modern", "digital art", "cinematic", "photorealistic", "8k", "high quality"
✗ NEVER create generic images - be specific to the script content
✗ NEVER forget the old painting style - IT IS MANDATORY FOR 100% OF IMAGES

IMAGE QUANTITY:
- 1 min: 5-8 images
- 2 min: 8-12 images
- 3 min: 12-18 images
- 4+ min: 18-25 images

OUTPUT FORMAT (JSON only, no markdown):

{
  "total_images": <number>,
  "image_prompts": [
    {
      "prompt": "Literal description of content, contemporary dark art style, dark colors, moody atmosphere, no text, no words, no letters",
      "image": "image_1",
      "segment": "Short summary of what the script talks about (10-15 words)",
      "start_word": 0,
      "end_word": 30
    }
  ]
}`;

/**
 * Gera prompts de imagens a partir de um script usando OpenAI
 * @param {string} script - Script limpo
 * @param {string} model - Modelo OpenAI a usar
 * @returns {Promise<object>} Objeto com prompts de imagens
 */
export async function generateImagePrompts(script, model = 'gpt-4.1') {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }

  console.log('\n🤖 Generating image prompts with OpenAI...');
  console.log(`   Model: ${model}`);
  console.log(`   Script length: ${script.length} characters`);

  const userPrompt = `Here is the complete video script:\n\n${script}\n\nGenerate the image prompts following all the rules above.`;

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const rawContent = response.data.choices[0].message.content;
    console.log('\n✅ OpenAI response received');

    // Limpa e valida JSON
    const promptsData = cleanJsonResponse(rawContent);

    console.log(`   Total images to generate: ${promptsData.total_images}`);

    return promptsData;

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
 * Gera áudio TTS usando ElevenLabs
 * @param {string} text - Texto para converter em áudio
 * @param {string} outputPath - Caminho do arquivo de saída
 * @param {object} options - Opções de TTS (mantido para compatibilidade, mas não usado)
 * @returns {Promise<string>} Caminho do arquivo gerado
 */
export async function generateTTS(text, outputPath, options = {}) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not found in environment variables');
  }

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?optimize_streaming_latency=0`,
      {
        text: text,
        model_id: 'eleven_multilingual_v2'
      },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, Buffer.from(response.data));

    return outputPath;

  } catch (error) {
    if (error.response) {
      console.error('❌ ElevenLabs TTS error:', error.response.data);
      throw new Error(`ElevenLabs TTS error: ${error.response.statusText}`);
    } else {
      console.error('❌ Request error:', error.message);
      throw error;
    }
  }
}
