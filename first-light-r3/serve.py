"""Local preview server for the First Light pilot: static files with caching off, so edits show on reload.
Run from the repository root:  py -3 first-light-r3/serve.py  (then open http://localhost:5182)"""
import functools
import http.server
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoCache, directory=str(ROOT))
    http.server.ThreadingHTTPServer(("127.0.0.1", 5182), handler).serve_forever()
