insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('m0-originals', 'm0-originals', false, array['image/jpeg', 'image/png'], 26214400)
on conflict (id) do update
set public = false,
    allowed_mime_types = excluded.allowed_mime_types,
    file_size_limit = excluded.file_size_limit;
