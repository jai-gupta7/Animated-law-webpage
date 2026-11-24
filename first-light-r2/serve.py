"""Local preview server for the First Light R2 style test. Serves the parent (repository) folder (R2 reuses R1's
letter and page styles) with caching off. Run from the repository root:  py -3 first-light-r2/serve.py
then open http://localhost:5181/first-light-r2/"""
import functools
import http.server
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoCache, directory=str(ROOT))
    http.server.ThreadingHTTPServer(("127.0.0.1", 5181), handler).serve_forever()
