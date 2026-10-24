"""Live approved-memory projections; no generated or cached archive content."""
import json
from mazi.persistence import initialize_schema

import uuid
from mazi.identity.core import Conflict, Denied
from mazi.discovery.discovery import text
from mazi.answers.answers import AnswerStore
from .advanced import AdvancedMixin, SCHEMA as ADVANCED_SCHEMA

SCHEMA = '''
CREATE TABLE IF NOT EXISTS advanced_stories (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL, event_id TEXT NOT NULL,
 owner TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS story_contributions (
 story TEXT NOT NULL REFERENCES advanced_stories(id) ON DELETE CASCADE,
 author TEXT NOT NULL, content TEXT NOT NULL, PRIMARY KEY(story,author));
CREATE TRIGGER IF NOT EXISTS story_departure AFTER DELETE ON members BEGIN
 UPDATE advanced_stories SET revision=revision+1 WHERE group_id=OLD.group_id
 AND id IN (SELECT story FROM story_contributions WHERE author=OLD.user_id);
 DELETE FROM story_contributions WHERE story IN
 (SELECT id FROM advanced_stories WHERE group_id=OLD.group_id AND owner=OLD.user_id);
 DELETE FROM story_contributions WHERE author=OLD.user_id AND story IN
 (SELECT id FROM advanced_stories WHERE group_id=OLD.group_id);
 DELETE FROM advanced_stories WHERE group_id=OLD.group_id AND owner=OLD.user_id;
END;
'''


class MemoryStore(AdvancedMixin, AnswerStore):
    def __init__(self, root, encoder=None):
        super().__init__(root, encoder)
        initialize_schema(self.db, SCHEMA)
        initialize_schema(self.db, ADVANCED_SCHEMA)

    def _approved(self, user, group):
        self._member(user, group)
        visible = set(self._visible_ids(user, group))
        events = self.accepted_events(user, group)
        # A title or contribution can describe any original member of the event.
        # Suppress the entire memory when even one original asset is unavailable.
        return [event for event in events if set(json.loads(self.db.execute(
            'SELECT asset_ids FROM review_events WHERE id=?', (event['id'],)).fetchone()[0])) <= visible]

    def recap(self, user, group, year):
        if type(year) is not int or not 1 <= year <= 9999:
            raise ValueError('Choose a year between 1 and 9999')
        with self.transaction():
            events = self._approved(user, group)
            items, offset = {}, 0
            while True:
                page = self.timeline(user, group, offset=offset, limit=100)
                items.update((item['id'], item) for item in page['items'])
                if page['next_offset'] is None: break
                offset = page['next_offset']
            memories = []
            for event in events:
                dates = [items.get(asset, {}).get('date') for asset in event['assets']]
                if not dates or any(not day or int(day[:4]) != year for day in dates): continue
                memories.append(dict(id=event['id'], title=event['title'], start=min(dates), end=max(dates),
                                     assets=[items[asset] for asset in event['assets']]))
            memories.sort(key=lambda event: (event['start'], event['id']))
            return dict(year=year, memories=memories, coverage='Only approved, fully visible memories with all recorded dates in this year. Undated, conflicting and cross-year memories are omitted. This archive is incomplete.',
                        provider_cost_eur=0)

    def _story(self, user, group, story):
        story = text(story, 100)
        events = {event['id']: event for event in self._approved(user, group)}
        row = self.db.execute('SELECT * FROM advanced_stories WHERE id=? AND group_id=?', (story, group)).fetchone()
        if row is None or row['event_id'] not in events:
            raise Denied('Story unavailable')
        return row, events[row['event_id']]

    def story(self, user, group, story):
        with self.transaction():
            return self._story_view(user, group, story)

    def _story_view(self, user, group, story):
        row, event = self._story(user, group, story)
        contributions = [dict(author=r['author'], text=r['content'], editable=r['author'] == user)
                         for r in self.db.execute('SELECT author,content FROM story_contributions WHERE story=? ORDER BY author', (story,))]
        sections = self.db.execute('SELECT payload FROM story_subevents WHERE story=?', (story,)).fetchone()
        return dict(subevents=json.loads(sections[0]) if sections else [], id=row['id'], event=event, revision=row['revision'], can_delete=row['owner'] == user,
                    contributions=contributions, notice='Member recollections, not verified historical claims. Shared with current group members.')

    def stories(self, user, group):
        with self.transaction():
            allowed = {event['id'] for event in self._approved(user, group)}
            ids = [r['id'] for r in self.db.execute('SELECT id,event_id FROM advanced_stories WHERE group_id=? ORDER BY id', (group,)) if r['event_id'] in allowed]
            return [self._story_view(user, group, story) for story in ids]

    def create_story(self, user, group, event):
        with self.transaction():
            if event not in {e['id'] for e in self._approved(user, group)}: raise Denied('Memory unavailable')
            return self._story_view(user, group, self._create_story(user, group, event))

    def _create_story(self, user, group, event):
        if self.db.execute('SELECT count(*) FROM advanced_stories WHERE group_id=?', (group,)).fetchone()[0] >= 100:
            raise Conflict('Local limit of 100 stories reached')
        story = str(uuid.uuid4())
        self.db.execute('INSERT INTO advanced_stories VALUES(?,?,?,?,1)', (story, group, event, user))
        self._audit(user, 'story.create', story)
        return story

    def _revision(self, row, revision):
        if type(revision) is not int or revision < 1: raise ValueError('Invalid revision')
        if row['revision'] != revision: raise Conflict('Story changed; refresh before editing')

    def write_story(self, user, group, story, revision, content):
        content = text(content, 2000)
        with self.transaction():
            row, _ = self._story(user, group, story)
            self._revision(row, revision)
            self._write_contribution(user, story, content)
            return self._story_view(user, group, story)

    def _write_contribution(self, user, story, content):
        if content:
            self.db.execute('INSERT INTO story_contributions VALUES(?,?,?) ON CONFLICT(story,author) DO UPDATE SET content=excluded.content', (story, user, content))
        else:
            self.db.execute('DELETE FROM story_contributions WHERE story=? AND author=?', (story, user))
        self.db.execute('UPDATE advanced_stories SET revision=revision+1 WHERE id=?', (story,))
        self._audit(user, 'story.contribute', story)

    def _event_notebook(self, user, group, event):
        if event not in {item['id'] for item in self._approved(user, group)}:
            raise Denied('Memory unavailable')
        sections = []
        for story in self.db.execute('SELECT id,revision FROM advanced_stories WHERE group_id=? AND event_id=? ORDER BY id', (group, event)):
            notes = []
            for note in self.db.execute('SELECT c.author,c.content,p.display_name FROM story_contributions c LEFT JOIN shared_profiles p ON p.user_id=c.author WHERE c.story=? ORDER BY c.author', (story['id'],)):
                target = dict(kind='saved', storyId=story['id'], revision=story['revision'])
                notes.append(dict(id=story['id'] + ':' + note['author'], authorName=note['display_name'] or 'Group member', text=note['content'],
                                  ownership=dict(kind='mine', target=target) if note['author'] == user else dict(kind='other')))
            sections.append(dict(id=story['id'], notes=notes))
        return dict(eventId=event, sections=sections)

    def event_notebook(self, user, group, event):
        event = text(event, 100)
        with self.transaction():
            return self._event_notebook(user, group, event)

    def write_event_note(self, user, group, event, target, content):
        event, content = text(event, 100), text(content, 2000)
        if not isinstance(target, dict) or target.get('kind') not in ('new', 'saved'):
            raise ValueError('Invalid note target')
        with self.transaction():
            notebook = self._event_notebook(user, group, event)
            if target['kind'] == 'new':
                if not content: raise ValueError('Write a recollection before saving')
                if any(note['ownership']['kind'] == 'mine' for section in notebook['sections'] for note in section['notes']):
                    raise Conflict('Your note was already saved; refresh before editing')
                story = notebook['sections'][0]['id'] if notebook['sections'] else self._create_story(user, group, event)
            else:
                story = text(target.get('storyId'), 100)
                row, approved = self._story(user, group, story)
                if approved['id'] != event: raise Denied('Note unavailable')
                self._revision(row, target.get('revision'))
                if not self.db.execute('SELECT 1 FROM story_contributions WHERE story=? AND author=?', (story, user)).fetchone():
                    raise Conflict('Your note is no longer saved; refresh before editing')

            self._write_contribution(user, story, content)
            return self._event_notebook(user, group, event)

    def delete_story(self, user, group, story, revision):
        with self.transaction():
            row, _ = self._story(user, group, story)
            if row['owner'] != user: raise Denied('Only the creator can delete this story')
            self._revision(row, revision)
            self.db.execute('DELETE FROM story_contributions WHERE story=?', (story,))
            self.db.execute('DELETE FROM advanced_stories WHERE id=?', (story,))
            self._audit(user, 'story.delete', story)
