# Photo search and correction verification

A2 is split into a read delivery and a subsequent correction/export delivery. At `88830a7`, new date-basis contracts fail with `TypeError` because Search does not accept `date_basis`. The first two regressions cover sharing-only Discord and conflicting capture evidence in both keyword and related search.

The read contract keeps omitted date basis on legacy capture behavior. Explicit capture and chronology use real evidence days; explicit sharing considers every reliable origin. New Search uses chronology while old dated bookmarks retain omitted-basis semantics until explicitly changed.
