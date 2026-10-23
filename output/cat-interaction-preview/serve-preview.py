"""Serve only the cat experiment and its required assets on localhost."""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import mimetypes
from pathlib import Path
from urllib.parse import urlsplit

PREVIEW = Path(__file__).resolve().parent
PROJECT = PREVIEW.parent.parent
FILES = {
    "/": PREVIEW / "index.html",
    "/index.html": PREVIEW / "index.html",
    "/preview.js": PREVIEW / "preview.js",
    "/eye-compositor.js": PREVIEW / "eye-compositor.js",
    "/cat-motion-draft.png": PREVIEW / "cat-motion-draft.png",
}
for state in ("stable", "caution", "warning", "budget-reached"):
    asset = f"assets/images/pets/cat-{state}@3x.png"
    FILES[f"/{asset}"] = PROJECT / asset
    source = f"cat-{state}-blink-source-v2.png"
    FILES[f"/{source}"] = PREVIEW / source
for weight in ("Rg", "Bd"):
    asset = f"assets/fonts/line-seed/LINESeedKR-{weight}.ttf"
    FILES[f"/{asset}"] = PROJECT / asset


class PreviewHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        file = FILES.get(urlsplit(self.path).path)
        if file is None or not file.is_file():
            self.send_error(404)
            return
        body = file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(file.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), PreviewHandler)
    print(f"고양이 미리보기: http://127.0.0.1:{args.port}/  (종료: Ctrl+C)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
