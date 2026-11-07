# Matawas Stories Studio 🎬

> Estúdio web profissional para criação e exportação de vídeos narrativos de Anime/Mangá ("What-if" Stories) no formato esteira contínua e proporções cinematográficas do YouTube.

![Status](https://img.shields.io/badge/Status-Produção-success)
![Resolução](https://img.shields.io/badge/Resolução-1080p%20Full%20HD-blue)
![IA](https://img.shields.io/badge/IA-Google%20Gemini%203.8%20%7C%203.1%20Flash%20Image-orange)
![Licença](https://img.shields.io/badge/Licença-MIT-green)

---

## 🌟 Principais Funcionalidades

- **Cartinhas Realistas com Prévia em Tempo Real:** Cada cena do roteiro é editada em um layout fiel de card (620x1040), com atualização instantânea de textos e artes.
- **Geração Paralela com IA (Estilo Google Flow):** Gere múltiplas ilustrações ao mesmo tempo em segundo plano sem travar a interface. Acompanhe a fila por um contador no topo e veja os cards sendo preenchidos conforme ficam prontos.
- **Motor Gemini 3 Integrado:**
  - **Gemini 3.8 Flash (LLM):** Expande roteiros e ideias simples em prompts visuais cinematográficos através do botão *⚡ Aprimorar com Gemini 3.8 Flash*.
  - **Gemini 3.1 Flash Image:** Gera ilustrações no estilo anime moderno em alta definição.
- **Exportação de Vídeo 1080p Full HD Determinística:**
  - Aceleração por hardware via **WebCodecs (`VideoEncoder`)** e empacotamento nativo em **MP4 (`mp4-muxer`)**.
  - **Proteção de Memória (Backpressure):** O uso de RAM fica cravado abaixo de 30 MB mesmo em vídeos com mais de 60 cards.
  - Velocidade 100% constante, sem quedas de frames ou câmeras lentas.
- **Transição Inicial Oficial dos 3 Cards:** Animação sequencial com revelação escalonada (Texto ➔ Imagem com flash) antes do início da esteira contínua.
- **Salvar Direto na Galeria do Celular (iOS / Android):** Integração com a **Web Share API** para download com 1 toque no Rolo de Câmera / Fotos.
- **AutoSave Contínuo em IndexedDB:** Todo o progresso (textos e imagens) é protegido em tempo real no banco local do navegador.
- **Formato Proprietário `.matawa`:** Salve e recarregue projetos completos com assinatura proprietária do estúdio.

---

## 📐 Especificações Técnicas dos Cards e Vídeo

| Elemento | Dimensão / Propriedade | Descrição |
| :--- | :--- | :--- |
| **Resolução do Vídeo** | `1920 x 1080 px` | 16:9 Widescreen a 30 FPS |
| **Moldura do Card** | `620 x 1040 px` | Borda branca 6px, raio de 22px |
| **Slot da Imagem** | `600 x 680 px` | Proporção ~3:4 com preenchimento centralizado |
| **Slot de Texto** | `600 x 330 px` | Fundo escuro fosco, tipografia Montserrat bold |
| **Espaçamento (Gap)** | `25 px` | Distância entre cards na esteira |

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Python 3.8 ou superior (para o servidor local de configuração e arquivos).
- Navegador moderno com suporte a WebCodecs (Google Chrome, Microsoft Edge ou Safari 16.4+).

### Passo a Passo
1. Clone ou baixe o repositório:
   ```bash
   git clone https://github.com/seu-usuario/matawas-stories.git
   cd matawas-stories
   ```

2. Crie e configure o arquivo `.env`:
   ```bash
   cp .env.example .env
   ```
   Abra o arquivo `.env` e insira sua chave gratuita do Google AI Studio:
   ```env
   GEMINI_API_KEY=sua_chave_do_google_ai_studio_aqui
   GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
   GEMINI_LLM_MODEL=gemini-3.8-flash
   PORT=8081
   ```

3. Inicie o servidor:
   ```bash
   python3 servidor.py
   ```

4. Acesse no navegador:
   - **No computador:** `http://localhost:8081`
   - **No celular (mesmo Wi-Fi):** `http://[IP_DA_SUA_MAQUINA]:8081`

---

## 🌐 Publicação no GitHub Pages (Link Oficial)

Para colocar este projeto no ar gratuitamente através do próprio **GitHub Pages** (gerando um link HTTPS oficial `https://SEU_USUARIO.github.io/matawas-stories/`), consulte o passo a passo completo em [DEPLOY.md](DEPLOY.md).

---

## 📁 Estrutura de Arquivos

```text
├── gerador_cards.html    # Interface completa do estúdio (Canvas, WebCodecs, IA e UI)
├── mp4-muxer.min.js      # Biblioteca ultraleve para empacotamento MP4 nativo no navegador
├── servidor.py           # Servidor HTTP local com suporte a .env e API de configuração
├── .env.example          # Exemplo de variáveis de ambiente
├── .gitignore            # Bloqueio de arquivos sensíveis (.env, vídeos temporários)
├── README.md             # Esta documentação
└── DEPLOY.md             # Guia de publicação na nuvem
```

---

## 📄 Licença

Este projeto é distribuído sob a licença **MIT**. Sinta-se livre para utilizar, modificar e publicar.
