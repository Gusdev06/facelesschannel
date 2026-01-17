# ✅ Checklist de Verificação do Sistema

Use este checklist antes de gerar seu primeiro vídeo.

## 📋 Pré-requisitos

- [ ] Node.js v18+ instalado (`node --version`)
- [ ] npm instalado (`npm --version`)
- [ ] FFmpeg instalado (`ffmpeg -version`)
- [ ] Conta OpenAI com créditos
- [ ] Conta Replicate com créditos

## 🔧 Configuração

- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivo `.env` criado
- [ ] `OPENAI_API_KEY` configurada no `.env`
- [ ] `REPLICATE_API_KEY` configurada no `.env`
- [ ] Pastas de output existem (`output/images`, `output/audio`, etc.)

## 📝 Conteúdo

- [ ] Script preparado (mínimo 10 palavras, recomendado 150-750)
- [ ] Script bem pontuado (frases completas)
- [ ] Script dividido em parágrafos claros
- [ ] Música de fundo adicionada em `assets/` (se desejado)

## 🧪 Teste de Validação

Execute este comando para verificar o ambiente:

```bash
npm start
```

Se aparecer:
```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        🎬 GERADOR AUTOMÁTICO DE VÍDEOS FACELESS 🎬        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

🔍 Validating environment...

✅ FFmpeg is available
✅ Environment validation passed
```

**Você está pronto!** ✅

## 🚨 Problemas Comuns

### ❌ "OPENAI_API_KEY not found"

**Solução:**
```bash
# Verifique se .env existe
ls -la .env

# Se não existir, crie:
cp .env.example .env

# Edite e adicione as chaves:
nano .env  # ou notepad .env no Windows
```

### ❌ "FFmpeg not found"

**Solução macOS:**
```bash
brew install ffmpeg
```

**Solução Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install ffmpeg
```

**Solução Windows:**
1. Download: https://www.gyan.dev/ffmpeg/builds/
2. Extrair para `C:\ffmpeg`
3. Adicionar `C:\ffmpeg\bin` ao PATH
4. Reiniciar terminal

### ❌ "Module not found"

**Solução:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### ❌ "Insufficient credits" (OpenAI/Replicate)

**Solução:**
1. OpenAI: https://platform.openai.com/account/billing
2. Replicate: https://replicate.com/account/billing
3. Adicione mínimo $5 em cada conta

### ❌ Imagens não gerando

**Soluções:**
1. Verifique créditos Replicate
2. Verifique conexão de internet
3. Aguarde alguns minutos (pode haver fila)
4. Tente script mais curto (menos imagens)

### ❌ Áudio dessincronizado com legendas

**Soluções:**
1. Sistema calcula automaticamente - normalmente não ocorre
2. Se ocorrer, tente dividir script em frases menores
3. Verifique se não há caracteres especiais no script

### ❌ Vídeo não compila (FFmpeg erro)

**Soluções:**
1. Verifique se todas as imagens foram geradas
2. Verifique espaço em disco disponível
3. Veja logs de erro para detalhes específicos
4. Tente com menos imagens primeiro

## 📊 Estimativa de Recursos

### Para um vídeo de 2 minutos (~300 palavras):

**Tempo de processamento:**
- Geração de prompts: ~30s
- Geração de imagens (10 imagens): ~3-5min
- Geração de áudio TTS: ~30s
- Compilação de vídeo: ~1-2min
- **Total: ~5-8 minutos**

**Custo estimado:**
- OpenAI GPT-4: ~$0.02
- OpenAI TTS: ~$0.06
- Replicate (10 imagens): ~$0.40
- **Total: ~$0.50**

**Requisitos de sistema:**
- Disco: ~500MB livres (temporário)
- RAM: ~2GB
- Internet: Estável (para APIs)

## 🎯 Primeiro Teste Recomendado

Use este script curto para primeiro teste:

```text
A inteligência artificial está transformando o mundo.
Cada dia surgem novas aplicações que facilitam nossa vida.
Desde assistentes virtuais até carros autônomos.
O futuro já chegou e está apenas começando.
```

**Configurações do teste:**
- Voice: Onyx
- Background music: No
- Quality: fast

**Tempo esperado:** ~3-5 minutos
**Custo esperado:** ~$0.25

## ✅ Sistema Validado e Funcionando

Se o teste acima funcionou:

- [ ] Vídeo gerado com sucesso
- [ ] Áudio claro e sincronizado
- [ ] Legendas aparecendo corretamente
- [ ] Transições suaves entre imagens
- [ ] Efeitos de zoom/pan aplicados

**Parabéns! Seu sistema está 100% operacional! 🎉**

Agora você pode:
1. Criar scripts mais longos e elaborados
2. Adicionar música de fundo
3. Experimentar diferentes vozes
4. Ajustar qualidade para "slow" para máxima qualidade
5. Produzir vídeos profissionais para YouTube!

---

## 📚 Recursos Adicionais

- `README.md` - Documentação completa
- `INSTALL.md` - Guia de instalação detalhado
- `QUICK-START.md` - Início rápido em 5 minutos
- `scripts/example-script.txt` - Script de exemplo completo

## 🆘 Suporte

Se após seguir este checklist você ainda tiver problemas:

1. Revise os logs de erro detalhadamente
2. Verifique documentação das APIs (OpenAI, Replicate)
3. Teste cada componente separadamente
4. Verifique versões das dependências

**Boa sorte com seus vídeos! 🚀**
