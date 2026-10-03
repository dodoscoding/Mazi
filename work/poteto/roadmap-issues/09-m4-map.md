Planning status on 2 October 2026. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is the Map row in [docs/SPEC.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/SPEC.md) and the Map bullet in [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md) M4. Depends on the M3 launch. Does not depend on the native companion. `PROJECT_PLAN.md` mentions MapLibre. That library is not accepted until M0 reconciles the stack.

## Outcome

A member can explore authorized places, filter by country or city, and optionally see travel paths drawn only from places they are allowed to see. A photo without a shared location adds no point.

## Scope

- Map of authorized places.
- Country and city filters.
- Optional travel paths from visible places only.

Hidden GPS from the publish step must stay off the map. Viewing a photo still does not grant embedded GPS.

## UI steps

1. The member opens Map from primary navigation only after this milestone ships. Until then the destination is absent, not a disabled teaser.
2. Points represent places the member is allowed to know. Clustering does not reveal a hidden point by count.
3. Country and city filters narrow the same authorized set.
4. A travel path, if enabled, connects only visible places. Turning it off removes the path and leaves the points.
5. Selecting a point opens the related memories without exposing a precise location that was not shared.
6. An item with no shared location is simply not on the map. The empty map explains that, especially when Timeline has media and Map does not.

States to design with dodo.

- No shared places yet.
- One city, and a trip that crosses countries.
- A memory whose location was revoked. The point disappears on the next authorized read.
- Dense cities versus a single precise place the member chose to share.
- Narrow layout, keyboard access, and a text alternative for the spatial view.
- Reduced motion for pan and path drawing.

## Design discussion with dodo

Visitor mode is **Operate**. The map is a way to find memories by place. It is not a travel poster.

Impeccable path. Shape this surface after the design-kickoff issue. Settle whether Map is primary navigation before drawing it. The specification includes it. `PROJECT_PLAN.md` also includes it. The kickoff issue owns the final nav set.

### Starting brief

The group member is trying to find a shared trip. Success is a map whose every point and path is already authorized, with a filter that matches Timeline and Search.

### Open decisions for dodo

1. Whether a city-level share and a precise share look different on the map.
2. Whether travel paths are on by default or opt-in. The roadmap says optional. The safer brief is off until the member asks.
3. How the text alternative lists places so the map is not the only way to use this destination.

## Exit

T02 map paths pass for Alice, Ben, Cara, an administrator who is not a recipient, a removed member, and an outsider. No hidden location becomes a point or a count. Map readiness does not wait on the native companion.
