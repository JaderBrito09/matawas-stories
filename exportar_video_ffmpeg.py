import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

def renderizar_esteira_completa(cards_dados, output_path="esteira_completa.png"):
    """Gera a imagem panorâmica de alta resolução com todos os cards."""
    card_w, card_h = 620, 1040
    gap = 25
    margin = 20

    total_w = (len(cards_dados) * card_w) + ((len(cards_dados) - 1) * gap) + (margin * 2)
    total_h = 1080

    faixa = Image.new('RGB', (total_w, total_h), (18, 20, 24))
    draw = ImageDraw.Draw(faixa)

    try:
        font_txt = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 30)
    except Exception:
        font_txt = ImageFont.load_default()

    cur_x = margin
    for idx, c in enumerate(cards_dados):
        # Fundo do card
        draw.rectangle([cur_x, 20, cur_x + card_w, 20 + card_h], fill=(22, 24, 29), outline=(46, 53, 66), width=4)

        # Imagem
        img_x = cur_x + 10
        img_y = 30
        img_w = 600
        img_h = 680

        img_path = c.get('image')
        if img_path and os.path.exists(img_path):
            user_img = Image.open(img_path).convert('RGB')
            scale = max(img_w / user_img.width, img_h / user_img.height)
            new_sz = (int(user_img.width * scale), int(user_img.height * scale))
            user_img = user_img.resize(new_sz, Image.Resampling.LANCZOS)
            cl = (user_img.width - img_w) // 2
            ct = (user_img.height - img_h) // 2
            cropped = user_img.crop((cl, ct, cl + img_w, ct + img_h))
            faixa.paste(cropped, (img_x, img_y))
        else:
            draw.rectangle([img_x, img_y, img_x + img_w, img_y + img_h], fill=(30, 36, 46))
            draw.text((img_x + 190, img_y + 320), f"Cena #{idx+1}", fill=(120, 130, 150))

        # Divisória
        draw.rectangle([img_x - 2, img_y - 2, img_x + img_w + 2, img_y + img_h + 2], outline=(38, 44, 55), width=3)

        # Caixa de texto inferior
        txt_x = cur_x + 10
        txt_y = 720
        txt_w = 600
        txt_h = 320
        draw.rectangle([txt_x, txt_y, txt_x + txt_w, txt_y + txt_h], fill=(13, 14, 17))

        # Quebra de texto
        texto = c.get('text', '')
        palavras = texto.split()
        linhas = []
        linha_atual = []
        for p in palavras:
            linha_atual.append(p)
            largura = draw.textlength(' '.join(linha_atual), font=font_txt)
            if largura > txt_w - 60:
                linha_atual.pop()
                linhas.append(' '.join(linha_atual))
                linha_atual = [p]
        if linha_atual:
            linhas.append(' '.join(linha_atual))

        altura_total = len(linhas) * 42
        pos_y = txt_y + (txt_h - altura_total) // 2
        for linha in linhas:
            largura_linha = draw.textlength(linha, font=font_txt)
            pos_x = txt_x + (txt_w - largura_linha) // 2
            draw.text((pos_x, pos_y), linha, fill=(255, 255, 255), font=font_txt)
            pos_y += 42

        cur_x += card_w + gap

    faixa.save(output_path)
    print(f"Esteira panorâmica gerada em: {output_path} ({total_w}x{total_h})")
    return total_w, total_h

def gerar_video_youtube_ffmpeg(faixa_path, duracao_segundos=20, output_video="video_youtube_1080p.mp4"):
    """
    Usa o FFmpeg para criar o vídeo 1080p 60fps com animação suave de panning horizontal
    pronto para postar no YouTube (H.264 / yuv420p).
    """
    img = Image.open(faixa_path)
    w, h = img.size
    max_scroll = max(0, w - 1920)

    # Expressão de crop do ffmpeg: desliza x de 0 até max_scroll ao longo da duração t
    # x='t*(in_w-1920)/duracao'
    crop_filter = f"crop=1920:1080:'t*({max_scroll}/{duracao_segundos})':0"

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1",
        "-i", faixa_path,
        "-vf", f"{crop_filter},format=yuv420p",
        "-t", str(duracao_segundos),
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-r", "30",
        "-movflags", "+faststart",
        output_video
    ]

    print("Executando FFmpeg para gerar vídeo YouTube...")
    subprocess.run(cmd, check=True)
    print(f"✓ Vídeo do YouTube gerado com sucesso: {output_video}")

if __name__ == "__main__":
    cards_exemplo = [
        {"image": None, "text": "Daichi treina sem parar para superar todos os limites de seu poder."},
        {"image": None, "text": "Lembrando do planeta Vegeta, ele decide se preparar para a maior batalha."},
        {"image": None, "text": "No torneio de artes marciais, a velocidade dos gêmeos surpreendeu a todos."},
        {"image": None, "text": "Unidos, nenhum inimigo do universo seria capaz de deter a nova lenda."}
    ]
    renderizar_esteira_completa(cards_exemplo, "esteira_completa.png")
    gerar_video_youtube_ffmpeg("esteira_completa.png", duracao_segundos=20)

