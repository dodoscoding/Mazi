INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES('mazi-private', 'mazi-private', false, 52428800, ARRAY['application/octet-stream'])
ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,
    public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;
