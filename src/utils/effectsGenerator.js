/**
 * Tipos de efeitos Ken Burns disponíveis
 */
export const EFFECT_TYPES = {
  ZOOM_IN: 'zoom_in',
  ZOOM_OUT: 'zoom_out'
};

/**
 * Gera efeito Ken Burns (zoom/pan) para uma imagem
 * @param {number} index - Índice da imagem
 * @param {number} duration - Duração em segundos
 * @param {number} imageWidth - Largura da imagem
 * @param {number} imageHeight - Altura da imagem
 * @returns {object} Configuração do efeito
 */
export function generateKenBurnsEffect(index, duration, imageWidth = 1920, imageHeight = 1080) {
  const effects = Object.values(EFFECT_TYPES);
  const effect = effects[index % effects.length];

  const fps = 30;
  const totalFrames = Math.floor(duration * fps);

  let filterExpression = '';

  switch(effect) {
    case EFFECT_TYPES.ZOOM_IN:
      // Zoom in contínuo: começa em 1.0 e termina em 1.3 de forma linear
      filterExpression = `scale=w=${imageWidth}*1.3:h=${imageHeight}*1.3,` +
        `zoompan=z='1.0+0.3*on/${totalFrames}':d=${totalFrames}:` +
        `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${imageWidth}x${imageHeight}:fps=${fps}`;
      break;

    case EFFECT_TYPES.ZOOM_OUT:
      // Zoom out contínuo: começa em 1.3 e termina em 1.0 de forma linear
      filterExpression = `scale=w=${imageWidth}*1.3:h=${imageHeight}*1.3,` +
        `zoompan=z='1.3-0.3*on/${totalFrames}':d=${totalFrames}:` +
        `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${imageWidth}x${imageHeight}:fps=${fps}`;
      break;

    default:
      filterExpression = `scale=${imageWidth}:${imageHeight}`;
  }

  return {
    effect,
    filter: filterExpression,
    duration,
    index
  };
}

/**
 * Tipos de transições disponíveis
 */
export const TRANSITION_TYPES = [
  'fade'
];

/**
 * Gera filtros de transição entre imagens
 * @param {Array<string>} imagePaths - Array de caminhos das imagens
 * @param {Array<number>} durations - Array de durações para cada imagem
 * @param {number} transitionDuration - Duração da transição em segundos
 * @returns {Array<string>} Array de filtros FFmpeg
 */
export function generateTransitionFilter(imagePaths, durations, transitionDuration = 0.5) {
  const filters = [];
  let offset = 0;

  imagePaths.forEach((path, i) => {
    const duration = durations[i];
    const effect = generateKenBurnsEffect(i, duration);

    // Aplica efeito Ken Burns em cada imagem
    filters.push(`[${i}:v]${effect.filter},setpts=PTS-STARTPTS,format=yuva444p[v${i}]`);

    if (i > 0) {
      // Define tipo de transição (cicla entre os tipos disponíveis)
      const transition = TRANSITION_TYPES[i % TRANSITION_TYPES.length];

      // Aplica transição entre imagem anterior e atual
      const prevStream = i === 1 ? 'v0' : `t${i-1}`;
      filters.push(
        `[${prevStream}][v${i}]xfade=transition=${transition}:` +
        `duration=${transitionDuration}:offset=${offset - transitionDuration}[t${i}]`
      );
    }

    offset += duration - transitionDuration;
  });

  return filters;
}

/**
 * Calcula offset de tempo para cada transição
 * @param {Array<number>} durations - Durações de cada imagem
 * @param {number} transitionDuration - Duração da transição
 * @returns {Array<number>} Array de offsets
 */
export function calculateTransitionOffsets(durations, transitionDuration) {
  const offsets = [0];
  let cumulative = 0;

  for (let i = 1; i < durations.length; i++) {
    cumulative += durations[i - 1] - transitionDuration;
    offsets.push(cumulative);
  }

  return offsets;
}

/**
 * Gera filtro de film grain (efeito vintage com ruído e piscadas)
 * @param {object} options - Opções do efeito
 * @param {number} options.grainStrength - Intensidade do grain (0-100, padrão: 15)
 * @param {number} options.flickerIntensity - Intensidade das piscadas (0-30, padrão: 8)
 * @returns {string} Filtro FFmpeg para film grain
 */
export function generateFilmGrainFilter(options = {}) {
  const {
    grainStrength = 15,
    flickerIntensity = 8
  } = options;

  // Combina múltiplos efeitos para criar o visual de filme antigo:
  // 1. noise: adiciona grain/ruído para simular filme analógico
  // 2. geq: adiciona piscadas/flicker aleatórios usando expressões matemáticas
  //    - random(0): gera valores aleatórios
  //    - Aplica variação temporal na luminosidade
  const filters = [
    // Adiciona grain/ruído em cada frame
    `noise=alls=${grainStrength}:allf=t+u`,
    // Adiciona piscadas aleatórias (flicker effect)
    `geq=lum='lum(X,Y)*(1-${flickerIntensity/100}*random(0)/255)':cb='cb(X,Y)':cr='cr(X,Y)'`
  ];

  return filters.join(',');
}
