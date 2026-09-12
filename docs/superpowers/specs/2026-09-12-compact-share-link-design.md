# Compact Share Link — Design

## Goal

Shorten the generated share link so it reads as a normal, trustworthy link
instead of a long block of gibberish, without weakening Little Hello's
existing privacy guarantee: all card content stays client-side, encoded only
in the URL itself. No backend, no third-party URL shortener, no card-content
API — sending the link's payload to any external service (e.g. TinyURL,
is.gd) would mean a third party permanently stores the recipient's name and
message, which conflicts with the "no card-content API" principle in the
README. This design gets the length win entirely through better encoding.

## Approach

Two independent savings, both purely client-side:

1. **Short JSON keys** instead of the current verbose ones
   (`template`/`to`/`message`/`from`/`messageFont`).
2. **Deflate compression** of the JSON via the browser-native
   `CompressionStream('deflate-raw')` / `DecompressionStream('deflate-raw')`
   APIs before base64url-encoding. No new dependency, consistent with this
   project's existing preference for native browser APIs over libraries.

Measured on a representative card (template `birthday-garden-bloom`-length
id, a ~120-character message, `to`/`from`, a message font): current payload
produces a **351-character** full URL; short keys + compression produce
**225 characters** (~36% shorter). Short messages see a smaller but still
positive gain (~15%) since compression has fixed per-payload overhead.

## Versioning & routing

New format: `#/card/v2/<payload>`. Existing links stay `#/card/<payload>`
(no version segment). This is a deliberate explicit marker rather than a
"try to decompress, fall back on failure" heuristic — unambiguous, and it
means the decode path never has to guess.

- `decodeCardHash` recognizes both:
  - `#/card/<payload>` → legacy v1 decode (raw JSON, verbose keys, no
    compression) — unchanged behavior, forever. Links already shared by
    users must keep working.
  - `#/card/v2/<payload>` → new decode (compact keys, deflate-compressed).
- `createCardUrl` / `encodeCard` always produce v2 going forward. There is
  no UI or setting to produce a v1 link.
- The internal `v` field is dropped from the v2 JSON payload (the path
  segment already carries the version, so the field would be redundant
  bytes). The v1 JSON shape is untouched.

## Payload shape (v2)

Short keys, in a fixed field order (order doesn't matter for correctness,
listed here for reference):

| Old key       | New key | Notes                                   |
|---------------|---------|------------------------------------------|
| `template`    | `t`     | numeric code, see registry below         |
| `to`          | `n`     | string, unchanged validation (≤60 chars) |
| `message`     | `m`     | string, unchanged validation (≤500 chars)|
| `from`        | `f`     | string, unchanged validation (≤60 chars) |
| `messageFont` | `mf`    | numeric code, omitted when absent        |

### Template ID registry (immutable, append-only)

Mirrors the existing rule that "released template IDs are immutable public
identifiers" (README) — the numeric codes get the same guarantee: once
assigned, a code is never reused or reassigned, even if the template is
later removed from the active gallery. New templates append the next
integer.

```
0 = birthday-confetti-01
1 = birthday-sunshine-01
2 = birthday-party-01
3 = thank-you-bloom-01
4 = thank-you-sincere-01
5 = congratulations-bright-01
6 = love-together-01
7 = love-letter-01
8 = just-because-doodle-01
```

This table lives as a single ordered array in `src/card/codec.ts` (e.g.
`TEMPLATE_CODES: string[]`); `indexOf` encodes, array access decodes. Adding
a template = pushing a new entry at the end, never editing existing indices.

### Message font ID registry (immutable, append-only)

Same rule, same mechanism, separate array (`FONT_CODES: string[]`):

```
0 = caveat
1 = dancing-script
2 = cormorant
3 = dm-serif
4 = libre-baskerville
5 = quicksand
6 = satisfy
7 = space-grotesk
```

## Encode/decode flow

`encodeCard` and `decodeCardPayload`/`decodeCardHash` become `async`
(`CompressionStream`/`DecompressionStream` are stream-based, no sync API
exists). Concretely:

- Encode: build the short-keyed object → `JSON.stringify` → UTF-8 bytes →
  pipe through `new CompressionStream('deflate-raw')` → collect bytes →
  base64url.
- Decode (v2 branch): base64url → bytes → pipe through
  `new DecompressionStream('deflate-raw')` → collect bytes → UTF-8 →
  `JSON.parse` → same field validation that already exists today (length
  caps, template/font lookup, unknown template → `missing-template`,
  anything else malformed → `invalid`). A stream that isn't valid
  deflate-raw throws during decompression, caught the same way a bad
  `JSON.parse` is caught today, and mapped to `{ ok: false, reason:
  'invalid' }`.
- Decode (v1 branch): exactly the current `decodeCardPayload` logic, kept
  as-is under the old routing path.

No fallback path for browsers lacking `CompressionStream` is included —
support is effectively universal across current Chrome/Firefox/Safari/Edge.
This is the one real bet in this design: if a share recipient is on a very
old/unusual browser, decoding a v2 link would fail (reject the entire link,
not the specific field) rather than degrade. Flagging this explicitly since
it's a trade-off rather than a strict improvement.

## `App.tsx` impact

- `copyLink()` and `shareCard()` already `async` — just `await
  createCardUrl(...)` instead of calling it synchronously.
- The live "Share link" field currently computes `currentUrl` inline in
  render (`App.tsx:169`), which can't work once encoding is async. Replace
  with:
  - `const [shareUrl, setShareUrl] = useState('')`
  - A `useEffect` keyed on `[draft, selectedTemplate.id]` that calls the
    async `createCardUrl`, and writes the result into `shareUrl` — guarded
    by a ref-based generation counter (increment on each effect run, only
    apply the result if it's still the latest) so a fast typist never sees
    a stale computation overwrite a newer one.
  - Render `shareUrl` in the existing read-only input in place of
    `currentUrl`; on first mount before the effect resolves it's the empty
    string, matching today's SSR-safe empty-string fallback.

## Error handling

No behavior change in shape: both branches still resolve to the existing
`DecodeResult` union (`{ ok: true, card }` or `{ ok: false, reason }`), and
the shared-card error view (`sharedResult && !sharedResult.ok`) is untouched.

## Testing

Extend `tests/e2e/smoke.spec.ts` (this repo has no unit-test framework —
Playwright is the existing and continuing test surface):

- A hardcoded legacy `#/card/<payload>` URL (captured from today's format)
  still decodes and renders correctly — proves v1 links already shared by
  users keep working.
- Creating and sharing a new card produces a `#/card/v2/<payload>` URL.
- That new URL, round-tripped through `page.goto`, reconstructs the same
  `to`/`message`/`from`/template/font as the original draft.
- A corrupted v2 payload (`/#/card/v2/not-valid`) hits the existing
  malformed-URL error view without crashing, same as the existing
  `not-a-valid-card` v1 test.
- Regression: full existing suite continues to pass (editor, preview,
  download, share, font selection, offline/PWA).

## Out of scope (for this iteration)

- Any third-party URL shortener integration (rejected — see Goal).
- QR-code sharing as an alternative surface (considered, deferred: target
  users are non-technical and already comfortable pasting/sharing links;
  QR adds a scanning step without unfurling into a link preview the way a
  pasted URL does in messaging apps).
- A custom short domain (e.g. replacing `username.github.io/ecards/`) —
  this is a DNS/purchasing decision outside of this codebase, not a code
  change.
- A fallback encoding path for browsers without `CompressionStream`.
