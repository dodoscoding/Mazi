"""Offline CLIP inference. Only the explicit installer is allowed to use a network."""
import io
import json
from pathlib import Path
from .clip_manifest import FILES, REVISION, verify_file
from .embeddings import normalize, cosine


class CLIPEncoder:
    version = 'clip-b32-int8-' + REVISION + '-preprocess-v1'
    dimensions = {'text': 512, 'visual': 512}
    label = 'Local CLIP semantic search'
    ready = True
    learned = True
    message = 'English queries work best. Similarity is not a factual label or confidence score.'

    def __init__(self, directory):
        root = Path(directory).resolve()
        for name, spec in FILES.items():
            verify_file(root / name, spec)
        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer
        self.np = np
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.log_severity_level = 3
        try:
            self.text_session = ort.InferenceSession(str(root / 'onnx/text_model_quantized.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
            self.image_session = ort.InferenceSession(str(root / 'onnx/vision_model_quantized.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
        except Exception as exc:
            raise RuntimeError('Local ONNX sessions could not be initialized') from exc
        self.tokenizer = Tokenizer.from_file(str(root / 'tokenizer.json'))
        self.tokenizer.no_truncation()
        self.tokenizer.no_padding()
        self.config = json.loads((root / 'preprocessor_config.json').read_text())

    def _run(self, session, output, inputs):
        try:
            return session.run([output], inputs)
        except Exception as exc:
            self.ready = False
            self.message = 'Local model inference is unavailable. Words and filters remain available; restart after checking the model runtime.'
            raise RuntimeError('Local model inference unavailable') from exc

    def text_vector(self, text):
        # Up to 16 nonoverlapping windows retain more than CLIP's first 77 tokens.
        # The end marker is always present; imported text has no instruction authority.
        ids = self.tokenizer.encode(text[:48000], add_special_tokens=False).ids[:1200]
        bos = self.tokenizer.token_to_id('<|startoftext|>')
        eos = self.tokenizer.token_to_id('<|endoftext|>')
        chunks = [ids[i:i + 75] for i in range(0, len(ids), 75)] or [[]]
        vectors = []
        for chunk in chunks:
            tokens = [bos, *chunk, eos]
            mask = [1] * len(tokens) + [0] * (77 - len(tokens))
            tokens += [eos] * (77 - len(tokens))
            inputs = {'input_ids': self.np.asarray([tokens], dtype=self.np.int64), 'attention_mask': self.np.asarray([mask], dtype=self.np.int64)}
            feeds = {item.name: inputs[item.name] for item in self.text_session.get_inputs()}
            vectors.append(self._run(self.text_session, 'text_embeds', feeds)[0][0])
        result = normalize(self.np.mean(vectors, axis=0).tolist())
        if len(result) != 512:
            raise ValueError('Unexpected CLIP text dimensions')
        cosine(result, result)
        return result

    def visual_vector(self, data):
        from PIL import Image, ImageOps
        with Image.open(io.BytesIO(data)) as source:
            image = ImageOps.exif_transpose(source).convert('RGB')
            width, height = image.size
            shortest = self.config['size']['shortest_edge']
            if width <= height:
                shape = (shortest, int(shortest * height / width))
            else:
                shape = (int(shortest * width / height), shortest)
            image = image.resize(shape, Image.Resampling.BICUBIC)
            size = self.config['crop_size']
            left, top = (image.width - size['width']) // 2, (image.height - size['height']) // 2
            image = image.crop((left, top, left + size['width'], top + size['height']))
            pixels = self.np.asarray(image, dtype=self.np.float32) * self.np.float32(self.config['rescale_factor'])
            pixels = (pixels - self.np.asarray(self.config['image_mean'], dtype=self.np.float32)) / self.np.asarray(self.config['image_std'], dtype=self.np.float32)
            pixels = pixels.transpose(2, 0, 1)[None, ...]
        vector = normalize(self._run(self.image_session, 'image_embeds', {'pixel_values': pixels})[0][0].tolist())
        if len(vector) != 512:
            raise ValueError('Unexpected CLIP image dimensions')
        cosine(vector, vector)
        return vector

    @staticmethod
    def score(query_vector, vectors, document, query):
        # Keep independent semantic evidence from text and pixels; no lexical gate.
        return .35 * cosine(query_vector, vectors['text']) + .65 * cosine(query_vector, vectors['visual'])
