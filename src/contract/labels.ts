import type { FindingLabel, Tone } from './types';

/** Display text and tone for every label. Plan A picks the label; Plan B renders exactly this. */
export const LABELS: Record<FindingLabel, { text: string; tone: Tone }> = {
  matches:               { text: 'Matches records', tone: 'success' },
  matches_planning:      { text: 'Matches Planning records', tone: 'success' },
  permitted_not_updated: { text: 'Permitted, assessor not updated', tone: 'info' },
  permitted_not_finaled: { text: 'Permitted, not finaled', tone: 'warning' },
  no_permit_found:       { text: 'No permit found', tone: 'error' },
  records_differ:        { text: 'Records differ from listing', tone: 'warning' },
  records_disagree:      { text: 'Records disagree', tone: 'neutral' },
  open_case:             { text: 'Open city case', tone: 'error' },
  likely_stale:          { text: 'Likely stale', tone: 'warning' },
  resolved:              { text: 'Resolved', tone: 'success' },
  not_settled:           { text: "Records don't settle this", tone: 'neutral' },
};

/** The only em dash allowed on screen: the glyph for a missing value. */
export const EMPTY_VALUE = '—';
