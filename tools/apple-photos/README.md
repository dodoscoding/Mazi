# Apple Photos companion

This foreground macOS helper transfers selected Photos resources into the unified local Mazi archive. It retains the existing permission, source scope and resumable transfer contract; it is not a separate archive app.

Run `sh tools/apple-photos/build.sh`, then open `tools/apple-photos/build/MaziPhotos.app` after starting Mazi. The default app URL is `http://127.0.0.1:5173`, matching `npm run dev` and `npm start`. Browser and companion requests use the same API through that origin.

For a custom local port, launch the executable with the matching URL:

```sh
MAZI_APP_URL=http://127.0.0.1:8005 tools/apple-photos/build/MaziPhotos.app/Contents/MacOS/MaziPhotos
```

Only HTTP loopback URLs are accepted (`127.0.0.1`, `localhost`, or `::1`), with no credentials, query or fragment. Direct `python -m mazi` uses port 8005 unless `MAZI_IMPORT_PORT` overrides it. Keep the companion foreground during selection and transfer.

The historical [source implementation and verification](../../docs/history/sources/README.md) remain separate from current acceptance. The consolidated helper was built and signed locally on 14 October 2026; representative Photos-library/device verification remains open.
