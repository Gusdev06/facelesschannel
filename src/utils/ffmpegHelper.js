import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { generateTransitionFilter, generateFilmGrainFilter } from './effectsGenerator.js';
import { getSubtitleStyleString } from './srtGenerator.js';

/**
 * Obtém a duração de um arquivo de áudio/vídeo
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<number>} Duração em segundos
 */
export function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to get duration: ${err.message}`));
      } else {
        const duration = metadata.format.duration;
        resolve(duration);
      }
    });
  });
}

/**
 * Concatena múltiplos arquivos de áudio em um único arquivo
 * @param {Array<string>} audioPaths - Array de caminhos de áudio
 * @param {string} outputPath - Caminho do arquivo de saída
 * @returns {Promise<string>} Caminho do arquivo concatenado
 */
export async function concatenateAudio(audioPaths, outputPath) {
  console.log('\n🔗 Concatenating audio chunks...');
  console.log(`   Total chunks: ${audioPaths.length}`);

  // Criar arquivo de lista temporário
  const fileListPath = path.join(path.dirname(outputPath), 'filelist.txt');
  const fileList = audioPaths.map(p => `file '${path.resolve(p)}'`).join('\n');
  await fs.writeFile(fileListPath, fileList, 'utf-8');

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(fileListPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('   FFmpeg command:', cmd);
      })
      .on('end', async () => {
        console.log(`✅ Audio concatenated: ${path.basename(outputPath)}`);
        // Limpa arquivo temporário
        await fs.unlink(fileListPath).catch(() => {});
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Concatenation error:', err.message);
        reject(err);
      })
      .run();
  });
}

/**
 * Adiciona música de fundo ao áudio de narração com loop
 * @param {string} narrationPath - Caminho da narração
 * @param {string} musicPath - Caminho da música
 * @param {string} outputPath - Caminho de saída
 * @param {number} volume - Volume da música (0-1)
 * @returns {Promise<string>} Caminho do arquivo mixado
 */
export async function addBackgroundMusic(narrationPath, musicPath, outputPath, volume = 0.15) {
  console.log('\n🎵 Adding background music...');
  console.log(`   Narration: ${path.basename(narrationPath)}`);
  console.log(`   Music: ${path.basename(musicPath)}`);
  console.log(`   Music volume: ${(volume * 100).toFixed(0)}%`);

  // Verifica se arquivo de música existe
  try {
    await fs.access(musicPath);
  } catch {
    console.warn('⚠️  Background music file not found, skipping...');
    // Copia narração para output
    await fs.copyFile(narrationPath, outputPath);
    return outputPath;
  }

  const narrationDuration = await getAudioDuration(narrationPath);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(narrationPath)
      .input(musicPath)
      .complexFilter([
        // Loop da música e ajusta volume
        `[1:a]aloop=loop=-1:size=2e+09,volume=${volume}[bg]`,
        // Mixa narração com música (narração tem prioridade)
        `[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]`
      ])
      .outputOptions([
        '-map [out]',
        '-c:a libmp3lame',
        '-q:a 2'
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('   FFmpeg command:', cmd);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r   Progress: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on('end', () => {
        console.log('\n✅ Background music added');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('\n❌ Music mixing error:', err.message);
        reject(err);
      })
      .run();
  });
}

/**
 * Compila vídeo com imagens, efeitos, transições, legendas e áudio
 * @param {Array<string>} imagePaths - Array de caminhos das imagens
 * @param {string} audioPath - Caminho do áudio final
 * @param {string} srtPath - Caminho do arquivo de legendas
 * @param {string} outputPath - Caminho do vídeo de saída
 * @param {object} options - Opções de compilação
 * @returns {Promise<string>} Caminho do vídeo gerado
 */
export async function compileVideoWithEffects(imagePaths, audioPath, srtPath, outputPath, options = {}) {
  const {
    resolution = '1920:1080',
    fps = 30,
    crf = 22,
    preset = 'medium',
    transitionDuration = 0.5,
    subtitleStyle = {},
    filmGrain = { enabled: true, grainStrength: 15, flickerIntensity: 8 },
    overlayVideoPath = null,
    overlayOpacity = 0.3
  } = options;

  console.log('\n🎬 Compiling final video...');
  console.log(`   Images: ${imagePaths.length}`);
  console.log(`   Resolution: ${resolution}`);
  console.log(`   FPS: ${fps}`);
  console.log(`   Preset: ${preset}`);
  console.log(`   Transition duration: ${transitionDuration}s`);

  // Calcula duração total baseada no áudio
  const totalDuration = await getAudioDuration(audioPath);
  console.log(`   Total duration: ${totalDuration.toFixed(2)}s`);

  // Calcula duração por imagem
  const effectiveDuration = totalDuration + (transitionDuration * (imagePaths.length - 1));
  const durationPerImage = effectiveDuration / imagePaths.length;
  const durations = imagePaths.map(() => durationPerImage);

  console.log(`   Duration per image: ${durationPerImage.toFixed(2)}s`);

  // Gera filtros de transição com efeitos Ken Burns
  const transitionFilters = generateTransitionFilter(imagePaths, durations, transitionDuration);
  const finalVideoStream = imagePaths.length === 1 ? 'v0' : `t${imagePaths.length - 1}`;

  // Adiciona efeito de film grain (se habilitado)
  let currentStream = finalVideoStream;
  if (filmGrain.enabled) {
    const filmGrainFilter = generateFilmGrainFilter({
      grainStrength: filmGrain.grainStrength,
      flickerIntensity: filmGrain.flickerIntensity
    });
    transitionFilters.push(`[${currentStream}]${filmGrainFilter}[grain]`);
    currentStream = 'grain';
    console.log(`   Film grain: enabled (strength: ${filmGrain.grainStrength}, flicker: ${filmGrain.flickerIntensity})`);
  }

  // Adiciona overlay de vídeo de TV antiga (se habilitado)
  let overlayInputIndex = null;
  if (overlayVideoPath) {
    overlayInputIndex = imagePaths.length + 1; // +1 porque o áudio já está no índice imagePaths.length
    // Loop do vídeo de overlay, ajusta para o tamanho correto e aplica opacidade
    transitionFilters.push(
      `[${overlayInputIndex}:v]loop=loop=-1:size=32767,scale=${resolution.replace(':', 'x')},format=rgba,colorchannelmixer=aa=${overlayOpacity}[overlay]`
    );
    // Sobrepõe o vídeo ao stream atual
    transitionFilters.push(`[${currentStream}][overlay]overlay=0:0[tveffect]`);
    currentStream = 'tveffect';
    console.log(`   TV overlay: enabled (opacity: ${(overlayOpacity * 100).toFixed(0)}%)`);
  }

  // Adiciona filtro de legendas
  // Normaliza o caminho do arquivo (substitui \ por / e escapa apóstrofos)
  const normalizedSubPath = srtPath.replace(/\\/g, '/');

  // Detecta se é ASS ou SRT
  const isASS = srtPath.toLowerCase().endsWith('.ass');

  let subtitleFilter;
  if (isASS) {
    // Para ASS, não usa force_style pois o estilo já está no arquivo
    subtitleFilter = `ass=${normalizedSubPath}`;
  } else {
    // Para SRT, usa o estilo customizado
    const subtitleStyleStr = getSubtitleStyleString(subtitleStyle);
    subtitleFilter = `subtitles=${normalizedSubPath}:force_style='${subtitleStyleStr}'`;
  }

  transitionFilters.push(`[${currentStream}]${subtitleFilter}[final]`);

  // Cria comando FFmpeg
  const command = ffmpeg();

  // Adiciona todas as imagens como inputs
  imagePaths.forEach(imgPath => command.input(imgPath));

  // Adiciona áudio
  command.input(audioPath);

  // Adiciona vídeo de overlay (se habilitado)
  if (overlayVideoPath) {
    command.input(overlayVideoPath);
  }

  return new Promise((resolve, reject) => {
    command
      .complexFilter(transitionFilters, 'final')
      .outputOptions([
        // Não precisa mapear [final] novamente, já está mapeado pelo complexFilter
        `-map ${imagePaths.length}:a`,
        '-c:v libx264',

        // OTIMIZAÇÕES PARA VPS: preset ultrafast e threads limitados
        `-preset ultrafast`,
        `-threads 2`,
        `-crf ${crf}`,

        '-pix_fmt yuv420p',
        `-r ${fps}`,
        '-c:a aac',
        '-b:a 128k', // Reduzido de 192k para 128k
        '-movflags +faststart', // Otimiza para streaming
        '-shortest'
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('\n   FFmpeg command started');
        // Descomente para debug: console.log('   Full command:', cmd);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r   Progress: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on('end', () => {
        console.log('\n✅ Video compilation complete!');
        console.log(`   Output: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('\n❌ FFmpeg error:', err.message);
        reject(err);
      })
      .run();
  });
}

/**
 * Valida se FFmpeg está instalado e acessível
 * @returns {Promise<boolean>} True se FFmpeg está disponível
 */
export async function validateFFmpeg() {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err, formats) => {
      if (err) {
        console.error('❌ FFmpeg not found or not properly installed');
        console.error('   Please install FFmpeg: https://ffmpeg.org/download.html');
        resolve(false);
      } else {
        console.log('✅ FFmpeg is available');
        resolve(true);
      }
    });
  });
}

/**
 * Obtém informações sobre um arquivo de mídia
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<object>} Metadados do arquivo
 */
export function getMediaInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to get media info: ${err.message}`));
      } else {
        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
          streams: metadata.streams.map(s => ({
            type: s.codec_type,
            codec: s.codec_name,
            width: s.width,
            height: s.height,
            fps: s.r_frame_rate
          }))
        });
      }
    });
  });
}

/**
 * Adiciona texto viral estilizado em uma thumbnail usando FFmpeg
 * @param {string} inputPath - Caminho da imagem de entrada
 * @param {string} outputPath - Caminho da imagem de saída
 * @param {string} text - Texto a ser adicionado
 * @param {object} options - Opções de estilização
 * @returns {Promise<string>} Caminho da imagem com texto
 */
export async function addTextToThumbnail(inputPath, outputPath, text, options = {}) {
  const {
    position = 'top', // 'top' ou 'bottom'
    fontSize = 120, // Tamanho base da fonte
    fontColor = 'white', // Cor do texto
    borderColor = 'black', // Cor da borda
    borderWidth = 8, // Largura da borda
    shadowX = 4, // Sombra X
    shadowY = 4, // Sombra Y
    shadowColor = 'black@0.7', // Cor da sombra
    font = 'Arial-Bold', // Fonte (precisa estar instalada no sistema)
    maxWidth = 1700, // Largura máxima do texto (para quebra de linha)
    marginY = 100, // Margem vertical
    backgroundColor = null, // Cor de fundo opcional (ex: 'black@0.5' para semi-transparente)
    style = 'impact' // 'impact', 'clean', 'glowing'
  } = options;

  console.log(`\n✍️  Adding text to thumbnail...`);
  console.log(`   Text: "${text}"`);
  console.log(`   Position: ${position}`);
  console.log(`   Style: ${style}`);

  // Escapa caracteres especiais no texto para FFmpeg
  const escapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,');

  // Determina a posição Y baseado em top/bottom
  let yPosition;
  if (position === 'bottom') {
    yPosition = `h-text_h-${marginY}`;
  } else {
    yPosition = marginY;
  }

  // Constrói o filtro drawtext baseado no estilo
  let drawtextFilter;

  if (style === 'impact') {
    // Estilo IMPACT: Texto grande, bold, com borda grossa e sombra
    drawtextFilter = [
      // Sombra (primeiro layer)
      `drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial Bold.ttf:text='${escapedText}':fontcolor=${shadowColor}:fontsize=${fontSize}:x=(w-text_w)/2+${shadowX}:y=${yPosition}+${shadowY}:borderw=0`,
      // Borda preta (segundo layer)
      `drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial Bold.ttf:text='${escapedText}':fontcolor=${fontColor}:fontsize=${fontSize}:x=(w-text_w)/2:y=${yPosition}:borderw=${borderWidth}:bordercolor=${borderColor}`
    ].join(',');
  } else if (style === 'glowing') {
    // Estilo GLOWING: Texto com múltiplas camadas de brilho
    drawtextFilter = [
      // Glow externo (amarelo)
      `drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial Bold.ttf:text='${escapedText}':fontcolor=yellow@0.3:fontsize=${fontSize + 20}:x=(w-text_w)/2:y=${yPosition}:borderw=0`,
      // Borda preta
      `drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial Bold.ttf:text='${escapedText}':fontcolor=${fontColor}:fontsize=${fontSize}:x=(w-text_w)/2:y=${yPosition}:borderw=${borderWidth}:bordercolor=${borderColor}`,
      // Texto branco por cima
      `drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial Bold.ttf:text='${escapedText}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${yPosition}:borderw=2:bordercolor=yellow`
    ].join(',');
  } else {
    // Estilo CLEAN: Texto simples e legível
    drawtextFilter = `drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial Bold.ttf:text='${escapedText}':fontcolor=${fontColor}:fontsize=${fontSize}:x=(w-text_w)/2:y=${yPosition}:borderw=${borderWidth}:bordercolor=${borderColor}:shadowx=${shadowX}:shadowy=${shadowY}:shadowcolor=${shadowColor}`;
  }

  // Se tiver background, adiciona um retângulo antes do texto
  if (backgroundColor) {
    const bgHeight = fontSize * 1.5;
    const bgY = position === 'bottom' ? `h-${bgHeight}-${marginY - 20}` : marginY - 20;
    drawtextFilter = `drawbox=x=0:y=${bgY}:w=iw:h=${bgHeight}:color=${backgroundColor}:t=fill,${drawtextFilter}`;
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilter(drawtextFilter)
      .outputOptions([
        '-q:v 1', // Qualidade máxima para JPEG
        '-frames:v 1' // Apenas um frame (é uma imagem)
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('   FFmpeg text overlay started');
        // Descomente para debug: console.log('   Command:', cmd);
      })
      .on('end', () => {
        console.log(`✅ Text added to thumbnail: ${path.basename(outputPath)}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Text overlay error:', err.message);
        reject(err);
      })
      .run();
  });
}

/**
 * Cria uma thumbnail viral com texto usando presets otimizados
 * @param {string} inputPath - Caminho da imagem de entrada
 * @param {string} outputPath - Caminho da imagem de saída
 * @param {string} text - Texto a ser adicionado
 * @param {string} position - Posição ('top' ou 'bottom')
 * @param {string} preset - Preset de estilo ('impact', 'mystery', 'shocking', 'clean')
 * @returns {Promise<string>} Caminho da imagem final
 */
export async function createViralThumbnailWithText(inputPath, outputPath, text, position = 'top', preset = 'impact') {
  const presets = {
    impact: {
      fontSize: 130,
      fontColor: 'white',
      borderColor: 'black',
      borderWidth: 10,
      shadowX: 5,
      shadowY: 5,
      shadowColor: 'black@0.8',
      style: 'impact',
      marginY: 80
    },
    mystery: {
      fontSize: 120,
      fontColor: 'white',
      borderColor: '#1a0033', // Roxo escuro
      borderWidth: 8,
      shadowX: 4,
      shadowY: 4,
      shadowColor: '#4a0080@0.7', // Roxo médio
      style: 'impact',
      marginY: 100,
      backgroundColor: 'black@0.4'
    },
    shocking: {
      fontSize: 140,
      fontColor: 'yellow',
      borderColor: 'red',
      borderWidth: 12,
      shadowX: 6,
      shadowY: 6,
      shadowColor: 'black@0.9',
      style: 'glowing',
      marginY: 70
    },
    clean: {
      fontSize: 110,
      fontColor: 'white',
      borderColor: 'black',
      borderWidth: 6,
      shadowX: 3,
      shadowY: 3,
      shadowColor: 'black@0.6',
      style: 'clean',
      marginY: 90
    }
  };

  const selectedPreset = presets[preset] || presets.impact;

  console.log(`\n🎨 Creating viral thumbnail with preset: ${preset.toUpperCase()}`);

  return addTextToThumbnail(inputPath, outputPath, text, {
    ...selectedPreset,
    position
  });
}
