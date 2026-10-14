"""Opt-in tests of actual pinned ONNX sessions, in addition to lifecycle doubles."""
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from phase5.embeddings import cosine


@unittest.skipUnless(os.environ.get('MAZI_EMBEDDING_MODEL_DIR'), 'Verified local CLIP installation required')
class CLIPRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from phase5.clip_encoder import CLIPEncoder
        cls.encoder = CLIPEncoder(os.environ['MAZI_EMBEDDING_MODEL_DIR'])

    def test_cross_modal_ranking_without_lexical_or_color_aliases(self):
        data = (Path(__file__).resolve().parents[2] / 'public/media/lake.webp').read_bytes()
        with patch('socket.socket.connect', side_effect=AssertionError('Inference attempted network access')):
            pixels = self.encoder.visual_vector(data)
            relevant = self.encoder.text_vector('people relaxing on a wooden dock beside a lake')
            irrelevant = self.encoder.text_vector('a birthday cake with candles in a kitchen')
        self.assertEqual(len(pixels), 512)
        self.assertEqual(len(relevant), 512)
        self.assertAlmostEqual(cosine(pixels, pixels), 1, places=5)
        self.assertGreater(cosine(pixels, relevant), cosine(pixels, irrelevant))

    def test_long_text_windows_are_finite_and_deterministic(self):
        query = 'A wooden dock next to a mountain lake. ' * 120
        first = self.encoder.text_vector(query)
        second = self.encoder.text_vector(query)
        self.assertEqual(len(first), 512)
        self.assertEqual(first, second)
        self.assertAlmostEqual(cosine(first, first), 1, places=5)
