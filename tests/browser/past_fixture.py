"""Historical content seeded through the offline domain, never retired app APIs."""
import base64
import io
import time
from datetime import datetime, timezone
from PIL import Image


def seed_past_creations(store, alice, group):
    event = store.reviewed_events(alice, group)[0]['id']
    story = store.create_story(alice, group, event)
    store.write_story(alice, group, story['id'], story['revision'], '<img src=x onerror=alert(1)> Historical summer recollection.')
    now = time.time()
    image = io.BytesIO()
    Image.new('RGB', (80, 60), 'purple').save(image, 'JPEG')
    photo = base64.b64encode(image.getvalue()).decode()
    date = lambda value: datetime.fromtimestamp(value, timezone.utc).isoformat()
    store._now = lambda: now - 7200
    store.seal_capsule(alice, group, 'Historical opened capsule', 'A note from our shared past.', date(now - 3600), photo)
    store._now = lambda: now
    for screen in ['desktop', 'phone']:
        profile, token = store.enter_shared(code='synthetic-shared-code', name='Past ' + screen)
        store.complete_introduction(token)
        own = store.create_story(profile['user_id'], group, event)
        store.write_story(profile['user_id'], group, own['id'], own['revision'], 'Historical own ' + screen)
        store.seal_capsule(profile['user_id'], group, 'Sealed title ' + screen, 'Sealed secret ' + screen, date(now + 3600), photo)
