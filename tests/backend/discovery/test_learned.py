"""Provider-independent lifecycle contracts; the opt-in real-model suite is separate."""
import unittest
from unittest.mock import patch
from mazi.identity.core import Denied
from mazi.discovery.discovery import DiscoveryStore
from mazi.discovery.embeddings import BaselineEncoder, UnavailableEncoder
from tests.backend.discovery import test_discovery


class LearnedFixture(BaselineEncoder):
    learned = True
    version = 'test-only-learned-v1'
    label = 'Test learned encoder'


class LearnedContracts(unittest.TestCase):
    setUp = test_discovery.DiscoveryTests.setUp
    tearDown = test_discovery.DiscoveryTests.tearDown
    submit = test_discovery.DiscoveryTests.submit
    process = test_discovery.DiscoveryTests.process
    enable = test_discovery.DiscoveryTests.enable

    def install(self):
        self.store.close()
        self.store = DiscoveryStore(self.temp.name, encoder=LearnedFixture())
        self.enable()

    def test_explicit_index_and_model_version_isolation(self):
        self.install()
        with patch.object(self.store.encoder, 'visual_vector', wraps=self.store.encoder.visual_vector) as image:
            response = self.store.search(self.ben, self.group, query='bike', mode='semantic')
            self.assertEqual(response['unindexed'], 1)
            image.assert_not_called()
            self.assertEqual(self.store.index_batch(self.ben, self.group)['indexed'], 1)
            self.assertEqual(image.call_count, 1)
            self.assertEqual(self.store.search(self.ben, self.group, query='bike', mode='semantic')['total'], 1)
            self.assertEqual(image.call_count, 1)
            self.store.encoder.version = 'test-only-learned-v2'
            response = self.store.search(self.ben, self.group, query='bike', mode='semantic')
            self.assertEqual(response['total'], 0)
            self.assertEqual(response['unindexed'], 1)

    def test_consent_change_during_inference_discards_even_after_reenable(self):
        self.install()
        other = DiscoveryStore(self.temp.name)
        original = self.store.encoder.visual_vector
        def revoke(data):
            other.processing(self.alice, self.group, False)
            other.processing(self.alice, self.group, True)
            return original(data)
        try:
            with patch.object(self.store.encoder, 'visual_vector', side_effect=revoke):
                result = self.store.index_batch(self.ben, self.group)
            self.assertEqual(result['indexed'], 0)
            self.assertEqual(result['discarded'], 1)
            self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 0)
        finally:
            other.close()

    def test_removed_or_hidden_candidates_never_reach_image_encoder(self):
        self.install()
        self.store.hide(self.ben, self.asset, True)
        with patch.object(self.store.encoder, 'visual_vector', side_effect=AssertionError('private image dispatched')):
            self.assertEqual(self.store.index_batch(self.ben, self.group)['indexed'], 0)
            with self.assertRaises(Denied):
                self.store.index_batch(self.outsider, self.group)
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied):
            self.store.index_batch(self.ben, self.group)

    def test_missing_model_falls_back_without_using_old_embeddings(self):
        self.install()
        self.store.index_batch(self.ben, self.group)
        self.store.encoder = UnavailableEncoder()
        response = self.store.search(self.ben, self.group, query='bicycle', mode='semantic')
        self.assertEqual(response['total'], 1)
        self.assertEqual(response['mode'], 'keyword / filters')
        self.assertIsNone(response['model'])
        self.assertFalse(self.store.settings(self.ben, self.group)['model_ready'])

    def test_invalid_model_checksum_and_unconfigured_model_do_not_download(self):
        from pathlib import Path
        from mazi.discovery.clip_manifest import verify_file
        from mazi.discovery.embeddings import configured_encoder
        with patch.dict('os.environ', {'MAZI_EMBEDDING_MODEL_DIR': self.temp.name}):
            self.assertFalse(configured_encoder().ready)
        f = Path(self.temp.name)/'broken.bin'
        f.write_bytes(b'bad')
        with self.assertRaises(ValueError):
            verify_file(f, (3,'sha256','0'*64))

    def test_source_withdrawal_during_inference_drops_pending_vectors(self):
        self.install()
        other = DiscoveryStore(self.temp.name)
        original = self.store.encoder.visual_vector
        def withdraw(data):
            other.withdraw(self.alice, self.run)
            return original(data)
        try:
            with patch.object(self.store.encoder, 'visual_vector', side_effect=withdraw):
                result = self.store.index_batch(self.ben, self.group)
            self.assertEqual(result['indexed'], 0)
            self.assertEqual(result['discarded'], 1)
            self.assertEqual(result['remaining'], 0)
            self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 0)
        finally:
            other.close()

    def test_member_revocation_during_inference_denies_delivery(self):
        self.install()
        other = DiscoveryStore(self.temp.name)
        original = self.store.encoder.visual_vector
        def remove(data):
            other.remove_member(self.alice, self.group, self.ben)
            return original(data)
        try:
            with patch.object(self.store.encoder, 'visual_vector', side_effect=remove):
                with self.assertRaises(Denied):
                    self.store.index_batch(self.ben, self.group)
            self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 0)
        finally:
            other.close()

    def test_remove_and_rejoin_during_inference_still_fences_old_work(self):
        self.install()
        other = DiscoveryStore(self.temp.name)
        original = self.store.encoder.visual_vector
        def rejoin(data):
            other.remove_member(self.alice, self.group, self.ben)
            other.accept(self.ben, other.invite(self.alice, self.group))
            return original(data)
        try:
            with patch.object(self.store.encoder, 'visual_vector', side_effect=rejoin):
                result = self.store.index_batch(self.ben, self.group)
            self.assertEqual(result['indexed'], 0)
            self.assertEqual(result['discarded'], 1)
        finally:
            other.close()

    def test_runtime_failure_keeps_keyword_search_and_never_saves_partial_vectors(self):
        from mazi.identity.core import Conflict
        self.install()
        with patch.object(self.store.encoder, 'text_vector', side_effect=RuntimeError('backend unavailable')):
            self.assertEqual(self.store.search(self.ben, self.group, query='bicycle', mode='semantic')['total'], 1)
            with self.assertRaises(Conflict):
                self.store.index_batch(self.ben, self.group)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 0)
