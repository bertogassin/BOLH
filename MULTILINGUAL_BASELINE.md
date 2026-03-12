# Multilingual Baseline (90+ locales)

This repository follows a multilingual-by-default policy for user-facing surfaces and documentation.

## Target locale families

- European
- Asian
- Caucasian
- Global fallback set for cross-region access

## Baseline locale set

`en, ru, uk, be, pl, cs, sk, sl, hr, sr, bs, bg, mk, ro, hu, de, fr, it, es, pt, nl, sv, no, da, fi, is, et, lv, lt, el, sq, mt, ga, cy, eu, gl, ca, tr, az, hy, ka, ce, ab, os, ar, he, fa, ku, ur, hi, bn, pa, gu, mr, ta, te, kn, ml, si, ne, my, km, lo, th, vi, id, ms, tl, zh, ja, ko, mn, kk, uz, ky, tg, tk, af, sw, am, so, yo, ig, ha, zu, xh, st, tn, sn, rw, rn, mg, mi, sm, fj, to, haw, la`

## Implementation notes

- Core curated translations remain high-priority for strategic languages.
- Additional locales can use machine-translation fallback for first-pass coverage.
- Final product-critical strings should receive human QA per release.