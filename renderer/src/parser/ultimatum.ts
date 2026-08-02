// FORK PATCH: Ultimatum — remove this file and its call sites (search
// "FORK PATCH: Ultimatum") once upstream adds native Inscribed Ultimatum
// price-check support. Until then this parses the sacrificed ("Required") item,
// the reward unique, and the item's monster modifiers, which the normal parsers
// skip for Currency.
import { ITEM_BY_TRANSLATED } from '@/assets/data'
import type { ParsedItem } from './ParsedItem'
import { ModifierType } from './modifiers'
import type { ParsedModifier } from './advanced-mod-desc'
import { linesToStatStrings, tryParseTranslation } from './stat-translations'

type SectionParseResult = 'SECTION_PARSED' | 'SECTION_SKIPPED' | 'PARSER_SKIPPED'

// Localized prefixes (observed forms) for the two property lines.
const SACRIFICE_PREFIXES = ['Requires Sacrifice: ', '需求獻祭: ']
const REWARD_PREFIXES = ['Reward: ', '獎勵: ']

function afterPrefix (section: string[], prefixes: string[]): string | undefined {
  for (const line of section) {
    const prefix = prefixes.find(p => line.startsWith(p))
    if (prefix) return line.slice(prefix.length)
  }
  return undefined
}

export function parseUltimatum (section: string[], item: ParsedItem): SectionParseResult {
  if (item.info.refName !== 'Inscribed Ultimatum') return 'PARSER_SKIPPED'

  // (a) the property section — sacrificed ("Required") item + reward unique
  const sacrifice = afterPrefix(section, SACRIFICE_PREFIXES)
  const reward = afterPrefix(section, REWARD_PREFIXES)
  if (sacrifice !== undefined || reward !== undefined) {
    if (sacrifice !== undefined) {
      // The "Required Item" filter only applies to currency and divination card
      // sacrifices; unique sacrifices are searched by their reward instead, so
      // they intentionally don't resolve here.
      const raw = sacrifice.replace(/\s*x\s*[\d,]+\s*$/i, '').trim()
      const found = ITEM_BY_TRANSLATED('ITEM', raw) ?? ITEM_BY_TRANSLATED('DIVINATION_CARD', raw)
      if (found?.length) item.ultimatumRequiredItem = found[0].refName
    }
    if (reward !== undefined) {
      // only a specific unique reward maps to the "Reward Unique" filter;
      // descriptive reward types (e.g. "Doubles sacrificed Currency") are ignored.
      const found = ITEM_BY_TRANSLATED('UNIQUE', reward.trim())
      if (found?.length) item.ultimatumRewardUnique = found[0].refName
    }
    return 'SECTION_PARSED'
  }

  // (b) the modifier section -> parse the recognizable stats (e.g. more Monster
  // Life / increased Monster Damage); the named round modifiers won't match a
  // stat and are ignored.
  const parsed: ParsedModifier[] = []
  const statIterator = linesToStatStrings(section)
  let stat = statIterator.next()
  while (!stat.done) {
    const parsedStat = tryParseTranslation(stat.value, ModifierType.Explicit, item.category)
    if (parsedStat) {
      parsed.push({ info: { type: ModifierType.Explicit, tags: [] }, stats: [parsedStat] })
      stat = statIterator.next(true)
    } else {
      stat = statIterator.next(false)
    }
  }
  if (!parsed.length) return 'SECTION_SKIPPED'
  item.newMods.push(...parsed)
  return 'SECTION_PARSED'
}
