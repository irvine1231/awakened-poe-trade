---
name: sync-upstream
description: Sync this fork with the upstream SnosMe/awakened-poe-trade repo by rebasing (or merging) upstream, then resolve conflicts using the fork's known customizations. Use when the user says "sync upstream", "rebase upstream", "merge upstream", "pull upstream", or "update from upstream".
---

# Sync with upstream & resolve conflicts

This is a fork of `SnosMe/awakened-poe-trade`. Remotes:
- `origin` → `irvine1231/awakened-poe-trade` (the fork; releases are published here)
- `upstream` → `SnosMe/awakened-poe-trade` (the source project)

Goal: bring upstream's changes into the fork while preserving the fork's customizations, resolving any conflicts correctly, and stopping before pushing so the user can review.

## Procedure

1. **Preflight.** Run `git status`. If the working tree is dirty, ask the user whether to commit or stash first — do not rebase over uncommitted work. Note the current branch (normally `master`).
2. **Fetch code only — never tags.** `git fetch upstream --no-tags`. (The `upstream` remote is configured with `tagOpt=--no-tags`, so tags are skipped by default too.) The fork manages its own release tags; do **not** pull upstream's.
3. **Preview.** Show what's incoming: `git log --oneline HEAD..upstream/master`. Summarize notable changes (especially anything touching `renderer/src/parser/**`, `main/src/**`, versioning, or build config).
4. **Rebase.** `git rebase upstream/master` (the user asked for rebase). If it conflicts, resolve per the rules below, `git add` each resolved file, then `git rebase --continue`. Repeat until done.
   - If rebase becomes messy across many commits, offer `git merge upstream/master` as a simpler alternative (single conflict pass), but only switch with the user's ok.
5. **Resolve conflicts** using the registry below.
6. **Verify** (see Verification).
7. **Report** what was taken from upstream vs kept from the fork. **Do not push.** After a rebase, pushing requires `git push --force-with-lease origin master` — only the user decides to push.

## Conflict-resolution strategy

For each conflict hunk, decide: is it a **converged fix** (upstream independently made the same change the fork had → take upstream) or a **fork-unique customization** (→ keep the fork's side)? Use this registry. When a hunk is genuinely shared logic and unclear, prefer **upstream** and re-apply the fork's intent on top.

### Fork-unique — PRESERVE (upstream will not have these)

- **`renderer/src/parser/Parser.ts` → `parseFlatModifiers` + its call site in `parseModifiers`.** Adds price-check support for **chat-linked items**, which use a flat mod block with no advanced `{ ... }` headers or value ranges. If `parseModifiers`'s `!recognizedLine` branch conflicts, keep the fork's `return parseFlatModifiers(section, item)` and the `parseFlatModifiers` function.
- **Dev server ports 8001 / 8002:**
  - `renderer/vite.config.mts` — `server.port: 8001`, `strictPort: true`, proxy targets `http://127.0.0.1:8002`.
  - `main/build/script.mjs` — `VITE_DEV_SERVER_URL` = `http://localhost:8001`.
  - `main/src/server.ts` — dev server port `8002` (the `? 8002 : 0` line).
- **`main/electron-builder.yml` → `publish`** targets `owner: irvine1231, repo: awakened-poe-trade` (auto-updater points at the fork).
- **`renderer/src/web/settings/about.vue`** — the "· irvine" title marker and the `[version + '-irvine']` display. This is UI-only branding.
- **`main/package.json` → `version`** — a **clean semver** number the fork controls for its own release sequence, with **NO `-irvine` suffix** (the fork marker lives in `about.vue`, not the version). On a version conflict, take the **higher base number** (usually upstream's) and keep it clean; the user bumps it for fork releases.
- **Fork release tooling** (usually no conflict, upstream won't touch these): `release.ps1`, `.env.example`, and the `.env` entry in `.gitignore`.
- **Viscera price-check support** — all marked `FORK PATCH: Viscera`. `ItemCategory.Viscera` + `VisceraTier` in `parser/meta.ts` (also in `CONSUMABLE_CRAFTABLE_ITEM`), `visceraTier` in `ParsedItem.ts`, `findViscera` in `parser/Parser.ts` (strips the Lesser/Greater name prefix for the DB lookup), `VISCERA_LESSER`/`VISCERA_GREATER` in `assets/data/interfaces.ts` and all four `public/data/*/client_strings.js`, `termTrade` in `filters/interfaces.ts`, a Viscera branch plus an ilvl exclusion in `create-item-filters.ts`, one condition in `create-presets.ts`, and `term` + `[Viscera, 'viscera']` in `trade/pathofexile-trade.ts` (the English site searches tiers via `query.term`; `type` returns all tiers). Also 164 `craftable.category: Viscera` rows in `public/data/en/items.ndjson` and `cmn-Hant/items.ndjson`: these conflict with upstream "update data" commits, so drop them once upstream ships viscera rows. `git grep "FORK PATCH: Viscera"` to find all; delete them (take upstream) when upstream adds native support.
- **Chronicle of Atzoatl exact area level** — one line marked `FORK PATCH: Chronicle area level` in `create-item-filters.ts`: the Chronicle's `areaLevel` filter uses the item's exact area level instead of upstream's `floorToBracket(..., [1, 68, 73, 75, 78, 80])`. User preference; keep it unless upstream changes that branch.
- **Inscribed Ultimatum price-check support** — all marked `FORK PATCH: Ultimatum`. New file `renderer/src/parser/ultimatum.ts` (parses the sacrificed "Required" item + monster mods, which the normal parsers skip for Currency), plus small hooks in `parser/ParsedItem.ts` (`ultimatumRequiredItem`), `parser/Parser.ts` (import + two `parseUltimatum` entries), `web/price-check/filters/interfaces.ts`, `create-item-filters.ts` (Required Item filter), `create-stat-filters.ts` (keep Explicit mods so monster-life etc. become stat filters), `FiltersBlock.vue` (toggle row), and `web/price-check/trade/pathofexile-trade.ts` (`ultimatum_input` serialization + query type). `git grep "FORK PATCH: Ultimatum"` to find all; delete them (take upstream) when upstream adds native support.
- **Allflame "Chart" (海圖) — cmn-Hant area-level fix.** Upstream added native Chart support in `fb2831a` (2026-08), so the fork's *original* large Chart patch was deleted. Upstream owns Charts now (`ItemCategory.Chart`, `parseChart`, `chart_sulphur`, data rows in every locale) — **do not** re-add that old code. What remains is a **small 2-site `FORK PATCH: Chart area level`**, because upstream's Chart support is **broken on Traditional Chinese**: charts label their area level `區域等級`, but the `AREA_LEVEL` client string is `地區等級` (Heist/Logbook). Upstream's `parseChart` only checks `_$.AREA_LEVEL`, so on cmn-Hant it returns `SECTION_SKIPPED`, leaves `item.mapArea` undefined, and `createFilters` crashes on `item.mapArea!.name` — **blanking the entire price-check overlay**. The patch: (1) `parser/Parser.ts` — `CHART_AREA_LEVEL_LINE` + `parseChartAreaLevel()`, OR'd into `parseChart`'s area-level check; (2) `create-item-filters.ts` — guard `sub: item.mapArea && {...}` so an unparsed chart degrades to a base-type search instead of throwing. Drop both once upstream matches the chart area-level string itself. `git grep "FORK PATCH: Chart area level"`. Note ko/ru may have the same upstream bug (unverified).

### Converged with upstream — TAKE UPSTREAM on conflict

These were fork fixes that upstream later adopted independently; prefer upstream's version:
- `renderer/src/parser/Parser.ts` → `findInDatabase` localized lookups (`ITEM_BY_TRANSLATED`) and the unique base-ref comparison.
- `renderer/src/parser/magic-name.ts` → translated + substring base-type lookup.
- Any `_$REF` → `_$` (localized client-string) changes in the parser.

## Guardrails

- **Never stage or commit `.env`** — it holds a secret token and is gitignored. Verify it's not staged before finishing.
- **Never push automatically.** Rebase rewrites history; a push would be `--force-with-lease` and is the user's call.
- **Never sync or push upstream tags.** Fetch with `--no-tags`, and when pushing, push the **branch only** (`git push origin master`) — never `git push --tags`. The fork uses its own release tags (created by `electron-builder --publish`), which must not be polluted by upstream's.
- **Push to `origin`, explicitly.** The `master` branch tracks `upstream/master`, so a bare `git push` could target the upstream repo. Always `git push origin master`.
- **Leave `main/yarn.lock` and `renderer/yarn.lock` untracked** — this repo migrated from Yarn to npm; don't commit yarn lockfiles.
- Keep the fork's diff from upstream **minimal** — only the items in the "Fork-unique" registry. If a conflict tempts a broader fork divergence, flag it to the user instead.

## Verification

After resolving, before reporting:
- Confirm no conflict markers remain: `git grep -nE "^(<<<<<<<|=======|>>>>>>>)"` returns nothing.
- If parser files changed, type-check by building: `cd renderer && npm run build` (or `yarn build`) runs `vue-tsc --noEmit`; and `cd main && npm run build` runs `tsc --noEmit`. Report any errors.
- If parser logic was touched, sanity-check that localized (Chinese) and chat-linked item parsing still work — the fork's whole reason for the parser changes. A quick way is to parse a known sample item and confirm it resolves with mods and no unknowns.

## Report format

End with: which upstream commits were pulled in, which files conflicted and how each was resolved (upstream vs fork), the resulting version, and the exact command the user would run to push if they choose to (`git push --force-with-lease origin master`).
