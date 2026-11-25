#!/bin/bash
cd "$(dirname "$0")"

echo "================================================"
echo "    Iniciando Matawas Stories Video Studio      "
echo "================================================"

# Obtém a porta configurada no .env ou padrão 3000
PORT=3000
if [ -f .env ]; then
    ENV_PORT=$(grep -E '^PORT=' .env | cut -d '=' -f 2 | tr -d ' "\r')
    if [ -n "$ENV_PORT" ] && [ "$ENV_PORT" != "8080" ]; then
        PORT=$ENV_PORT
    fi
fi

# Verifica se o servidor já está rodando nessa porta
if lsof -i :"$PORT" >/dev/null 2>&1; then
    echo "✓ Servidor já está em execução na porta $PORT!"
else
    echo "Iniciando servidor local na porta $PORT..."
    python3 servidor.py &
    sleep 1.2
fi

# Abre no navegador padrão do Mac
open "http://localhost:$PORT"

echo "✓ Pronto! O estúdio abriu no seu navegador: http://localhost:$PORT"

