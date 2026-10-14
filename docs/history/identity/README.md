# Local memory-loop experiment

Historical experiment record. The active application now runs with `python -m mazi`; source and test links below point to their consolidated locations. Original acceptance claims and evidence remain historical.

This is a local, single-process experiment for a private review loop. It predates the confirmed M0 decision to share successful manual imports automatically with the group. Its publication policy therefore does not implement the current M1 product contract. It is not a production deployment or the chosen Next.js/Supabase stack.

Run with Python 3.11 or newer after installing the image dependency:

```sh
python3 -m pip install -r mazi/requirements.txt
python3 -m mazi
```

Open `http://127.0.0.1:8000`. Data is stored under `.mazi-pilot/` by default. Set `MAZI_DATA_DIR` to select another private data directory. Do not put real personal archives in this pilot.

Run the behavior tests with `python3 -m unittest discover -s tests/backend/identity -t .`.

Implemented: local accounts and sessions; private groups; expiring, revocable single-use invitations; owner-only staging; resumable JPEG/PNG uploads with checksums, size validation, progress, and metadata-stripped previews; original preservation; manual origins; draft memories; component-specific media publication; selected-member or group audiences; timeline paging; visible title/caption search; revocation and deletion; contributor grant revocation on membership removal; and a JSON export of metadata visible to the requesting member. The browser lets an owner review components and recipients before publication.

The upload form resumes an interrupted transfer when the same browser selects the same file again. The transfer record and temporary bytes are stored in the private data directory. Original downloads require a separate grant. The JSON export does not bundle original files.

This remains an internal pilot, not completion of the roadmap's M1 gate. Video processing, sub-events, Today, source capture-time evidence, production database and object-storage authorization, complete recovery and account lifecycle, accessibility verification, and the ten-photo browser demonstration remain open. Do not use real personal archives or expose this server beyond localhost.
