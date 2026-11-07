# Guia de Publicação na Web (Deploy) - Matawas Stories

Este guia detalha como disponibilizar o **Matawas Stories** na internet para acesso público através de um domínio ou link HTTPS.

---

## 🔒 Segurança de Chaves de API na Web

Existem duas formas recomendadas de disponibilizar o estúdio na internet:

1. **Modo "Chave do Usuário" (Bring Your Own Key - Recomendado para sites públicos abertos):**
   - O projeto é hospedado como um site 100% estático (Vercel, Netlify ou Cloudflare Pages).
   - Você **não** inclui a sua chave no código público.
   - Cada usuário que acessar pode colar sua própria chave gratuita do Google AI Studio no modal de IA (a chave fica salva no `localStorage` do navegador do próprio usuário).
2. **Modo "Serviço Próprio" (Sua Chave com Proxy Serverless):**
   - Você hospeda o frontend na Vercel ou Netlify.
   - A sua chave fica salva nas **Environment Variables** da plataforma.
   - Uma **Serverless Function** (ex: `/api/config` ou `/api/gemini`) responde com as credenciais ou faz a intermediação da chamada à IA sem expor a chave para o público.

---

## Opção 1: Publicação com Vercel (Recomendado)

A Vercel é a forma mais rápida e com suporte nativo a HTTPS e domínio gratuito `.vercel.app`.

### Passo a Passo:

1. Suba seu projeto para um repositório no GitHub:
   ```bash
   git add .
   git commit -m "docs: documentação e deploy para publicação web"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/matawas-stories.git
   git push -u origin main
   ```

2. Acesse [vercel.com](https://vercel.com) e faça login com seu GitHub.
3. Clique em **"Add New Project"** e selecione o repositório `matawas-stories`.
4. Em **Root Directory**, mantenha `./`.
5. Se for usar o modo com chave protegida, adicione as variáveis em **Environment Variables**:
   - `GEMINI_API_KEY`: sua chave do Google AI Studio
   - `GEMINI_IMAGE_MODEL`: `gemini-3.1-flash-image`
   - `GEMINI_LLM_MODEL`: `gemini-3.8-flash`
6. Clique em **Deploy**.

> **Dica para Vercel:** Crie uma pasta `api/` com o arquivo `config.js` para responder ao endpoint `/api/config` na nuvem:
> ```javascript
> // api/config.js
> export default function handler(req, res) {
>   res.setHeader('Access-Control-Allow-Origin', '*');
>   res.status(200).json({
>     apiKey: process.env.GEMINI_API_KEY || '',
>     imageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
>     llmModel: process.env.GEMINI_LLM_MODEL || 'gemini-3.8-flash',
>     hasApiKey: Boolean(process.env.GEMINI_API_KEY)
>   });
> }
> ```

---

## Opção 2: Publicação com Netlify

O Netlify funciona de forma idêntica e oferece 100 GB de tráfego gratuito por mês.

1. Acesse [netlify.com](https://netlify.com) e faça login.
2. Selecione **"Import an existing project"** ➔ **GitHub**.
3. Escolha o repositório `matawas-stories`.
4. Configure as variáveis de ambiente em **Site Configuration ➔ Environment variables**:
   - `GEMINI_API_KEY`
   - `GEMINI_IMAGE_MODEL`
   - `GEMINI_LLM_MODEL`
5. Clique em **Deploy site**.

---

## Opção 3: Servidor Próprio (Docker / Railway / Render)

Se preferir rodar o servidor Python original na nuvem:

### Dockerfile
Crie um arquivo `Dockerfile` na raiz:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . /app
EXPOSE 8080
ENV PORT=8080
CMD ["python3", "servidor.py"]
```

Na **Railway** ([railway.app](https://railway.app)) ou **Render** ([render.com](https://render.com)):
- Basta conectar o repositório e o serviço detectará o Dockerfile automaticamente, gerando um link HTTPS público.

---

## 📱 Requisitos de Produção para o Celular
- O recurso de **Salvar direto na Galeria de Fotos** (`navigator.share`) **exige conexão HTTPS** por regra de segurança dos navegadores móveis (Safari no iOS e Chrome no Android).
- Ao publicar na Vercel, Netlify ou Cloudflare, o certificado SSL/HTTPS é gerado automaticamente e gratuito, fazendo o salvamento no celular funcionar com 100% de precisão!
