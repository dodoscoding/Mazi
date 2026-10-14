"""Offline, inspectable baseline; no pretrained model or face processing.

Text uses synonym-normalized feature hashing. Visual vectors are soft palette
histograms. They support concept/color retrieval, not general image understanding.
Version changes invalidate stored vectors. Evaluation data is never loaded here.
"""
import hashlib
import io
import math
import re
from PIL import Image, ImageOps

VERSION = 'local-concepts-palette-v1'
TEXT_DIMENSIONS = 256
PALETTE = {
    'red': (235, 30, 30), 'orange': (245, 140, 20), 'yellow': (240, 230, 30),
    'green': (30, 160, 40), 'blue': (30, 60, 235), 'purple': (140, 40, 170),
    'pink': (240, 150, 180), 'brown': (115, 70, 30), 'black': (0, 0, 0),
    'white': (255, 255, 255), 'gray': (130, 130, 130),
}
CONCEPTS = [
    'bicycle bike cycling cycle bisiklet', 'beach seaside shore coast sea ocean deniz sahil',
    'dog dogs puppy canine köpek', 'cat cats kitten feline kedi',
    'mountain mountains hiking hike trekking dağ', 'snow snowy skiing ski winter kar',
    'birthday birthdays cake candles doğumgünü', 'wedding marriage bride groom düğün',
    'meal meals dinner lunch food eating yemek', 'coffee cafe café espresso kahve',
    'forest woods woodland trees orman', 'garden flowers flower floral bahçe',
    'train railway railroad rail tren', 'boat boats sailing sail ship ferry tekne',
    'car cars automobile driving araba', 'music concert gig guitar müzik',
    'football soccer futbol', 'swimming swim pool havuz',
    'sunset dusk sundown evening günbatımı', 'baby infant newborn bebek',
    'red crimson scarlet kırmızı', 'blue azure mavi', 'green emerald yeşil',
    'white ivory beyaz', 'black dark siyah', 'yellow golden sarı', 'gray grey gri',
]
ALIASES = {word: row.split()[0] for row in CONCEPTS for word in row.split()}
STOP = set('a an the in on at by of to with and or for from our my some this that photos photo pictures picture images image show find me near beside during is are was were i we please where'.split())


def terms(value):
    return {ALIASES.get(word, word) for word in re.findall(r'[^\W_]+', value.casefold(), re.UNICODE) if word not in STOP}


def normalize(vector):
    norm = math.sqrt(sum(v * v for v in vector))
    return [v / norm for v in vector] if norm else vector


def text_vector(value):
    vector = [0.0] * TEXT_DIMENSIONS
    for word in terms(value):
        digest = hashlib.sha256(word.encode()).digest()
        vector[int.from_bytes(digest[:4], 'big') % TEXT_DIMENSIONS] += 1 if digest[4] & 1 else -1
    return normalize(vector)


def visual_vector(data):
    with Image.open(io.BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source).convert('RGB').resize((32, 32))
        vector = [0.0] * len(PALETTE)
        colors = list(PALETTE.values())
        for pixel in image.get_flattened_data():
            distances = [sum((a - b) ** 2 for a, b in zip(pixel, color)) for color in colors]
            vector[min(range(len(colors)), key=distances.__getitem__)] += 1
    return normalize(vector)


def color_query(value):
    words = terms(value)
    return normalize([float(color in words) for color in PALETTE])


def cosine(left, right):
    if len(left) != len(right) or any(not math.isfinite(x) for x in [*left, *right]):
        raise ValueError('Incompatible embedding')
    return max(0.0, sum(a * b for a, b in zip(left, right)))


class BaselineEncoder:
    version = VERSION
    dimensions = {'text': TEXT_DIMENSIONS, 'visual': len(PALETTE)}
    label = 'local semantic baseline'
    learned = False
    ready = True
    message = 'Limited vocabulary and color similarity; no general image understanding.'
    text_vector = staticmethod(text_vector)
    visual_vector = staticmethod(visual_vector)

    @staticmethod
    def score(query_vector, vectors, document, query):
        text_score = cosine(query_vector, vectors['text']) if terms(query) & terms(document) else 0
        return max(text_score, cosine(color_query(query), vectors['visual']))


class UnavailableEncoder(BaselineEncoder):
    ready = False
    label = 'Words & filters'
    message = 'Configured local model is unavailable. Words and filters remain available; check the local model installation.'


def configured_encoder():
    import os
    directory = os.environ.get('MAZI_EMBEDDING_MODEL_DIR')
    if not directory:
        return BaselineEncoder()
    try:
        from .clip_encoder import CLIPEncoder
        return CLIPEncoder(directory)
    except (ImportError, OSError, ValueError, RuntimeError):
        return UnavailableEncoder()
