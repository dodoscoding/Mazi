# M1 internal pilot

This is a local, single-process pilot for the first private memory loop. It is not a production deployment or the proposed Next.js/Supabase stack. It provides a concrete implementation to exercise the M1 permissions and review flow while the M0 architecture and privacy decisions remain open.

Run with Python 3.11 or newer after installing the image dependency:

```sh
python3 -m pip install -r phase1/requirements.txt
python3 -m phase1.server
```

Open `http://127.0.0.1:8000`. Data is stored under `.mazi-pilot/` by default. Set `MAZI_DATA_DIR` to select another private data directory. Do not put real personal archives in this pilot.

Run the behavior tests with `python3 -m unittest discover -s phase1/tests`.

Implemented: local accounts, sessions, private groups, expiring single-use invitations, owner-only staging, JPEG/PNG upload with metadata-stripped previews, draft memories, component-specific publication, group timeline, title search, and revocation. These cover a narrow internal happy path and selected denied-access checks. Resumable upload, video, source provenance, comprehensive recovery, account deletion/export, accessibility review, and production authorization/storage tests remain for M1.
