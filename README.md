# Matawas Stories - Gerador de Cards e Vídeos (Estilo GokuShow / Manga Stories)

Ferramenta para criação de vídeos e quadrinhos estilo esteira contínua horizontal para o YouTube, com as proporções e geometria extraídas do formato oficial.

## 📐 Proporções (Padrão 1080p Full HD)
- **Resolução do Vídeo:** `1920 x 1080 px` (16:9 Widescreen)
- **Tamanho de cada Card:** `620 x 1040 px`
- **Área da Imagem (Superior):** `600 x 680 px` (~1:1.13)
- **Área do Texto (Inferior):** `600 x 330 px` (Fundo escuro `#0d0e11`, tipografia branca em negrito)
- **Espaçamento entre Cards (Gap):** `25 px`

## 🚀 Como Usar

### 1. Pelo Navegador (Recomendado)
Abra o arquivo `gerador_cards.html` no seu navegador ou acesse via servidor local:
```bash
open gerador_cards.html
```
- Faça upload das imagens das cenas e digite os textos da história.
- Pré-visualize a esteira deslizando na tela em tempo real.
- **Salvar / Carregar Projeto (.matawa):** Salva todo o seu trabalho (imagens, textos e ordens) em um arquivo exclusivo com assinatura digital proprietária `.matawa`. Só pode ser aberto pelo próprio Matawas Stories, permitindo continuar a edição de onde parou.
- Exporte imagens individuais em PNG, a faixa panorâmica completa ou gere o vídeo diretamente em 1080p pronto para o YouTube.

### 2. Automação via Python
- `gerar_moldura.py`: Cria o PNG com recorte transparente para usar em editores de vídeo (CapCut, Premiere, DaVinci, Canva).
- `gerar_cards_automatico.py`: Script para montagem e geração de cards por linha de comando.
- `exportar_video_ffmpeg.py`: Script de suporte para renderização com FFmpeg.

