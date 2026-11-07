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

        # Favicon silencioso para evitar 404
        if self.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return

        # Redirecionamento da raiz para o gerador
        if self.path == "/" or self.path == "":
            self.send_response(302)
            self.send_header("Location", "/gerador_cards.html")
            self.end_headers()
            return

        super().do_GET()

def iniciar_servidor():
    import threading

    portas_ativas = []

    def rodar_porta(porta):
        socketserver.TCPServer.allow_reuse_address = True
        try:
            with socketserver.TCPServer(("", porta), MatawasRequestHandler) as httpd:
                portas_ativas.append(porta)
                print(f"✓ Servidor Matawas Stories rodando na porta {porta}")
                httpd.serve_forever()
        except OSError:
            pass

    portas_candidatas = [8080, 8081, 8082]
    threads = []
    for p in portas_candidatas:
        t = threading.Thread(target=rodar_porta, args=(p,), daemon=True)
        t.start()
        threads.append(t)

    # Dá um tempo para os sockets subirem
    import time
    time.sleep(0.5)

    print("👉 Acesse localmente por qualquer um dos links:")
    for p in portas_ativas:
        print(f"   • http://localhost:{p}")
        print(f"   • http://192.168.18.136:{p}")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nServidor encerrado.")

if __name__ == "__main__":
    iniciar_servidor()

