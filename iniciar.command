#!/bin/bash
cd "$(dirname "$0")"

echo "================================================"
echo "    Iniciando Matawas Stories Video Studio      "
echo "================================================"

# Porta fixa 3000 para não colidir com outros projetos (porta 8080)
PORT=3000

# Verifica se o servidor já está rodando na porta 3000
if lsof -i :"$PORT" >/dev/null 2>&1; then
    echo "✓ Servidor já está em execução na porta $PORT!"
else
    echo "Iniciando servidor local na porta $PORT..."
    python3 servidor.py &
    sleep 1.2
fi

# Abre diretamente no localhost:3000 no navegador padrão do Mac
open "http://localhost:3000"

echo "✓ Pronto! O estúdio abriu no seu navegador: http://localhost:3000"


