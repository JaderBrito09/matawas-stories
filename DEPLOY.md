# Publicação Direta pelo GitHub (GitHub Pages)

Você pode publicar o **Matawas Stories** diretamente pelo próprio **GitHub**, sem precisar de nenhuma plataforma de terceiros (como Vercel ou Netlify). O GitHub oferece hospedagem gratuita, link próprio e certificado HTTPS oficial.

Seu link de acesso será:
```text
https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/
```

---

## 🚀 Passo a Passo para Ativar o Link no GitHub

### Passo 1: Enviar o código para o seu GitHub
Abra o terminal na pasta do projeto e execute:

```bash
# 1. Adicionar o arquivo de entrada index.html e as configurações
git add .

# 2. Fazer o commit
git commit -m "feat: preparar projeto para publicação no GitHub Pages"

# 3. Renomear a branch para main (padrão do GitHub)
git branch -M main

# 4. Vincular ao seu repositório no GitHub (troque pelo link do seu repositório)
git remote add origin https://github.com/SEU_USUARIO/matawas-stories.git

# 5. Enviar os arquivos
git push -u origin main
```

*(Se você já tinha o repositório configurado no GitHub, basta dar `git push`).*

---

### Passo 2: Ativar o GitHub Pages no Repositório

1. Abra a página do seu repositório no **GitHub** pelo navegador.
2. No menu superior do repositório, clique na aba **Settings** (Configurações ⚙️).
3. No menu lateral esquerdo, desça até a seção **Pages** (abaixo de *Code and automation*).
4. Na tela de **GitHub Pages**, configure a seção **Build and deployment**:
   - **Source:** Selecione `Deploy from a branch`.
   - **Branch:** Escolha `main` (ou `master`).
   - **Folder:** Escolha `/ (root)`.
5. Clique no botão azul **Save**.

---

### Passo 3: Acessar seu link público!

- Aguarde cerca de **1 a 2 minutos**.
- Recarregue a página de configurações. No topo aparecerá a mensagem verde:
  > **Your site is live at `https://SEU_USUARIO.github.io/matawas-stories/`**
- Clique no link e o seu estúdio abrirá imediatamente!

---

## 🔑 Como Funciona a Chave do Gemini no GitHub Pages

O GitHub Pages é uma hospedagem estática pública. Isso significa que você **nunca** deve salvar chaves de API secretas dentro do código público do GitHub.

Por isso, o Matawas Stories foi projetado com suporte nativo ao **Modo Navegador Seguro**:
1. Ao abrir o site pelo link do GitHub Pages pela primeira vez, clique em **✨ Gerar com IA** em qualquer card.
2. Cole sua chave gratuita do Google AI Studio no campo de chave.
3. O estúdio salvará a chave com segurança no **`localStorage` do seu próprio navegador**.
4. Ela ficará salva permanentemente no seu dispositivo (computador ou celular), sem nunca ser exposta na internet para outras pessoas!

---

## 📱 Vantagens do GitHub Pages para Celulares
- O GitHub Pages fornece automaticamente um certificado **HTTPS**.
- Com HTTPS, a **Web Share API** funciona perfeitamente, permitindo que você exporte os vídeos no celular e toque em **"Salvar Vídeo"** para enviar direto para a sua **Galeria de Fotos / Rolo de Câmera**!
