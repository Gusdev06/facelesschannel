# Como Usar Música de Fundo

## Visão Geral

O sistema agora suporta música de fundo com **loop automático**. Se o vídeo tiver 20 minutos e a música tiver 6 minutos, a música será repetida automaticamente até o final do vídeo.

## Opções de Música

### 1. Usar Música Padrão (da pasta assets)

Para usar a música padrão que está em `assets/background_music.mp3`:

```bash
curl -X POST http://localhost:3000/api/videos \
  -F "script=Seu texto aqui..." \
  -F "useDefaultMusic=true" \
  -F "musicVolume=0.15"
```

**Vantagens:**
- Não precisa fazer upload de arquivo
- Mais rápido
- Música já otimizada (6 minutos)
- Loop automático

### 2. Enviar Música Customizada

Se preferir usar sua própria música:

```bash
curl -X POST http://localhost:3000/api/videos \
  -F "script=Seu texto aqui..." \
  -F "musicFile=@/caminho/para/sua/musica.mp3" \
  -F "musicVolume=0.15"
```

### 3. Sem Música

Para criar vídeo sem música de fundo:

```bash
curl -X POST http://localhost:3000/api/videos \
  -F "script=Seu texto aqui..."
```

## Parâmetros de Música

- **useDefaultMusic**: `true` ou `false` (padrão: `false`)
  - Use a música padrão de `assets/background_music.mp3`

- **musicFile**: Arquivo de áudio (MP3/WAV)
  - Envie sua própria música customizada

- **musicVolume**: `0.0` a `1.0` (padrão: `0.15`)
  - Volume da música de fundo
  - `0.15` = 15% do volume original
  - `0.3` = 30% do volume original
  - `1.0` = 100% do volume original

## Como o Loop Funciona

O sistema usa FFmpeg para fazer loop da música automaticamente:

```
[Vídeo: 20 minutos]
[Música: 6 min] → [Música: 6 min] → [Música: 6 min] → [Música: 2 min]
```

A música será repetida quantas vezes for necessário para cobrir toda a duração do vídeo.

## Exemplo Completo

```bash
# Com música padrão
curl -X POST http://localhost:3000/api/videos \
  -F "script=Era uma vez em um reino distante..." \
  -F "useDefaultMusic=true" \
  -F "musicVolume=0.2" \
  -F "quality=medium" \
  -F "addTVOverlay=true" \
  -F "generateThumbnail=true"
```

## Informações Técnicas

- **Música Padrão**: `assets/background_music.mp3` (6 minutos)
- **Loop Automático**: Usando FFmpeg `aloop=loop=-1:size=2e+09`
- **Mixagem**: A narração tem prioridade sobre a música
- **Formato**: Suporta MP3, WAV, M4A
