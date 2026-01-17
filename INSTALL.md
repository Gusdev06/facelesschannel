# 🚀 Guia de Instalação Rápida

## Passo 1: Pré-requisitos

### Instalar Node.js
- **macOS/Linux**: Use [nvm](https://github.com/nvm-sh/nvm)
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  nvm install 18
  nvm use 18
  ```

- **Windows**: Download de https://nodejs.org/

### Instalar FFmpeg

- **macOS**:
  ```bash
  brew install ffmpeg
  ```

- **Ubuntu/Debian**:
  ```bash
  sudo apt update
  sudo apt install ffmpeg
  ```

- **Windows**:
  1. Download: https://www.gyan.dev/ffmpeg/builds/
  2. Extraia para `C:\ffmpeg`
  3. Adicione `C:\ffmpeg\bin` ao PATH do sistema

### Verificar instalações
```bash
node --version   # Deve mostrar v18.x.x ou superior
npm --version    # Deve mostrar 9.x.x ou superior
ffmpeg -version  # Deve mostrar versão do FFmpeg
```

## Passo 2: Obter API Keys

### OpenAI API Key
1. Acesse https://platform.openai.com/api-keys
2. Faça login ou crie uma conta
3. Clique em "Create new secret key"
4. Copie a chave (começa com `sk-...`)
5. **IMPORTANTE**: Adicione créditos na sua conta (mínimo $5)

### Replicate API Key
1. Acesse https://replicate.com/account/api-tokens
2. Faça login com GitHub ou email
3. Copie o token (começa com `r8_...`)
4. **IMPORTANTE**: Adicione créditos na sua conta

## Passo 3: Configurar Projeto

```bash
# 1. Navegue até a pasta do projeto
cd facelesschannel

# 2. Instale as dependências
npm install

# 3. Crie arquivo .env
cp .env.example .env

# 4. Edite o .env e adicione suas chaves
# No macOS/Linux:
nano .env

# No Windows:
notepad .env
```

Conteúdo do `.env`:
```env
OPENAI_API_KEY=sk-suachaveaqui
REPLICATE_API_KEY=r8_suachaveaqui
```

Salve e feche o arquivo.

## Passo 4: Adicionar Música de Fundo (Opcional)

```bash
# Copie seu arquivo de música para a pasta assets
cp /caminho/para/sua/musica.mp3 assets/background-music.mp3
```

**Dicas de música:**
- Use música sem copyright (YouTube Audio Library, Epidemic Sound, etc.)
- Formato: MP3
- Duração: Pode ser menor que o vídeo (fará loop automático)
- Recomendado: Música instrumental e ambiente

## Passo 5: Teste Rápido

```bash
# Execute o sistema
npm start
```

Quando solicitado:
1. **Script**: Pressione Enter e cole o texto de exemplo abaixo
2. **Voice**: Escolha "Onyx"
3. **Background music**: "No" (para primeiro teste)
4. **Quality**: "fast" (renderização rápida)

**Texto de exemplo:**
```
Hoje vamos falar sobre três fatos fascinantes da ciência. Primeiro, você sabia que o oceano cobre mais de setenta por cento da superfície da Terra? Isso significa que ainda há muito a ser explorado nas profundezas marinhas. Segundo, o corpo humano possui mais de 37 trilhões de células trabalhando juntas a cada segundo. E terceiro, a luz do Sol leva cerca de oito minutos para chegar até nós aqui na Terra.
```

## Passo 6: Aguarde o Processamento

O sistema irá:
1. ✅ Validar ambiente
2. 🎨 Gerar prompts de imagens (30s - 1min)
3. 🖼️ Gerar imagens com IA (2-5min dependendo da quantidade)
4. 🎙️ Gerar narração TTS (30s - 1min)
5. 📝 Criar legendas (5s)
6. 🎬 Compilar vídeo final (1-3min)

**Tempo total estimado**: 5-10 minutos para um vídeo de 1-2 minutos

## Passo 7: Localizar Vídeo Final

Seu vídeo estará em:
```
output/videos/video_[timestamp].mp4
```

Abra e assista!

## ❌ Problemas Comuns

### "OPENAI_API_KEY not found"
- Verifique se o arquivo `.env` existe na raiz do projeto
- Verifique se não há espaços extras na chave
- Certifique-se de que salvou o arquivo

### "FFmpeg not found"
- Execute `ffmpeg -version` para verificar instalação
- No Windows, verifique se FFmpeg está no PATH
- Reinicie o terminal após instalar

### "Rate limit exceeded" ou "Insufficient credits"
- Adicione créditos na sua conta OpenAI/Replicate
- Aguarde alguns minutos se atingiu limite de taxa
- Verifique seu saldo em https://platform.openai.com/usage

### Imagens demorando muito
- Replicate pode ter fila dependendo da hora
- Reduza o número de imagens usando script mais curto
- Tente novamente em horário diferente

### Vídeo não compila
- Verifique se todas as imagens foram geradas
- Veja logs de erro detalhados
- Verifique espaço em disco

## 📞 Próximos Passos

Agora que o sistema está funcionando:

1. **Crie seus próprios scripts** em `scripts/meu-roteiro.txt`
2. **Experimente diferentes vozes** (Alloy, Echo, Fable, Nova, Shimmer)
3. **Adicione música de fundo** para vídeos mais profissionais
4. **Ajuste a qualidade** (use "slow" para máxima qualidade)
5. **Teste scripts mais longos** (3-5 minutos)

## 🎯 Dicas para Melhores Resultados

- ✅ Scripts bem pontuados geram melhores pausas na narração
- ✅ Scripts de 150-450 palavras funcionam melhor (1-3 min)
- ✅ Use parágrafos para separar ideias claramente
- ✅ Evite siglas sem explicação
- ✅ Música ambiente funciona melhor que música com letra
- ✅ Volume de música entre 10-20% é ideal

## 🎓 Recursos Úteis

- [OpenAI TTS Voices](https://platform.openai.com/docs/guides/text-to-speech)
- [Replicate Flux Model](https://replicate.com/black-forest-labs/flux-1.1-pro)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Música sem Copyright - YouTube Audio Library](https://studio.youtube.com/channel/UC.../music)

---

**Parabéns! Seu sistema de geração de vídeos está pronto para uso! 🎉**
