import hashlib
import io
import json
import os
from pathlib import Path

from PIL import Image

from mazi.discovery.clip_encoder import CLIPEncoder
from mazi.discovery.embeddings import cosine
from tests.browser.discovery_learned_fixture import PHOTOGRAPHS, photographs

encoder = CLIPEncoder(os.environ['MAZI_EMBEDDING_MODEL_DIR'])
images = {}
for color in ('red', 'blue', 'green'):
    output = io.BytesIO()
    Image.new('RGB', (80, 80), color).save(output, 'JPEG')
    images[color] = encoder.visual_vector(output.getvalue())
documents = {'red': 'Bicycle beside the sea Amsterdam photo-0.jpg',
             'blue': 'Dinner with friends Istanbul photo-1.jpg',
             'green': 'Garden in the morning Amsterdam photo-2.jpg'}
texts = {color: encoder.text_vector(text) for color, text in documents.items()}
report = dict(model=encoder.version, original_fixture=[], learned_fixture=[])
for query in ('bright red square', 'a photo of a red square', 'a plain red image', 'a blue square'):
    vector = encoder.text_vector(query)
    scores = {color: dict(visual=cosine(vector, images[color]), text=cosine(vector, texts[color]),
                         combined=encoder.score(vector, dict(text=texts[color], visual=images[color]), documents[color], query))
              for color in images}
    report['original_fixture'].append(dict(query=query, scores=scores))
red = report['original_fixture'][0]['scores']
assert red['red']['visual'] > red['blue']['visual']
assert red['blue']['combined'] > red['red']['combined']
query = 'people relaxing on a wooden dock beside a mountain lake'
vector = encoder.text_vector(query)
media = Path(__file__).resolve().parents[3] / 'public' / 'media'
for index, ((scene, title), (data, _)) in enumerate(zip(PHOTOGRAPHS, photographs())):
    document = f'{title} photo-{index}.jpg'
    text, pixels = encoder.text_vector(document), encoder.visual_vector(data)
    report['learned_fixture'].append(dict(scene=scene, document=document,
        source_sha256=hashlib.sha256((media / (scene + '.webp')).read_bytes()).hexdigest(),
        jpeg_sha256=hashlib.sha256(data).hexdigest(), visual=cosine(vector, pixels),
        text=cosine(vector, text), combined=encoder.score(vector, dict(text=text, visual=pixels), document, query)))
report['learned_query'] = query
assert max(report['learned_fixture'], key=lambda row: row['combined'])['scene'] == 'lake'
print(json.dumps(report, indent=2))
