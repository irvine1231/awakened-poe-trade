// FORK PATCH: Chart — remove this whole file (and its call sites, search
// "FORK PATCH: Chart") once upstream adds native support for Allflame "Sea Chart"
// (海圖) items. Until then this parses the chart's area and shape so price-check
// can narrow to the exact trade variant.
import type { ParsedItem } from './ParsedItem'
import { ItemCategory } from './meta'

// Chart area name, exactly as it appears on its own line in the copied item text
// (Traditional Chinese) -> pathofexile.com/trade item `type` id.
// (Some areas have more than one observed spelling across sources -> same type.)
const CHART_AREA_TO_TYPE: Record<string, string> = {
  '深海平原': 'AbyssalPlain',
  '錨地': 'Anchorfield',
  '定錨點': 'Anchorfield',
  '危機海淵': 'HazardousDepths',
  '感染潛水球': 'InfestedBathyspheres',
  '奇夏拉安眠地': 'KisharasRest',
  '海洋王的領域': 'BrineKingsDomain',
  '蛤蜊之架': 'ClamInfestedShelf',
  '潛水沙洲': 'DivingShoals',
  '海底山脊': 'SeafloorRidges',
  '沉沒圖騰': 'SunkenTotems',
  '失落遺跡': 'LostRuins',
  '遠洋深淵': 'PelagicAbyss',
  '海洋之柱': 'SeaPillars',
  '海底幽林': 'UnderseaGroves'
}

// Chart shape, from the "海圖形狀：X" line -> trade `chart_shape` option id.
const CHART_SHAPE_TO_ID: Record<string, string> = {
  '終點': '1', // End
  '轉角': '2', // Corner
  '直線': '3', // Straight
  '交界處': '4', // Junction
  '十字口': '5' // Crossing
}

// Display names for the filter UI.
export const CHART_SHAPE_NAMES: Record<string, string> = {
  '1': 'End',
  '2': 'Corner',
  '3': 'Straight',
  '4': 'Junction',
  '5': 'Crossing'
}
export const CHART_AREA_NAMES: Record<string, string> = {
  AbyssalPlain: 'Abyssal Plain',
  Anchorfield: 'Anchorfield',
  HazardousDepths: 'Hazardous Depths',
  InfestedBathyspheres: 'Infested Bathyspheres',
  KisharasRest: "Kishara's Rest",
  BrineKingsDomain: "Brine King's Domain",
  ClamInfestedShelf: 'Clam-infested Shelf',
  DivingShoals: 'Diving Shoals',
  SeafloorRidges: 'Seafloor Ridges',
  SunkenTotems: 'Sunken Totems',
  LostRuins: 'Lost Ruins',
  PelagicAbyss: 'Pelagic Abyss',
  SeaPillars: 'Sea Pillars',
  UnderseaGroves: 'Undersea Groves'
}

// Area variants are searched with a per-base trade discriminator, keyed by the
// resolved base type refName.
export const CHART_BASE_DISC: Record<string, string> = {
  'Coral Reef Chart': 'chart_coral_reef',
  'Coral Forest Chart': 'chart_coral_forest',
  'Sandy Seabed Chart': 'chart_sandy_seabed'
}

const CHART_SHAPE_LINE = /^海圖形狀[：:]\s*(\S+)\s*$/m
// Charts label their area level "區域等級" / "Area Level" (note: not the same
// string as the `AREA_LEVEL` client string, which is "地區等級" for Heist/Logbook).
const CHART_AREA_LEVEL_LINE = /^(?:Area Level|區域等級)\s*[：:]\s*(\d+)/m

export function parseChart (item: ParsedItem): void {
  if (item.category !== ItemCategory.Chart) return

  const lines = item.rawText.split(/\r?\n/)
  for (const cnName in CHART_AREA_TO_TYPE) {
    if (lines.includes(cnName)) {
      item.chartArea = CHART_AREA_TO_TYPE[cnName]
      break
    }
  }

  const shape = item.rawText.match(CHART_SHAPE_LINE)
  if (shape) {
    const id = CHART_SHAPE_TO_ID[shape[1]]
    if (id) item.chartShape = id
  }

  const areaLevel = item.rawText.match(CHART_AREA_LEVEL_LINE)
  if (areaLevel) item.areaLevel = Number(areaLevel[1])
}
