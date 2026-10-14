# Map data

Historical experiment record. The active application now runs with `python -m mazi`; source and test links below point to their consolidated locations. Original acceptance claims and evidence remain historical.

The bundled `land.geojson` is Natural Earth's 1:110m land geometry, downloaded 13 October 2026 from the [maintainer repository](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson). Natural Earth places this data in the [public domain](https://www.naturalearthdata.com/about/terms-of-use/).

The local SVG renderer uses an equirectangular projection. There are no remote tiles, geocoding requests or transmitted user coordinates. Country and city are contributor-entered labels, not reverse-geocoder assertions. The geometry is a low-resolution overview, not a navigation map. Paths crossing the date line are omitted rather than drawn across the world.
