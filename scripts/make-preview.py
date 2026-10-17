"""Cria a prévia independente a partir dos arquivos reais do site."""
from pathlib import Path
import base64
import mimetypes

root = Path(__file__).resolve().parents[1]
public = root / 'public'
html = (public / 'index.html').read_text()
import re
for name in ['styles.css', 'password-field.css']:
    html = re.sub(r'<link rel="stylesheet" href="' + re.escape(name) + r'(?:\?[^\"]*)?">', lambda _: '<style>\n' + (public / name).read_text() + '\n</style>', html)
for name in ['password-field.js', 'seed.js', 'contacts.js']:
    html = re.sub(r'<script src="' + re.escape(name) + r'(?:\?[^\"]*)?" defer></script>', lambda _: '<script>\n' + (public / name).read_text() + '\n</script>', html)
html = re.sub(r'<script src="app\.js(?:\?[^\"]*)?" defer></script>', '', html)
html = html.replace('</body>', '<script>globalThis.PREVIEW_ONLY=true;\n' + (public / 'app.js').read_text() + '\n</script>\n</body>')
for asset in (public / 'assets').iterdir():
    mime = mimetypes.guess_type(asset.name)[0] or 'application/octet-stream'
    data = 'data:' + mime + ';base64,' + base64.b64encode(asset.read_bytes()).decode()
    html = html.replace('assets/' + asset.name, data)
(root / 'PREVIA.html').write_text(html)
print('PREVIA.html criada com estilos, scripts e imagens incorporados.')
