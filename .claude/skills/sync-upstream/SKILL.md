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
2. **Fetch.** `git fetch upstream`.
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

### Converged with upstream — TAKE UPSTREAM on conflict

These were fork fixes that upstream later adopted independently; prefer upstream's version:
- `renderer/src/parser/Parser.ts` → `findInDatabase` localized lookups (`ITEM_BY_TRANSLATED`) and the unique base-ref comparison.
- `renderer/src/parser/magic-name.ts` → translated + substring base-type lookup.
- Any `_$REF` → `_$` (localized client-string) changes in the parser.

## Guardrails

- **Never stage or commit `.env`** — it holds a secret token and is gitignored. Verify it's not staged before finishing.
- **Never push automatically.** Rebase rewrites history; a push would be `--force-with-lease` and is the user's call.
- **Leave `main/yarn.lock` and `renderer/yarn.lock` untracked** — this repo migrated from Yarn to npm; don't commit yarn lockfiles.
- Keep the fork's diff from upstream **minimal** — only the items in the "Fork-unique" registry. If a conflict tempts a broader fork divergence, flag it to the user instead.

## Verification

After resolving, before reporting:
- Confirm no conflict markers remain: `git grep -nE "^(<<<<<<<|=======|>>>>>>>)"` returns nothing.
- If parser files changed, type-check by building: `cd renderer && npm run build` (or `yarn build`) runs `vue-tsc --noEmit`; and `cd main && npm run build` runs `tsc --noEmit`. Report any errors.
- If parser logic was touched, sanity-check that localized (Chinese) and chat-linked item parsing still work — the fork's whole reason for the parser changes. A quick way is to parse a known sample item and confirm it resolves with mods and no unknowns.

## Report format

End with: which upstream commits were pulled in, which files conflicted and how each was resolved (upstream vs fork), the resulting version, and the exact command the user would run to push if they choose to (`git push --force-with-lease origin master`).
