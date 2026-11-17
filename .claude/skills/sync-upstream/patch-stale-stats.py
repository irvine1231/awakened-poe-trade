"""FORK PATCH: stale stats. Patch renderer/public/data/*/stats.ndjson against the live trade site.

After a game patch, upstream's stat data can lag the game: trade ids are renamed
(stat_N -> effect_N) and the client rewords mods. This script, run from the repo root:
  1. remaps trade ids that no longer exist on the trade site to their current id
     (matched by English text; applied to all locales),
  2. adds the trade site's current wording as an extra matcher (en from the English
     site, cmn-Hant from the Taiwan site) where no existing matcher has it.
It only adds; existing matchers stay. Drop its output once upstream ships fresh data.

Usage: python -I patch-stale-stats.py <trade stats en.json> <trade stats tw.json>
  (the JSON from https://www.pathofexile.com/api/trade/data/stats and
   https://pathofexile.tw/api/trade/data/stats)
"""
import collections
import json
import re
import sys
from pathlib import Path

DATA = Path('renderer/public/data')
LOCALES = ['en', 'cmn-Hant', 'ko', 'ru']
ZWSP = chr(0x200B)
TYPES = {'explicit', 'implicit', 'crafted', 'fractured', 'enchant', 'scourge', 'veiled'}


def load_trade(path):
    out = {}
    for group in json.loads(Path(path).read_text(encoding='utf-8'))['result']:
        for e in group['entries']:
            # option stats (e.g. "+# to Level of all <gem> Gems") show a template, not game text
            out[e['id']] = (e['text'], 'option' in e)
    return out


def match_key(text):
    t = re.sub(r'\s+', ' ', text.replace(ZWSP, '')).strip()
    t = re.sub(r' (Support|Skill)$', '', t)
    return t.lower()


def to_matcher(text):
    t = text.replace(ZWSP, '')
    if '\n' in t or t.endswith(')') or not t.strip():
        return None
    return t.replace('+#', '#')


def read_rows(locale):
    raw = (DATA / locale / 'stats.ndjson').read_bytes()
    eol = b'\r\n' if b'\r\n' in raw else b'\n'
    lines = raw.decode('utf-8').split(eol.decode())
    if lines and lines[-1] == '':
        lines.pop()
    return eol, [json.loads(l) for l in lines]


def write_rows(locale, eol, rows):
    text = eol.decode().join(json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in rows) + eol.decode()
    (DATA / locale / 'stats.ndjson').write_bytes(text.encode('utf-8'))


def build_remap(en_rows, trade_en):
    by_key = collections.defaultdict(list)
    for tid, text in trade_en.items():
        by_key[(tid.split('.')[0], match_key(text[0]))].append(tid)
    remap, unmatched, ambiguous = {}, [], []
    for row in en_rows:
        if 'ref' not in row:
            continue
        for ids in row.get('trade', {}).get('ids', {}).values():
            for tid in ids:
                if tid in trade_en or tid.startswith('pseudo') or tid in remap:
                    continue
                cands = by_key.get((tid.split('.')[0], match_key(row['ref'])), [])
                effects = [c for c in cands if '.effect_' in c]
                if len(cands) == 1:
                    remap[tid] = cands[0]
                elif len(effects) == 1:
                    remap[tid] = effects[0]
                elif cands:
                    ambiguous.append((tid, row['ref'], cands))
                else:
                    unmatched.append((tid, row['ref']))
    return remap, unmatched, ambiguous


def apply_remap(rows, remap):
    n = 0
    for row in rows:
        for typ, ids in row.get('trade', {}).get('ids', {}).items():
            new = []
            for tid in ids:
                tid2 = remap.get(tid, tid)
                n += tid2 != tid
                if tid2 not in new:
                    new.append(tid2)
            ids[:] = new
    return n


def add_wording(rows, trade):
    existing = {re.sub(r'\s+', ' ', m['string']).strip() for r in rows for m in r.get('matchers', [])}
    added = []
    for row in rows:
        if 'ref' not in row or any('\n' in m['string'] for m in row['matchers']):
            continue
        for typ, ids in row.get('trade', {}).get('ids', {}).items():
            if typ not in TYPES:
                continue
            for tid in ids:
                text, is_option = trade.get(tid, (None, False))
                m = text and not is_option and to_matcher(text)
                if not m:
                    continue
                k = re.sub(r'\s+', ' ', m).strip()
                if k in existing:
                    continue
                row['matchers'].append({'string': m})
                existing.add(k)
                added.append((row['ref'], m))
    return added


def main():
    trade_en, trade_tw = load_trade(sys.argv[1]), load_trade(sys.argv[2])
    files = {loc: read_rows(loc) for loc in LOCALES}
    remap, unmatched, ambiguous = build_remap(files['en'][1], trade_en)
    for loc, (eol, rows) in files.items():
        n = apply_remap(rows, remap)
        added = add_wording(rows, {'en': trade_en, 'cmn-Hant': trade_tw}.get(loc, {}))
        write_rows(loc, eol, rows)
        print(f'{loc}: {n} trade ids remapped, {len(added)} matchers added')
    print(f'remap table: {len(remap)} ids; ambiguous {len(ambiguous)}; unmatched {len(unmatched)}')
    for tid, ref, cands in ambiguous:
        print('  AMBIGUOUS', tid, '|', ref, '|', cands)
    for tid, ref in unmatched:
        print('  UNMATCHED', tid, '|', ref)


if __name__ == '__main__':
    main()
