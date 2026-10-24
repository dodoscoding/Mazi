"""Full Atlas HTTP projection, query budget, and policy snapshot contracts."""
import contextlib
import gc
import http.client
import io
import json
import threading
import tracemalloc
import unittest
from unittest.mock import patch

from PIL import Image

from mazi.atlas import atlas_view
from mazi.memories.memories import MemoryStore
from mazi.server import AppServer, handler_for
from tests.backend.archive import test_capacity
from tests.backend.imports import test_engine


def imported(fixture, count):
    runs = []
    for start in range(0, count, 100):
        files = {}
        for number in range(start, min(start + 100, count)):
            output = io.BytesIO()
            Image.new('RGB', (8, 8), (number % 256, number // 256, 100)).save(output, 'PNG')
            files[f'photo-{number:05d}.png'] = output.getvalue()
        run = fixture.submit(files)
        fixture.process(run)
        fixture.assertEqual(fixture.store.report(fixture.alice, run)['state'], 'COMPLETED')
        runs.append(run)
    return runs


@contextlib.contextmanager
def serving(fixture):
    code = fixture.store.setup_shared(admin_name='Alice', group_id=fixture.group,
                                     mappings={'Alice': fixture.alice, 'Ben': fixture.ben})
    _, token = fixture.store.enter_shared(code=code, name='Ben')
    handler = handler_for(fixture.store)
    handler.log_message = lambda *args: None
    server = AppServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    def request(path=None, session=token):
        client = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=10)
        try:
            headers = {'Cookie': 'mazi_session=' + session} if session else {}
            client.request('GET', path or '/api/atlas?group=' + fixture.group, headers=headers)
            response = client.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            client.close()

    try:
        yield request
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


def photo(asset, title='Untitled photograph'):
    return dict(id='photo-' + asset, kind='photo', shortTitle=title, title=title,
                date='Date not recorded', year=None, approximate=True, by='Your circle',
                description='A photograph from your shared archive.', source='manual',
                photos=[dict(src='/api/review/rendition/' + asset, alt=title, caption=title)],
                messages=[], place=None, people=dict(shared=['Alice'], conversation=[]),
                dateBasis='undated')


class AtlasProjectionTests(unittest.TestCase):
    def setUp(self):
        self.fixture = test_capacity.ArchiveCapacityTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        self.store = self.fixture.store
        self.alice, self.ben, self.group = self.fixture.alice, self.fixture.ben, self.fixture.group

    def assert_body(self, response, cards):
        status, headers, body = response
        self.assertEqual(status, 200, body)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertEqual(int(headers['Content-Length']), len(body))
        self.assertEqual(body, json.dumps({'memories': cards}).encode())

    def test_1001_imported_photos_keep_exact_http_body_with_constant_query_budget(self):
        imported(self.fixture, 1001)
        assets = [row[0] for row in self.store.db.execute('SELECT id FROM archive_assets ORDER BY id DESC')]
        self.assertEqual(len(assets), 1001)
        expected = [photo(asset) for asset in assets]
        for card in expected:
            card['photos'][0]['alt'] = 'Archive photograph'
        with serving(self.fixture) as request:
            statements = []
            self.store.db.set_trace_callback(statements.append)
            try:
                response = request()
            finally:
                self.store.db.set_trace_callback(None)
            self.assert_body(response, expected)
            self.assertLessEqual(len(statements), 35)

    def test_projection_query_count_is_constant_for_1_300_and_1001_photos(self):
        counts = []
        for count in (1, 300, 1001):
            self.store.db.execute("DELETE FROM archive_origins")
            self.store.db.execute("DELETE FROM archive_assets")
            self.store.db.commit()
            self.fixture.seed_projection(count)
            statements = []
            self.store.db.set_trace_callback(statements.append)
            try:
                result = atlas_view(self.store, self.ben, self.group)
            finally:
                self.store.db.set_trace_callback(None)
            self.assertEqual(len(result['memories']), count)
            counts.append(len(statements))
        self.assertEqual(counts, [counts[0]] * 3)
        self.assertLessEqual(counts[0], 24)

    def test_100_101_501_origins_keep_all_context_in_source_order(self):
        previous = 0
        expected_messages = []
        with serving(self.fixture) as request:
            for count in (100, 101, 501):
                with self.subTest(origins=count):
                    for start in range(previous, count, 100):
                        run = self.fixture.submit({f'copy-{n:03d}.jpg': test_engine.picture()
                                                   for n in range(start, min(start + 100, count))})
                        self.fixture.process(run)
                    rows = self.store.db.execute('SELECT id,asset_id,payload FROM archive_origins ORDER BY rowid').fetchall()
                    self.assertEqual(len(rows), count)
                    for index, row in enumerate(rows[previous:], previous):
                        payload = json.loads(row['payload'])
                        payload['source_type'] = ('manual', 'whatsapp', '')[index % 3]
                        payload['context'] = [
                            dict(text=f'Occurrence {index:03d}', sender=dict(label='Participant'),
                                 shared_at=(0, None, False, 12.5, '12:00')[index % 5]),
                            dict(text='Repeated', sender={}, shared_at='unknown'),
                            dict(text='', sender=dict(label='Ignored'), shared_at='')]
                        self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?',
                                              (json.dumps(payload), row['id']))
                        expected_messages.append(dict(name='Participant',
                                                      time=('', '', '', '12.5', '12:00')[index % 5],
                                                      text=f'Occurrence {index:03d}'))
                        if index == 0:
                            expected_messages.append(dict(name='Source participant', time='unknown', text='Repeated'))
                    self.store.db.commit()
                    asset = rows[0]['asset_id']
                    expected = photo(asset)
                    expected['photos'][0]['alt'] = 'Archive photograph'
                    expected['messages'] = expected_messages
                    expected['source'] = 'archive, manual, whatsapp'
                    expected['people']['conversation'] = ['Participant']
                    self.assert_body(request(), [expected])
                    seen = []
                    for offset in range(0, count, 100):
                        status, _, body = request(f'/api/archive/{asset}/origins?offset={offset}')
                        self.assertEqual(status, 200)
                        page = json.loads(body)
                        self.assertEqual(page['total'], count)
                        self.assertEqual(page['next_offset'], offset + 100 if offset + 100 < count else None)
                        seen.extend(item['context'][0]['text'] for item in page['items'])
                    self.assertEqual(seen, [f'Occurrence {index:03d}' for index in range(count)])
                    previous = count

    def test_reversed_overlapping_events_hidden_and_partial_assets_keep_exact_cards(self):
        imported(self.fixture, 5)
        assets = [row[0] for row in self.store.db.execute('SELECT id FROM archive_assets ORDER BY id')]
        a, b, c, d, e = assets
        titles = dict(zip(assets, ('One', 'Two', 'Three', 'Four', 'Five')))
        assertions = (['invalid', None, '2020-01-02'], ['2020-01-02', '2021-01-02'], [], ['2022-01-02'], ['2024-01-02'])
        for asset, dates in zip(assets, assertions):
            self.store.correct_asset(self.alice, asset, title=titles[asset], capture_date=None, place='Annotation only')
            row = self.store.db.execute('SELECT id,payload FROM archive_origins WHERE asset_id=?', (asset,)).fetchone()
            payload = json.loads(row['payload'])
            payload['capture_assertions'] = [dict(local=value) for value in dates]
            payload['context'] = [dict(text='Together', sender=dict(label='Maya'), shared_at=None),
                                  dict(text=titles[asset], sender={}, shared_at=0)]
            self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
            self.store.db.commit()
        first = self.store.review_event(self.alice, self.group, [a, b, c], 'First', 'accept')
        overlap = self.store.review_event(self.alice, self.group, [a, d], 'Overlap', 'accept')
        self.store.review_event(self.alice, self.group, [c, e], 'Rejected', 'reject')
        self.store.db.execute('UPDATE review_events SET asset_ids=? WHERE id=?', (json.dumps([c, b, a]), first))
        self.store.db.commit()

        def expected(identifier, title, members, date, year, basis, kind='memory', approximate=None):
            result = photo(members[0], title)
            result.update(id=identifier, kind=kind, date=date, year=year,
                          approximate=year is None if approximate is None else approximate, dateBasis=basis)
            if kind == 'memory':
                result['description'] = 'An approved shared memory.'
            result['photos'] = [dict(src='/api/review/rendition/' + asset, alt=titles[asset], caption=titles[asset])
                                for asset in members]
            result['messages'] = [dict(name='Maya', time='', text='Together')] + [
                dict(name='Source participant', time='', text=titles[asset]) for asset in members]
            result['people']['conversation'] = ['Maya']
            return result

        fifth = expected('photo-' + e, 'Five', [e], '2024-01-02', 2024, 'source capture evidence', 'photo')
        fourth = expected('photo-' + d, 'Four', [d], '2022-01-02', 2022, 'source capture evidence', 'photo')
        third = expected('photo-' + c, 'Three', [c], 'Date not recorded', None, 'undated', 'photo')
        first_card = expected(first, 'First', [c, b, a], '2020-01-02 to 2021-01-02', 2020,
                              'conflicting source evidence, source capture evidence, undated', approximate=True)
        overlap_card = expected(overlap, 'Overlap', [a, d], '2020-01-02 to 2022-01-02', 2020, 'source capture evidence')
        with serving(self.fixture) as request:
            self.assert_body(request(), [fifth, overlap_card, first_card])
            self.store.hide_event(self.ben, self.group, first, True)
            self.assert_body(request(), [fifth, fourth])
            self.store.hide_event(self.ben, self.group, first, False)
            self.assert_body(request(), [fifth, overlap_card, first_card])
            self.store.hide(self.ben, b, True)
            self.assert_body(request(), [fifth, overlap_card, third])
            self.store.hide(self.ben, b, False)
            self.assert_body(request(), [fifth, overlap_card, first_card])
            self.store.correct_asset(self.alice, c, title='Three', capture_date='2025-02-03', place='')
            first_card['date'] = '2020-01-02 to 2025-02-03'
            first_card['dateBasis'] = 'conflicting source evidence, reviewed correction, source capture evidence'
            self.assert_body(request(), [fifth, first_card, overlap_card])

    def test_two_circles_session_and_removed_reader_keep_sources_protected(self):
        imported(self.fixture, 1)
        asset = self.store.db.execute('SELECT id FROM archive_assets').fetchone()[0]
        other = self.store.create_group(self.alice, 'Other circle')
        self.store.accept(self.ben, self.store.invite(self.alice, other))
        run = self.fixture.submit({'chat.txt': '01/01/2020, 12:00 - Ana: Other circle private context\n'
                                   '01/01/2020, 12:01 - Ana: other.jpg (file attached)',
                                   'other.jpg': test_engine.picture()}, source='whatsapp', group=other)
        self.fixture.process(run)
        self.assertNotIn('Other circle', str(atlas_view(self.store, self.ben, self.group)))
        self.assertIn('Other circle private context', str(atlas_view(self.store, self.ben, other)))
        outsider = self.store.login('outsider@example.test', 'correct horse battery')
        with serving(self.fixture) as request:
            self.assertNotIn(b'Other circle', request()[2])
            other_path = '/api/atlas?group=' + other
            self.assertEqual(request(other_path)[0], 403)
            paths = (None, '/api/archive/' + asset + '/origins', '/api/review/rendition/' + asset)
            for path in paths:
                self.assertEqual(request(path)[0], 200)
                self.assertEqual(request(path, session='')[0], 403)
                self.assertEqual(request(path, session=outsider)[0], 403)
            self.store.remove_member(self.alice, self.group, self.ben)
            for path in paths:
                self.assertEqual(request(path)[0], 403)

    def test_departed_owner_context_name_and_place_leave_independent_copy(self):
        run = self.fixture.submit({'alice.jpg': test_engine.picture()})
        self.fixture.process(run)
        run = self.fixture.submit({'ben.jpg': test_engine.picture()}, user=self.ben)
        self.fixture.process(run, self.ben)
        rows = self.store.db.execute('SELECT id,asset_id,owner_id,payload FROM archive_origins').fetchall()
        asset = rows[0]['asset_id']
        for row in rows:
            owner = row['owner_id']
            payload = json.loads(row['payload'])
            payload['context'] = [dict(text='Alice context' if owner == self.alice else 'Ben private context',
                                       sender=dict(label='Alice' if owner == self.alice else 'Ben'), shared_at=None)]
            self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
            self.store.db.commit()
            self.store.set_place(owner, row['id'], 'NL', 'Amsterdam' if owner == self.alice else 'Utrecht', 52.0, 5.0, None)
        with serving(self.fixture) as request:
            alice_session = self.store.login('alice@example.test', 'correct horse battery')
            before = request(session=alice_session)
            self.assertIn(b'Ben private context', before[2])
            self.store.remove_member(self.alice, self.group, self.ben)
            expected = photo(asset)
            expected['photos'][0]['alt'] = 'Archive photograph'
            expected['messages'] = [dict(name='Alice', time='', text='Alice context')]
            expected['people']['conversation'] = ['Alice']
            expected['place'] = dict(name='Amsterdam', country='NL', latitude=52.0, longitude=5.0)
            self.assert_body(request(session=alice_session), [expected])
            status, _, body = request('/api/archive/' + asset + '/origins', session=alice_session)
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)['total'], 1)
            self.assertNotIn(b'Ben private context', body)
            self.assertEqual(request('/api/review/rendition/' + asset, session=alice_session)[0], 200)

    def test_shared_large_contexts_do_not_accumulate_for_grouped_or_hidden_memories(self):
        self.fixture.seed_projection(1000)
        value = 'Repeated context ' + 'x' * 16384
        payload = dict(source='whatsapp', original_filename='metadata-only.jpg',
                       capture_assertions=[dict(local='2020-01-02')],
                       context=[dict(text=value, sender=dict(label='Alice'), shared_at='2020-01-02')])
        self.store.db.execute('UPDATE archive_origins SET payload=?', (json.dumps(payload),))
        self.store.db.commit()
        assets = [row[0] for row in self.store.db.execute('SELECT id FROM archive_assets ORDER BY id')]
        events = [self.store.review_event(self.alice, self.group, assets[start:start + 100], f'Memory {start}', 'accept')
                  for start in range(0, 1000, 100)]
        with serving(self.fixture) as request:
            for hidden in (False, True):
                with self.subTest(hidden=hidden):
                    if hidden:
                        for event in events:
                            self.store.hide_event(self.ben, self.group, event, True)
                    gc.collect()
                    tracemalloc.start()
                    try:
                        status, _, body = request()
                        _, peak = tracemalloc.get_traced_memory()
                    finally:
                        tracemalloc.stop()
                    self.assertEqual(status, 200)
                    cards = json.loads(body)['memories']
                    if hidden:
                        self.assertEqual(body, b'{"memories": []}')
                    else:
                        self.assertEqual(len(cards), 10)
                        self.assertEqual(sum(len(card['photos']) for card in cards), 1000)
                        for card in cards:
                            self.assertEqual(card['messages'], [dict(name='Alice', time='2020-01-02', text=value)])
                    self.assertLess(peak, 4 * 1024 * 1024)


class AtlasConcurrencyTests(unittest.TestCase):
    def run_mutation(self, mutation):
        fixture = test_capacity.ArchiveCapacityTests()
        fixture.setUp()
        try:
            runs = imported(fixture, 3)
            store = fixture.store
            assets = [row[0] for row in store.db.execute('SELECT id FROM archive_assets ORDER BY id')]
            independent = fixture.submit({'independent.png': store.asset_bytes(fixture.alice, assets[0], True)},
                                         user=fixture.ben)
            fixture.process(independent, fixture.ben)
            for row in store.db.execute('SELECT id,owner_id,payload FROM archive_origins').fetchall():
                owner = row['owner_id']
                payload = json.loads(row['payload'])
                payload['context'] = [dict(text='Alice context' if owner == fixture.alice else 'Ben context',
                                           sender=dict(label='Alice' if owner == fixture.alice else 'Ben'), shared_at=None)]
                store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
                store.db.commit()
                store.set_place(owner, row['id'], 'NL', 'Amsterdam' if owner == fixture.alice else 'Utrecht', 52.0, 5.0, None)
            event = store.review_event(fixture.alice, fixture.group, assets[:2], 'Private event', 'accept')
            writer = MemoryStore(fixture.temp.name)
            try:
                with serving(fixture) as request:
                    before = request()
                    self.assertEqual(before[0], 200)
                    self.assertIn(b'Private event', before[2])
                    entered, release, attempted, done = (threading.Event() for _ in range(4))
                    original = store._date_place_evidence
                    readers, errors = [], []

                    def pause(*args, **kwargs):
                        value = original(*args, **kwargs)
                        if not entered.is_set():
                            entered.set()
                            if not release.wait(10):
                                raise AssertionError('Atlas transaction was not released')
                        return value

                    def read():
                        try:
                            readers.append(request())
                        except BaseException as exc:
                            errors.append(exc)

                    def write():
                        writer.db.set_trace_callback(lambda sql: attempted.set() if sql == 'BEGIN IMMEDIATE' else None)
                        try:
                            if mutation == 'withdrawal':
                                writer.withdraw(fixture.alice, runs[0])
                            elif mutation == 'reader_removal':
                                writer.remove_member(fixture.alice, fixture.group, fixture.ben)
                            elif mutation == 'hide':
                                writer.hide(fixture.ben, assets[0], True)
                            elif mutation == 'hide_event':
                                writer.hide_event(fixture.ben, fixture.group, event, True)
                            elif mutation == 'correction':
                                writer.correct_asset(fixture.alice, assets[0], title='Updated title',
                                                     capture_date='2025-04-06', place='Paris')
                            else:
                                raise AssertionError(mutation)
                        except BaseException as exc:
                            errors.append(exc)
                        finally:
                            writer.db.set_trace_callback(None)
                            done.set()

                    reader_thread = threading.Thread(target=read, daemon=True)
                    writer_thread = threading.Thread(target=write, daemon=True)
                    with patch.object(store, '_date_place_evidence', pause):
                        try:
                            reader_thread.start()
                            self.assertTrue(entered.wait(10))
                            self.assertTrue(store.db.in_transaction)
                            writer_thread.start()
                            self.assertTrue(attempted.wait(10))
                            self.assertFalse(done.wait(.1), 'Mutation committed inside the Atlas policy snapshot')
                        finally:
                            release.set()
                            reader_thread.join(10)
                            if writer_thread.ident is not None:
                                writer_thread.join(10)
                    self.assertFalse(reader_thread.is_alive())
                    self.assertFalse(writer_thread.is_alive())
                    self.assertEqual(errors, [])
                    self.assertEqual(readers[0][0], 200)
                    self.assertEqual(readers[0][2], before[2])
                    after = request()
                    if mutation == 'reader_removal':
                        self.assertEqual(after[0], 403)
                    else:
                        self.assertEqual(after[0], 200)
                        self.assertNotEqual(after[2], before[2])
                        cards = json.loads(after[2])['memories']
                        if mutation == 'withdrawal':
                            expected = photo(assets[0])
                            expected['photos'][0]['alt'] = 'Archive photograph'
                            expected['messages'] = [dict(name='Ben', time='', text='Ben context')]
                            expected['people'] = dict(shared=['Ben'], conversation=['Ben'])
                            expected['place'] = dict(name='Utrecht', country='NL', latitude=52.0, longitude=5.0)
                            self.assertEqual(after[2], json.dumps({'memories': [expected]}).encode())
                        elif mutation == 'hide':
                            self.assertEqual([card['id'] for card in cards], ['photo-' + assets[2], 'photo-' + assets[1]])
                        elif mutation == 'hide_event':
                            self.assertEqual([card['id'] for card in cards], ['photo-' + assets[2]])
                        elif mutation == 'correction':
                            memory = next(card for card in cards if card['id'] == event)
                            self.assertEqual((memory['date'], memory['year'], memory['approximate']), ('2025-04-06', 2025, True))
                            self.assertEqual(memory['dateBasis'], 'reviewed correction, undated')
                            self.assertEqual(memory['photos'][0]['caption'], 'Updated title')
            finally:
                writer.close()
        finally:
            fixture.tearDown()

    def test_policy_mutations_wait_for_http_snapshot_and_next_request_is_fresh(self):
        for mutation in ('withdrawal', 'reader_removal', 'hide', 'hide_event', 'correction'):
            with self.subTest(mutation=mutation):
                self.run_mutation(mutation)


if __name__ == '__main__':
    unittest.main()
