import os
from PIL import Image, ImageDraw, ImageFont

def criar_card(imagem_caminho, texto, arquivo_saida="card_resultado.png"):
    """
    Cria um card no formato exato do canal GokuShow / Manga Stories:
    - Resolução total: 620 x 1040 px
    - Área da Imagem (superior): 600 x 680 px
    - Área do Texto (inferior): 600 x 330 px
    """
    card_w, card_h = 620, 1040
    card = Image.new('RGB', (card_w, card_h), (22, 24, 29))
    draw = ImageDraw.Draw(card)

    # 1. Processar a imagem no topo (600 x 680)
    img_w, img_h = 600, 680
    img_x, img_y = 10, 10

    if os.path.exists(imagem_caminho):
        user_img = Image.open(imagem_caminho).convert('RGB')
        # Redimensionar preservando proporção e preenchendo a área (Cover Crop)
        scale = max(img_w / user_img.width, img_h / user_img.height)
        new_size = (int(user_img.width * scale), int(user_img.height * scale))
        user_img = user_img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Centralizar corte
        crop_left = (user_img.width - img_w) // 2
        crop_top = (user_img.height - img_h) // 2
        cropped = user_img.crop((crop_left, crop_top, crop_left + img_w, crop_top + img_h))
        card.paste(cropped, (img_x, img_y))
    else:
        # Placeholder se não houver imagem
        draw.rectangle([img_x, img_y, img_x + img_w, img_y + img_h], fill=(35, 40, 50))
        draw.text((img_x + 180, img_y + 320), "Insira a Imagem Aqui", fill=(180, 190, 205))

    # 2. Contornos e divisórias
    draw.rectangle([img_x - 2, img_y - 2, img_x + img_w + 2, img_y + img_h + 2], outline=(40, 45, 55), width=3)

    # 3. Caixa de texto inferior
    txt_x, txt_y = 10, 700
    txt_w, txt_h = 600, 330
    draw.rectangle([txt_x, txt_y, txt_x + txt_w, txt_y + txt_h], fill=(13, 14, 17), outline=(40, 45, 55), width=2)

    # 4. Renderizar texto
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 30)
    except Exception:
        font = ImageFont.load_default()

    # Quebra de texto automática
    palavras = texto.split()
    linhas = []
    linha_atual = []
    
    for palavra in palavras:
        linha_atual.append(palavra)
        largura = draw.textlength(' '.join(linha_atual), font=font)
        if largura > txt_w - 60:
            linha_atual.pop()
            linhas.append(' '.join(linha_atual))
            linha_atual = [palavra]
    if linha_atual:
        linhas.append(' '.join(linha_atual))

    # Centralizar verticalmente
    altura_total = len(linhas) * 42
    pos_y = txt_y + (txt_h - altura_total) // 2

    for linha in linhas:
        largura_linha = draw.textlength(linha, font=font)
        pos_x = txt_x + (txt_w - largura_linha) // 2
        draw.text((pos_x, pos_y), linha, fill=(255, 255, 255), font=font)
        pos_y += 42

    card.save(arquivo_saida)
    print(f"Card salvo com sucesso em: {arquivo_saida}")

if __name__ == '__main__':
    # Teste de exemplo
    criar_card(
        imagem_caminho="placeholder.png",
        texto="Em um universo alternativo, os dois irmãos treinaram juntos desde a infância.",
        arquivo_saida="exemplo_card_saida.png"
    )

