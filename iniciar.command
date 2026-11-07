#!/bin/bash
cd "$(dirname "$0")"

echo "================================================"
echo "    Iniciando Matawas Stories Video Studio      "
echo "================================================"

# Verifica se o servidor já está rodando na porta 8080 ou 8081
if lsof -i :8080 -i :8081 >/dev/null 2>&1; then
    echo "✓ Servidor já está em execução!"
else
    echo "Iniciando servidor local..."
    python3 servidor.py &
    sleep 1.5
fi

# Abre no navegador padrão do Mac
open "http://localhost:8080"

echo "✓ Pronto! O estúdio abriu no seu navegador."
