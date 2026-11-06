#!/usr/bin/env python3
"""
Servidor local do Matawas Stories.
Serve a interface web e carrega as variáveis de ambiente com segurança do arquivo .env.
"""

import http.server
import json
import os
import socketserver

PORT = 8080

def carregar_env():
    """Lê o arquivo .env e retorna um dicionário com as variáveis."""
    env_vars = {
        "GEMINI_API_KEY": "",
        "GEMINI_IMAGE_MODEL": "gemini-3.1-flash-image",
        "GEMINI_LLM_MODEL": "gemini-3.8-flash",
        "PORT": 8080
    }
    
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'").strip('"')
                    env_vars[key] = val
                    os.environ[key] = val

    if "PORT" in env_vars:
        try:
            env_vars["PORT"] = int(env_vars["PORT"])
        except ValueError:
            env_vars["PORT"] = 8080

    return env_vars

ENV = carregar_env()
PORT = ENV.get("PORT", 8080)

class MatawasRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Endpoint para entregar as configurações seguras do .env ao frontend
        if self.path == "/api/config":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            # Recarrega o .env para pegar alterações sem precisar reiniciar
            current_env = carregar_env()
            resposta = {
                "apiKey": current_env.get("GEMINI_API_KEY", ""),
                "imageModel": current_env.get("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image"),
                "llmModel": current_env.get("GEMINI_LLM_MODEL", "gemini-3.8-flash"),
                "hasApiKey": bool(current_env.get("GEMINI_API_KEY", "").strip())
            }
            self.wfile.write(json.dumps(resposta).encode("utf-8"))
            return

        # Redirecionamento da raiz para o gerador
        if self.path == "/" or self.path == "":
            self.send_response(302)
            self.send_header("Location", "/gerador_cards.html")
            self.end_headers()
            return

        super().do_GET()

def iniciar_servidor():
    global PORT
    socketserver.TCPServer.allow_reuse_address = True
    porta_atual = PORT
    for _ in range(5):
        try:
            with socketserver.TCPServer(("", porta_atual), MatawasRequestHandler) as httpd:
                PORT = porta_atual
                print(f"✓ Servidor Matawas Stories rodando na porta {PORT}")
                print(f"👉 Acesse localmente: http://localhost:{PORT}")
                print(f"👉 No celular (mesmo Wi-Fi): http://192.168.18.136:{PORT}")
                try:
                    httpd.serve_forever()
                except KeyboardInterrupt:
                    print("\nServidor encerrado.")
                return
        except OSError as e:
            if e.errno == 48:  # Porta já em uso
                porta_atual += 1
            else:
                raise e

if __name__ == "__main__":
    iniciar_servidor()

