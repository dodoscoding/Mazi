# Map data

Historical experiment record. The active application now runs with `python -m mazi`; source and test links below point to their consolidated locations. Original acceptance claims and evidence remain historical.

The bundled `land.geojson` is Natural Earth's 1:110m land geometry, downloaded 13 October 2026 from the [maintainer repository](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson). Natural Earth places this data in the [public domain](https://www.naturalearthdata.com/about/terms-of-use/).

The bundled `cities.json` is derived by `mazi/sources/build_cities.py` from Natural Earth's 1:10m populated places (7,342 places with English, ASCII and Turkish names, ISO country code, region, centre and population; also public domain). `mazi/places.py` uses it offline to snap EXIF GPS to the nearest city within 100 km and to match city names typed in Review ([D21](../../DECISIONS.md#map-places-from-gps-and-review-23-october-2026)).

The local SVG renderer uses an equirectangular projection. There are no remote tiles, geocoding requests or transmitted user coordinates. GPS pins carry the listed city's centre, not the photograph's coordinates. Manually shared country and city remain contributor-entered labels. The geometry is a low-resolution overview, not a navigation map. Paths crossing the date line are omitted rather than drawn across the world.
