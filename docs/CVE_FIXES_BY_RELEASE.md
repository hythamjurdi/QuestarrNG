# QuestarrNG — CVEs fixed per released tag (v1.2.0 → v1.9.1)

Method: diffed `package.json`/`package-lock.json` at each tag boundary, then cross-checked every bumped package through OSV.dev's `querybatch` endpoint (query old-version vs new-version, take the set difference of returned GHSA IDs) and confirmed exact `fixed` boundaries via per-GHSA `/v1/vulns/{id}` lookups. All headline findings below — including axios, node-forge, and socket.io-parser — were verified through the same batch-diff method, not just by trusting commit messages. Only entries with a confirmed OSV `fixed` event landing inside the bump range are listed as fixes. OSV data was refreshed on 2026-10-04.

Scope note: newly-_added_ dependencies (multer, passport, passport-steam, express-session, rss-parser, js-yaml, node-forge's initial introduction) were checked for CVEs open at their pinned version only where a later bump partially fixed them (multer). Packages that arrived once and were never re-bumped weren't separately audited for pre-existing CVEs unless flagged — this report covers _fixes_, not full current-exposure.

QuestarrNG's v1.5.0 release was not published. Its completed work was included
in v1.6.0, the first published fork release.

## v1.2.0 (from v1.1.0)

- **fast-xml-parser** 5.3.3 → 5.3.4 — fixes **CVE-2026-25128** (GHSA-37qj-frw5-hhjh, HIGH) — RangeError DoS via numeric entities.

## v1.2.1 (from v1.2.0)

- **fast-xml-parser** 5.3.4 → 5.3.5 — fixes **CVE-2026-25896** (GHSA-m7jm-9gc2-mpf2, CRITICAL) — entity-encoding bypass via regex injection in DOCTYPE entity names.

## v1.2.2 (from v1.2.1)

- **fast-xml-parser** 5.3.5 → 5.3.7 — fixes **CVE-2026-26278** (GHSA-jmr7-xgp7-cmfj, HIGH) — DoS via entity expansion in DOCTYPE (no expansion limit).

## v1.3.0 (from v1.2.2) — largest security-relevant release

- **fast-xml-parser** 5.3.7 → 5.7.1 — fixes 4 CVEs:
  - **CVE-2026-33036** (GHSA-8gc5-j5rx-235r, HIGH) — numeric entity expansion bypassing all expansion limits (incomplete fix for CVE-2026-26278)
  - **CVE-2026-27942** (GHSA-fj3w-jwp8-x2g3, LOW) — stack overflow in XMLBuilder with `preserveOrder`
  - **CVE-2026-41650** (GHSA-gh4j-gqv2-49f6, MODERATE) — XML Comment/CDATA injection via unescaped delimiters
  - **CVE-2026-33349** (GHSA-jp2q-39xq-3w4g, MODERATE) — entity expansion limit bypassed when set to `0` (JS falsy-evaluation bug)
- **node-forge** 1.3.3 → 1.4.0 — fixes 4 CVEs:
  - **CVE-2026-33896** (GHSA-2328-f5f3-gj25, HIGH) — `basicConstraints`/RFC 5280 cert-chain validation bypass
  - **CVE-2026-33891** (GHSA-5m6q-g25r-mvwx, HIGH) — DoS via `BigInteger.modInverse(0)` infinite loop
  - **CVE-2026-33894** (GHSA-ppp5-5v6c-4jwp, HIGH) — RSA-PKCS1 v1.5 signature forgery (Bleichenbacher-style)
  - **CVE-2026-33895** (GHSA-q67f-28xg-22rw, HIGH) — Ed25519 signature malleability (missing canonical-scalar check)
- **socket.io-parser** (npm `overrides` pin) 4.2.5 → 4.2.6 — fixes **CVE-2026-33151** (GHSA-677m-j7p3-52f9, HIGH) — unbounded binary attachments DoS
- **drizzle-orm** 0.45.1 → 0.45.2 — fixes **CVE-2026-39356** (GHSA-gpj5-g38j-94v9, HIGH) — SQL injection via improperly escaped SQL identifiers
- **express-rate-limit** 8.2.1 → 8.3.2 — fixes **CVE-2026-30827** (GHSA-46wh-pxpv-q5gq, HIGH) — IPv4-mapped IPv6 addresses bypass per-client rate limiting on dual-stack servers
- **multer** 2.0.2 → 2.1.1 — fixes 3 of 5 CVEs present since multer's introduction in v1.2.1:
  - **CVE-2026-3520** (GHSA-5528-5vmv-3xc2, HIGH) — DoS via uncontrolled recursion
  - **CVE-2026-2359** (GHSA-v52c-386h-88mc, HIGH) — DoS via resource exhaustion
  - **CVE-2026-3304** (GHSA-xf7r-hgr6-v32p, HIGH) — DoS via incomplete cleanup
  - ⚠️ Still open at 2.1.1 (fix requires multer ≥2.2.0, not yet adopted as of v1.3.1): CVE-2026-5038 (GHSA-3p4h-7m6x-2hcm, MODERATE) and CVE-2026-5079 (GHSA-72gw-mp4g-v24j, HIGH)

## v1.3.1 (from v1.3.0)

No dependency bump in this release crosses a `fixed` OSV boundary — purely maintenance/feature updates.

## v1.4.0 (From v1.3.1)

- **js-yaml** 4.1.1 → 5.2.1 — fixes **CVE-2026-53550** (GHSA-h67p-54hq-rp68, MODERATE) — quadratic-complexity DoS in merge-key handling via repeated aliases. (Three separate devDep-tooling nested copies — under `eslint`'s `@eslint/eslintrc`, `textlint`'s `linter-formatter`, and `rc-config-loader` — resolve independently to `4.3.0`; that's past the `4.2.0` fix boundary for this CVE, so they were never vulnerable and aren't a fix to attribute.)
- **multer** 2.1.1 → 2.2.0 — fixes the 2 CVEs left open in the v1.3.0 report:
  - **CVE-2026-5038** (GHSA-3p4h-7m6x-2hcm, MODERATE) — DoS via incomplete cleanup of aborted uploads
  - **CVE-2026-5079** (GHSA-72gw-mp4g-v24j, HIGH) — DoS via deeply nested field names
- **form-data** (transitive, resolved 4.0.5 → 4.0.6) — fixes **CVE-2026-12143** (GHSA-hmw2-7cc7-3qxx, HIGH) — CRLF injection via unescaped multipart field names/filenames.
- **ws** (transitive, resolved 8.18.3 → 8.21.0) — fixes 2 CVEs:
  - **CVE-2026-45736** (GHSA-58qx-3vcg-4xpx, MODERATE) — uninitialized memory disclosure
  - **CVE-2026-48779** (GHSA-96hv-2xvq-fx4p, HIGH) — memory exhaustion DoS from tiny fragments/data chunks
- **qs** (transitive, resolved 6.14.2 → 6.15.2; pulled in by `body-parser`/`express`, and separately by `openid`/`steam-web`/`superagent`) — fixes **CVE-2026-8723** (GHSA-q8mj-m7cp-5q26, MODERATE) — `qs.stringify` throws an uncaught `TypeError` (remotely-triggerable DoS) on `null`/`undefined` array entries when `encodeValuesOnly` is set. Confirmed fix boundary via OSV: vulnerable range is `introduced: 6.11.1`, `fixed: 6.15.2` — the resolved-at-v1.3.1 version 6.14.2 falls inside it.
- **brace-expansion** (transitive, dedup'd across multiple resolutions) — fixes **CVE-2026-45149** (GHSA-jxxr-4gwj-5jf2, MODERATE) — a crafted large numeric range (e.g. `{1..999999999999}`) defeats the library's documented DoS protection. At v1.3.1 the lockfile carried four parallel resolutions from different dependency chains: `1.1.13`, `2.0.3`, and two under the `minimatch` family, `5.0.5` and `5.0.6`. Verified each individually against OSV — only `5.0.5` fell inside the vulnerable range (fixed at `5.0.6`); the other three were already safe. By HEAD, dependency resolution consolidates everything onto the already-patched `5.0.7`/`1.1.14`, so there's no longer a vulnerable resolution anywhere in the tree. (The `1.1.13→1.1.14` hop on the legacy `minimatch@3.x` chain carries no CVE fix of its own — it's incidental to this consolidation.)
- **esbuild** (devDep) 0.28.0 → 0.28.1 — fixes GHSA-g7r4-m6w7-qqqr (no CVE assigned) — the Windows dev-server arbitrary-file-read issue flagged as still-open in the v1.2.1/v1.3.0 entries is now fixed.
- **esbuild, nested copy** — the new npm `overrides` entry (`@esbuild-kit/core-utils` → `esbuild ^0.25.0`) bumps that dependency's bundled esbuild from 0.18.20 to 0.25.12, fixing GHSA-67mh-4wv8-2f99 (no CVE, MODERATE — dev server accepts arbitrary cross-origin requests). Separately, `tsx`'s own duplicate nested esbuild copy (0.27.7, carrying the same GHSA-g7r4-m6w7-qqqr as above) was deduped away entirely by this bump round rather than upgraded.
- **vite** (devDep) 8.0.12 → 8.1.4 — fixes both issues left open in the v1.3.0 report:
  - **CVE-2026-53571** (GHSA-fx2h-pf6j-xcff, HIGH) — `server.fs.deny` bypass
  - **CVE-2026-53632** (GHSA-v6wh-96g9-6wx3, MODERATE) — launch-editor NTLMv2 hash disclosure via UNC path on Windows

## v1.4.1 (from v1.4.0) — hotfix

- **brace-expansion** (npm `overrides` pin `^5.0.8`, resolved 5.0.9) 5.0.7 → 5.0.9 — fixes 3 HIGH CVEs:
  - **CVE-2026-14257** (GHSA-mh99-v99m-4gvg) — DoS via unbounded expansion length causing an out-of-memory process crash
  - **CVE-2026-13149** (GHSA-3jxr-9vmj-r5cp) — DoS via exponential-time expansion of consecutive non-expanding `{}` groups
  - **CVE-2026-69152** (GHSA-rgw5-rvv9-x895) — DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation
- **fast-xml-parser** 5.10.0 → 5.10.1 — fixes **CVE-2026-73569** (GHSA-8r6m-32jq-jx6q, HIGH) — repeated DOCTYPE declarations reset entity expansion limits.
- **js-yaml** 5.2.1 → 5.2.2 — fixes **CVE-2026-73643** (GHSA-pm4m-ph32-ghv5, HIGH) — exponential parsing time in flow collections leading to denial of service.
- **body-parser** 1.20.5 → 1.20.6 — fixes **CVE-2026-12590** (GHSA-v422-hmwv-36x6, LOW) — an invalid `limit` value silently disabled size enforcement, allowing arbitrarily large request payloads.
- **fast-uri** (npm `overrides` pin, dev-only at the time) 3.1.3 → 3.1.4 — fixes **CVE-2026-16221** (GHSA-v2hh-gcrm-f6hx, HIGH) — host confusion via a literal backslash authority delimiter.
- **minimatch** override pinned to `^10.2.5` — closes a second resolution path for the `brace-expansion` advisories: `eslint-plugin-react`'s bundled `minimatch@3.1.5` still pulled the vulnerable `brace-expansion@1.1.x`. devDependency-only (not shipped in the production image), but flagged by `npm audit` without `--omit=dev`, so pinned for a fully clean audit.

## v1.4.2 (from v1.4.1) — hotfix

Tagged directly off `v1.4.1`, not from `main`; `main` picked up the same fixes independently.

- **ip-address** (transitive, via `express-rate-limit`) 10.2.0 → 10.5.0 — fixes 3 CVEs; no `overrides` pin needed, `express-rate-limit`'s `^8.5.2` range already permitted 10.5.0:
  - **CVE-2026-69192** (GHSA-mwp4-54f8-5fhr, HIGH) — `Address4` decoded leading-zero octets as decimal while resolvers decode them as octal, allowing SSRF and trust-boundary bypass
  - **CVE-2026-54272** (GHSA-22jq-vg5j-6vgg, MODERATE) — misclassification of IPv4-mapped/NAT64 IPv6 addresses
  - **CVE-2026-69198** (GHSA-4xrf-jv44-h6hh, MODERATE) — a CIDR suffix on the parsed address suppressed special-use classification
- **socket.io-parser** (npm `overrides` pin) 4.2.6 → 4.2.7 — fixes **CVE-2026-69185** (GHSA-2m8v-j782-fhvr, HIGH, CVSS 7.5) — zero-attachment memory exhaustion, vulnerable range `4.0.0 - <4.2.7`. Reaches production via `socket.io`/`socket.io-client` (real-time download-progress and notification updates).

## v1.6.0 (first published fork release; changes since v1.4.2)

### Production dependencies

#### HIGH

- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101898 (HIGH): Axios: HTTP/2 adapter bypasses configured DNS lookup and proxy controls
- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101901 (HIGH): Axios: Denial of Service via Unhandled 'error' Event in HTTP/2 ClientHttp2Session Initialization
- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101903 (HIGH): Axios: ReDoS in fromDataURI data: URL parser freezes the Node event loop (DoS)
- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101905 (HIGH): Axios: Node HTTP adapter prototype-pollution gadget allows request socket hijack via inherited createConnection
- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101906 (HIGH): Axios: ReDoS (O(N²)) in shouldBypassProxy host normalization, reachable via untrusted redirect Location
- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101907 (HIGH): Axios: maxRedirects: 0 is not enforced by the fetch adapter, allowing redirect-based SSRF
- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101909 (HIGH): Axios: Prototype Pollution Gadget in axios toFormData Options
- **fast-uri** 3.1.4 → 3.1.7 — fixes CVE-2026-75931 (HIGH): fast-uri vulnerable to host confusion via skipped IDN canonicalization on scheme-relative references
- **fast-uri** 3.1.4 → 3.1.7 — fixes CVE-2026-18446 (HIGH): fast-uri vulnerable to host confusion via backslash authority introducer
- **fast-uri** 3.1.4 → 3.1.7 — fixes CVE-2026-75975 (HIGH): fast-uri vulnerable to server-side request forgery via malformed IPv6 normalization
- **fast-uri** 3.1.4 → 3.1.7 — fixes CVE-2026-75899 (HIGH): fast-uri vulnerable to server-side request forgery via repeated hostname percent-decoding
- **fast-uri** 3.1.4 → 3.1.7 — fixes CVE-2026-76172 (HIGH): fast-uri vulnerable to host confusion via percent-encoded scheme normalization
- **fast-uri** 3.1.4 → 3.1.7 — fixes CVE-2026-84292 (HIGH): fast-uri vulnerable to authority injection via an unvalidated port in serialize
- **js-yaml** 4.3.0/5.2.2 → 4.3.2/5.4.2 — fixes CVE-2026-84375 (HIGH): js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources
- **js-yaml** 4.3.0/5.2.2 → 4.3.2/5.4.2 — fixes GHSA-5p4m-2wfm-xmqj (HIGH): JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported
- **multer** 2.2.0 → 2.4.0 — fixes CVE-2026-82333 (HIGH): multer vulnerable to Denial of Service via oversized array index in field names
- **multer** 2.2.0 → 2.4.0 — fixes CVE-2026-77037 (HIGH): multer vulnerable to Denial of Service via file descriptor leak on aborted uploads
- **multer** 2.2.0 → 2.4.0 — fixes CVE-2026-77078 (HIGH): multer vulnerable to Denial of Service via crafted multipart field names
- **nanoid** 6.0.0/3.3.12 → 6.0.1/3.3.18 — fixes CVE-2026-67214 (HIGH): nanoid: non-secure generators can loop indefinitely with negative size
- **nanoid** 6.0.0/3.3.12 → 6.0.1/3.3.18 — fixes CVE-2026-67213 (HIGH): nanoid: custom generators can loop indefinitely when size is zero
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-13697 (HIGH): undici vulnerable to cross-user information disclosure and parse-time crash via degenerate private cache directives
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-84961 (HIGH): undici vulnerable to TLS certificate validation bypass via dropped connect options in BalancedPool

#### MODERATE

- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101899 (MODERATE): Axios: CIDR-form NO_PROXY entries are ignored, causing proxy exclusion bypass for internal IP ranges
- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101900 (MODERATE): Axios: Fetch Adapter Header Injection via Inherited FormData getHeaders
- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101902 (MODERATE): Axios: Prototype-Pollution Gadget in the Default Instance Allows Inherited Object.prototype.method to Override HTTP Method
- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101904 (MODERATE): Axios: Header Injection via Inherited headers After Minimal Interceptor
- **axios** 1.18.1 → 1.20.0 — fixes CVE-2026-101908 (MODERATE): Axios: Prototype pollution gadget in fetch adapter can alter outbound requests
- **ip-address** 10.5.0 → 10.7.2 — fixes CVE-2026-101910 (MODERATE): ip-address: no classifier recognizes the NAT64 local-use range 64:ff9b:1::/48, allowing SSRF and trust-boundary bypass
- **ip-address** 10.5.0 → 10.7.2 — fixes CVE-2026-101911 (MODERATE): ip-address: Address6 builds a parse diagnostic proportional to the input with no length bound, allowing a single long string to stall or crash the process
- **ip-address** 10.5.0 → 10.7.2 — fixes CVE-2026-101912 (MODERATE): ip-address: isInSubnet() and isHostInSubnet() compare addresses of different families as if they shared an address space, allowing an allowlist check to admit an address outside its range
- **ip-address** 10.5.0 → 10.7.2 — fixes CVE-2026-101913 (MODERATE): ip-address: Address6.isLinkLocal() recognizes fe80::/64 rather than fe80::/10, allowing SSRF and trust-boundary bypass to on-link hosts
- **js-yaml** 4.3.0/5.2.2 → 4.3.2/5.4.2 — fixes GHSA-r3ph-w7gj-g6xm (MODERATE): js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources
- **multer** 2.2.0 → 2.4.0 — fixes CVE-2026-88932 (MODERATE): multer vulnerable to Denial of Service via orphaned disk writes on aborted uploads
- **qs** 6.15.2 → 6.16.0 — fixes CVE-2026-82417 (MODERATE): qs: Denial of Service via Attacker Controlled isBuffer
- **qs** 6.15.2 → 6.16.0 — fixes CVE-2026-82562 (MODERATE): qs array-limit bypass via bracket-key comma parsing
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-84933 (MODERATE): undici vulnerable to cross-user cookie disclosure via Set-Cookie caching in shared caches
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-84890 (MODERATE): undici vulnerable to Denial of Service via unbounded decompression of compressed responses
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-16728 (MODERATE): undici vulnerable to downstream response desynchronization via retry interceptor
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-14643 (MODERATE): undici vulnerable to cross-user information disclosure via whitespace around equals in Cache-Control directives
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-15157 (MODERATE): undici vulnerable to CRLF Injection via blob-like body 'type' property
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-18149 (MODERATE): undici vulnerable to Denial of Service via orphaned RetryHandler response body
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-85014 (MODERATE): undici vulnerable to Denial of Service via WebSocketStream unclean close
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-16729 (MODERATE): undici vulnerable to cookie attribute injection via unsanitized domain and unparsed setCookie fields

#### LOW

- **multer** 2.2.0 → 2.4.0 — fixes CVE-2026-77063 (LOW): multer vulnerable to file size limit bypass via async fileFilter race condition
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-84947 (LOW): undici vulnerable to response truncation via oversized chunked responses in the dump interceptor
- **undici** 7.28.0 → 6.28.0/8.10.2 — fixes CVE-2026-85008 (LOW): undici vulnerable to caching and replay of unsafe HTTP method responses

### Development dependencies

#### HIGH

- **browserslist** 4.28.4 → 4.28.9 — fixes CVE-2026-73088 (HIGH): Browserslist: Uncaught crash / prototype write via untrusted browserslist-stats.json custom stats (normalizeStats)
- **browserslist** 4.28.4 → 4.28.9 — fixes CVE-2026-73089 (HIGH): Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM

#### MODERATE

- **@vitest/mocker** 4.1.10 → 5.0.0 — fixes CVE-2026-84373 (MODERATE): Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock
- **baseline-browser-mapping** 2.10.40 → 2.11.21 — fixes CVE-2026-45819 (MODERATE): baseline-browser-mapping process termination on invalid input causes denial of service
- **postcss** 8.5.18 → 8.5.28 — fixes CVE-2026-69153 (MODERATE): PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset
- **vitest** 4.1.10 → 5.0.0 — fixes CVE-2026-84373 (MODERATE): Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock

457 other packages bumped in this range with no known CVE fix.

### Additional v1.6.0 fixes outside the npm/OSV report

- `proxy-addr` 2.0.7 → 2.0.8 fixes **CVE-2026-90711** (CRITICAL), an IPv4-mapped IPv6 trust-subnet parsing flaw that could let unauthenticated clients spoof `X-Forwarded-For`. This advisory was not indexed by OSV.dev when the dependency was checked.
- The Alpine base image received patched `openssl` and `expat` packages. These operating-system package fixes are outside the npm report.

## v1.6.0 → v1.6.1

No dependency version changes.

## v1.6.1 → v1.7.0

No dependency version changes.

## v1.7.0 → v1.7.1

No dependency version changes.

## v1.7.1 → v1.7.2

### Production dependencies

#### HIGH

- **brace-expansion** 5.0.9 → 5.0.12 — fixes CVE-2026-102276 (HIGH): brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion
- **brace-expansion** 5.0.9 → 5.0.12 — fixes CVE-2026-102278 (HIGH): brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion
- **engine.io** 6.6.9 → 6.6.11 — fixes CVE-2026-102599 (HIGH): Socket.IO: Engine.IO Protocol Revision Mismatch DoS
- **undici** 6.28.0/8.10.2 → 6.29.0/8.11.2 — fixes CVE-2026-19534 (HIGH): undici vulnerable to Denial of Service via unrequested WebSocket subprotocol

#### MODERATE

- **brace-expansion** 5.0.9 → 5.0.12 — fixes CVE-2026-102277 (MODERATE): brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service
- **fast-uri** 3.1.7 → 3.1.8 — fixes CVE-2026-86472 (MODERATE): fast-uri vulnerable to inconsistent host case normalization via percent-encoded octets
- **undici** 6.28.0/8.10.2 → 6.29.0/8.11.2 — fixes CVE-2026-85024 (MODERATE): undici vulnerable to Denial of Service via unhandled error in WebSocket permessage-deflate decompression

#### LOW

- **undici** 6.28.0/8.10.2 → 6.29.0/8.11.2 — fixes CVE-2026-18540 (LOW): undici vulnerable to downstream response splitting via retry interceptor

100 other packages bumped in this range with no known CVE fix.

## v1.7.2 → v1.7.3

### Production dependencies

#### HIGH

- **node-forge** 1.4.0 → (removed) — fixes CVE-2026-33894 (HIGH): node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements

1 other package bumped in this range with no known CVE fix.

## v1.7.3 → v1.8.0

No dependency version changes.

## v1.8.0 → v1.8.1

No dependency version changes.

## v1.8.1 → v1.8.2

No dependency version changes.

## v1.8.2 → v1.8.3

### Development dependencies

#### HIGH

- **http-cache-semantics** 4.2.0 → (removed) — fixes CVE-2026-93748 (HIGH): http-cache-semantics max-stale handling can disclose cross-user cached responses

96 other packages bumped in this range with no known CVE fix.

## v1.8.3 → v1.9.0

No dependency version changes.

## v1.9.0 → v1.9.1

### Development dependencies

- **PyJWT** 2.13.0 → 2.15.0 in the hash-pinned Semgrep toolchain, resolving the open Dependabot security alerts for the scanner's transitive JWT parser.

## v1.9.1 → v1.10.0

### Development dependencies

- **Semgrep** 1.179.0 → 1.180.0 — refreshes the hash-pinned CI scanner and supports the existing PyJWT 2.15.1 pin. This scanner runs in CI and is not included in the production image.

---

## Footnote: devDependencies (build-time only, not shipped to production)

Vite, esbuild, and PostCSS are build tools; their output is bundled, but the
tools themselves are not part of the running server. These notes distinguish
the older findings from the fixes recorded above:

- **vite** 5.4.21 → 8.0.9 (v1.3.0) fixed **CVE-2026-39365** (path traversal in optimized-deps `.map` handling). The Windows-dev-server issues CVE-2026-53571 (`server.fs.deny` bypass) and CVE-2026-53632 (launch-editor NTLMv2 hash disclosure via UNC path) were later fixed by the 8.0.12 → 8.1.4 update in v1.4.0.
- **esbuild** 0.27.2 → 0.27.3 (v1.2.1) introduced GHSA-g7r4-m6w7-qqqr (Windows dev-server arbitrary file read). The 0.28.0 bump alone did not fix it; v1.4.0's 0.28.1 update did.
- **postcss** 8.4.47 → 8.5.10 (v1.3.0) fixed **CVE-2026-41305** (XSS via unescaped `</style>` in stringify output). This build-time issue is not reachable through the deployed server.
