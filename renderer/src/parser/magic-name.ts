import { ITEM_BY_TRANSLATED } from '@/assets/data'

export function magicBasetype (name: string) {
  // Whitespace tokenization covers languages that separate words. For languages
  // without spaces (e.g. Chinese), fall back to a substring scan so the base
  // type embedded in the affixed name can still be found.
  return findBase(wordCandidates(name)) ?? findBase(substringCandidates(name))
}

function findBase (candidates: string[]) {
  const result = candidates
    .map(name => {
      const result = ITEM_BY_TRANSLATED('ITEM', name)
      return { name, found: (result && result[0].craftable) }
    })
    .filter(res => res.found)
    .sort((a, b) => b.name.length - a.name.length)

  return result.length ? result[0].name : undefined
}

function wordCandidates (name: string): string[] {
  const words = name.split(' ')

  return words.flatMap((_, start) =>
    Array(words.length - start).fill(undefined)
      .map((_, idx) => words
        .slice(start, start + idx + 1)
        .join(' ')
      )
  )
}

function substringCandidates (name: string): string[] {
  const chars = [...name]
  const out: string[] = []
  for (let start = 0; start < chars.length; start += 1) {
    for (let end = start + 1; end <= chars.length; end += 1) {
      out.push(chars.slice(start, end).join(''))
    }
  }
  return out
}
