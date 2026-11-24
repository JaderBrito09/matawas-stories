#!/usr/bin/env python3
"""
Servidor local do Matawas Stories.
Serve a interface web e carrega as variáveis de ambiente com segurança do arquivo .env.
"""

import http.server
import json
import os
import socketserver
import subprocess
import tempfile
import urllib.parse
import shutil
import time

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

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

class MatawasRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_DIR, **kwargs)

    def log_message(self, format, *args):
        # Mantém a saída limpa
        pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Content-Length, X-Requested-With")
        self.end_headers()

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

        # Endpoint para verificar suporte do FFmpeg no servidor local
        if self.path == "/api/status-ffmpeg":
            tem_ffmpeg = shutil.which("ffmpeg") is not None
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "ffmpeg": tem_ffmpeg}).encode("utf-8"))
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

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/processar-video":
            params = urllib.parse.parse_qs(parsed.query)
            trilha_escolhida = params.get("trilha", ["trilha_nova.mp3"])[0]

            try:
                content_length = int(self.headers.get("Content-Length", 0))
            except ValueError:
                content_length = 0

            if content_length <= 0:
                self.send_response(400)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(b"Nenhum video enviado.")
                return

            video_data = self.rfile.read(content_length)

            # Processamento de video com FFmpeg para compatibilidade total celular/YouTube
            temp_in = tempfile.NamedTemporaryFile(suffix=".tmp", delete=False)
            temp_out = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
            temp_in.close()
            temp_out.close()

            try:
                with open(temp_in.name, "wb") as f:
                    f.write(video_data)

                duracao = 15.0
                try:
                    probe_cmd = [
                        "ffprobe", "-v", "error",
                        "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1",
                        temp_in.name
                    ]
                    probe_out = subprocess.check_output(probe_cmd, stderr=subprocess.DEVNULL).decode().strip()
                    duracao = float(probe_out) if probe_out else 15.0
                except Exception:
                    duracao = 15.0

                codec_video = "desconhecido"
                try:
                    probe_codec_cmd = [
                        "ffprobe", "-v", "error",
                        "-select_streams", "v:0",
                        "-show_entries", "stream=codec_name",
                        "-of", "default=noprint_wrappers=1:nokey=1",
                        temp_in.name
                    ]
                    codec_video = subprocess.check_output(probe_codec_cmd, stderr=subprocess.DEVNULL, timeout=4).decode().strip().lower()
                except Exception:
                    codec_video = "desconhecido"

                trilha_path = os.path.join(PROJECT_DIR, trilha_escolhida)
                tem_trilha = trilha_escolhida != "none" and os.path.exists(trilha_path)

                fade_start = max(0.0, duracao - 1.5)

                # Se o vídeo já foi gerado em H.264 (padrão do WebCodecs), usa -c:v copy para velocidade instantânea (0.3s)
                copiar_video = (codec_video == "h264")
                v_codec_args = ["-c:v", "copy"] if copiar_video else [
                    "-c:v", "libx264",
                    "-pix_fmt", "yuv420p",
                    "-preset", "ultrafast",
                    "-crf", "21"
                ]

                if tem_trilha:
                    cmd = [
                        "ffmpeg", "-y",
                        "-i", temp_in.name,
                        "-stream_loop", "-1", "-i", trilha_path,
                        "-map", "0:v:0",
                        "-map", "1:a:0"
                    ] + v_codec_args + [
                        "-t", str(duracao),
                        "-filter:a", f"afade=t=out:st={fade_start:.2f}:d=1.5",
                        "-c:a", "aac",
                        "-b:a", "192k",
                        "-ar", "44100",
                        "-movflags", "+faststart",
                        temp_out.name
                    ]
                else:
                    cmd = [
                        "ffmpeg", "-y",
                        "-i", temp_in.name
                    ] + v_codec_args + [
                        "-c:a", "aac",
                        "-b:a", "192k",
                        "-ar", "44100",
                        "-movflags", "+faststart",
                        temp_out.name
                    ]

                subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)

                with open(temp_out.name, "rb") as f:
                    final_bytes = f.read()

                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(len(final_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Disposition", 'attachment; filename="video_matawas_stories.mp4"')
                self.end_headers()
                self.wfile.write(final_bytes)
                return

            except Exception as err:
                self.send_response(500)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(f"Erro ao processar video: {err}".encode("utf-8"))
                return
            finally:
                if os.path.exists(temp_in.name):
                    try: os.remove(temp_in.name)
                    except Exception: pass
                if os.path.exists(temp_out.name):
                    try: os.remove(temp_out.name)
                    except Exception: pass

        self.send_response(404)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

class ReusableThreadingHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def handle_error(self, request, client_address):
        # Ignora quedas repentinas de conexão do browser
        pass

def iniciar_servidor():
    import threading

    portas_ativas = []

    def rodar_porta(porta):
        while True:
            try:
                server = ReusableThreadingHTTPServer(("", porta), MatawasRequestHandler)
                if porta not in portas_ativas:
                    portas_ativas.append(porta)
                    print(f"✓ Servidor Matawas Stories rodando na porta {porta}")
                server.serve_forever()
            except OSError:
                time.sleep(1.5)
            except Exception:
                time.sleep(1.0)

    portas_candidatas = [8080, 8081, 8082]
    threads = []
    for p in portas_candidatas:
        t = threading.Thread(target=rodar_porta, args=(p,), daemon=True)
        t.start()
        threads.append(t)

    # Dá um tempo para os sockets subirem
    import time
    time.sleep(0.5)

    def obter_ip_local():
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "localhost"

    ip_local = obter_ip_local()

    print("👉 Acesse localmente por qualquer um dos links:")
    for p in portas_ativas:
        print(f"   • http://localhost:{p}")
        if ip_local != "localhost":
            print(f"   • http://{ip_local}:{p}")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nServidor encerrado.")

if __name__ == "__main__":
    iniciar_servidor()

