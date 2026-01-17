# 📖 Guia de Uso - Gerador de Vídeos Faceless

## 🚀 Comandos Disponíveis

### 1. Geração Completa (com geração de imagens)
```bash
npm start
```
**Uso:** Quando você quer gerar um vídeo do zero
**Custo:** Usa créditos da API Replicate (imagens) + OpenAI (áudio/whisper)

---

### 2. Reuso de Imagens (economize créditos!)
```bash
npm run reuse
```
**Uso:** Quando você já tem imagens em `output/images` e quer gerar um novo vídeo
**Custo:** Apenas OpenAI (áudio/whisper) - SEM custo de imagens!
**Ideal para:**
- Testar diferentes vozes
- Testar diferentes scripts com as mesmas imagens
- Ajustar música de fundo
- Economizar créditos durante desenvolvimento

---

### 3. Teste de Sincronização
```bash
npm run test-sync
```
**Uso:** Testa se as legendas estão 100% sincronizadas
**Custo:** Mínimo (apenas 1 pequeno áudio de teste)
**Gera:**
- `test-output/test-audio.mp3` - Áudio de teste
- `test-output/test-subtitles.ass` - Legendas sincronizadas

---

## 💡 Fluxo de Trabalho Recomendado

### Primeira vez (geração completa):
```bash
npm start
```
Isso vai gerar imagens e salvar em `output/images/`

### Próximas vezes (economize!):
```bash
npm run reuse
```
Reutiliza as imagens já geradas e cria um novo vídeo

---

## 📁 Estrutura de Pastas

```
output/
├── images/          # Imagens geradas (reutilizáveis!)
├── audio/           # Arquivos de áudio temporários
├── subtitles/       # Legendas .ass geradas
└── videos/          # Vídeos finais

test-output/         # Arquivos de teste
assets/              # Música de fundo, etc
scripts/             # Scripts de exemplo
```

---

## 🎯 Dicas de Economia

### ✅ ECONOMIZE:
- Use `npm run reuse` sempre que possível
- Mantenha as imagens da pasta `output/images/`
- Teste vozes e scripts com as mesmas imagens
- Use `npm run test-sync` para validar antes de gerar vídeo completo

### ❌ EVITE:
- Rodar `npm start` repetidamente
- Deletar a pasta `output/images/` sem necessidade
- Gerar imagens novas para cada teste

---

## 🔧 Variáveis de Ambiente Necessárias

Crie um arquivo `.env` na raiz do projeto:

```env
# Necessário para ambos os modos
OPENAI_API_KEY=sk-...

# Necessário apenas para npm start (geração completa)
REPLICATE_API_KEY=r8_...
```

---

## ⚙️ Como Funciona a Nova Sincronização

### Antes (problema):
- Legendas baseadas em estimativas de duração por palavra
- Sincronização imperfeita
- Atrasos/adiantamentos no karaoke

### Agora (solução):
1. **TTS OpenAI** gera o áudio
2. **Whisper API** extrai timestamps REAIS de cada palavra
3. **Legendas ASS** usam timestamps precisos
4. **Resultado:** 100% sincronizado!

---

## 📊 Exemplo de Uso

```bash
# 1. Gerar vídeo completo pela primeira vez
npm start

# 2. Testar sincronização
npm run test-sync

# 3. Reutilizar imagens com novo script
npm run reuse

# 4. Reutilizar imagens com voz diferente
npm run reuse
```

---

## ❓ Problemas Comuns

### "No images found"
- Rode `npm start` pelo menos uma vez para gerar imagens
- Ou coloque imagens manualmente na pasta `output/images/`

### "OPENAI_API_KEY not found"
- Crie arquivo `.env` com suas chaves de API
- Verifique se o arquivo está na raiz do projeto

### "FFmpeg is required"
- Instale FFmpeg: https://ffmpeg.org/download.html
- macOS: `brew install ffmpeg`
- Windows: Use o instalador oficial

---

## 💰 Estimativa de Custos

### Geração Completa (`npm start`):
- Imagens Replicate: ~$0.10 - $0.50 (dependendo da quantidade)
- TTS OpenAI: ~$0.015 por 1000 caracteres
- Whisper OpenAI: ~$0.006 por minuto de áudio

### Reuso de Imagens (`npm run reuse`):
- Imagens: **$0.00** (reutilizadas!)
- TTS OpenAI: ~$0.015 por 1000 caracteres
- Whisper OpenAI: ~$0.006 por minuto de áudio

**Economia média: 70-90% usando modo reuso!**

---

## 🎬 Pronto para começar!

```bash
# Teste rápido primeiro
npm run test-sync

# Depois gere seu primeiro vídeo
npm start

# E economize nas próximas vezes
npm run reuse
```
