"""Build the self-contained design preview.

Reads design/src/app.html, inlines the brand images from brand/ as data URIs,
and writes design/abet-content-os-preview.html (one file, opens in any browser).

Usage: python3 design/build.py
"""
import base64
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
BRAND = ROOT.parent / "brand"


def uri(rel, mime):
    return f"data:{mime};base64," + base64.b64encode((BRAND / rel).read_bytes()).decode()


html = (ROOT / "src" / "app.html").read_text()
tokens = {
    "WM_DARK": uri("logos/web/wordmark-dark-240.png", "image/png"),
    "WM_WHITE": uri("logos/web/wordmark-white-240.png", "image/png"),
    "MARK": uri("logos/abet-mark-96.png", "image/png"),
}
for name, data in tokens.items():
    html = html.replace(f'"{name}"', f'"{data}"').replace(f"'{name}'", f"'{data}'")
html = html.replace("mt5:'MT5'", "mt5:'" + uri("images/web/mt5-devices-520.webp", "image/webp") + "'")

for leftover in ('"WM_DARK"', "'WM_DARK'", '"WM_WHITE"', "'WM_WHITE'", '"MARK"', "'MARK'", "mt5:'MT5'"):
    assert leftover not in html, f"placeholder not replaced: {leftover}"

# Standalone document so the file also works when opened directly (desktop or phone).
html = (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<link rel="icon" href="' + tokens["MARK"] + '">\n</head>\n<body>\n' + html + '\n</body>\n</html>\n'
)
out = ROOT / "abet-content-os-preview.html"
out.write_text(html)
print(f"built {out.name}: {len(html):,} bytes")
