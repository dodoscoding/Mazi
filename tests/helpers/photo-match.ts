export const photoMatches = (ids: string[]) => ({
  asset_ids: ids,
  total: ids.length,
  photo_facets: {
    denominator: ids.length,
    denominator_basis: "all currently visible photographs",
    person: [],
    years: [],
    places: [],
    people_present: [{ value: "unknown", count: ids.length }],
    screenshot: [{ value: "unknown", count: ids.length }],
    ai: [{ value: "unknown", count: ids.length }],
  },
  facets: { sources: [], shared_by: [] },
});
