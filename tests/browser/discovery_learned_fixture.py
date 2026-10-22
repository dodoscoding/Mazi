import io
from pathlib import Path

from PIL import Image


PHOTOGRAPHS = (
    ('lake', 'Archive item one'),
    ('birthday', 'Archive item two'),
    ('harbor', 'Archive item three'),
)


def photographs():
    media = Path(__file__).resolve().parents[2] / 'public' / 'media'
    for scene, title in PHOTOGRAPHS:
        output = io.BytesIO()
        with Image.open(media / (scene + '.webp')) as image:
            image.convert('RGB').save(output, 'JPEG', quality=90)
        yield output.getvalue(), title
