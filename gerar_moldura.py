from PIL import Image, ImageDraw

def gerar_molduras():
    # Card Individual (620 x 1040 px)
    card_w, card_h = 620, 1040
    
    # 1. Moldura com área de imagem TRANSPARENTE
    # O usuário pode colocar a imagem por baixo ou por cima da moldura
    moldura = Image.new('RGBA', (card_w, card_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(moldura)
    
    # Borda externa do card inteiro (cinza escuro suave)
    draw.rounded_rectangle([0, 0, card_w - 1, card_h - 1], radius=16, outline=(45, 45, 50, 255), width=3)
    
    # Caixa do Texto (inferior) - Preto estilizado como no vídeo
    txt_y = 690
    draw.rounded_rectangle([8, txt_y, card_w - 9, card_h - 9], radius=10, fill=(14, 14, 16, 255), outline=(35, 35, 40, 255), width=2)
    
    # Borda interna da área da imagem (para dar acabamento perfeito)
    draw.rounded_rectangle([8, 8, card_w - 9, txt_y - 10], radius=10, outline=(35, 35, 40, 255), width=2)
    
    moldura.save('moldura_transparente.png')
    print("Salvo: moldura_transparente.png")

if __name__ == '__main__':
    gerar_molduras()

