import type { FindingLabel, Tone } from './types';

/**
 * Display text, tone and comparison icon for every label. Plain words a first-time buyer understands.
 * Plan A picks the label; Plan B renders exactly this. compare drives the icon between "Listing" and "City":
 * same = check, pending = clock, different = crossed circle, unknown = question mark.
 */
export const LABELS: Record<FindingLabel, { text: string; tone: Tone; compare: 'same' | 'pending' | 'different' | 'unknown' }> = {
  matches:               { text: 'Checks out', tone: 'success', compare: 'same' },
  matches_planning:      { text: 'Matches city plans', tone: 'success', compare: 'same' },
  permitted_not_updated: { text: 'Approved, tax roll behind', tone: 'success', compare: 'same' },
  permitted_not_finaled: { text: 'Approved, not signed off', tone: 'warning', compare: 'pending' },
  no_permit_found:       { text: 'No permit found', tone: 'error', compare: 'different' },
  records_differ:        { text: 'Differs from records', tone: 'warning', compare: 'different' },
  records_disagree:      { text: 'City records disagree', tone: 'neutral', compare: 'unknown' },
  open_case:             { text: 'Open city case', tone: 'error', compare: 'different' },
  likely_stale:          { text: 'Probably outdated', tone: 'warning', compare: 'unknown' },
  resolved:              { text: 'Fixed', tone: 'success', compare: 'same' },
  not_settled:           { text: "Records don't say", tone: 'neutral', compare: 'unknown' },
};

/** Tone per decision, system status, hazard status and history kind. */
export const DECISION_TONE = { clear: 'success', caution: 'warning', stop: 'error' } as const;
export const SYSTEM_STATUS = {
  updated: { text: 'Updated', tone: 'success' }, in_progress: { text: 'In progress', tone: 'warning' },
  old: { text: 'Over 30 years', tone: 'warning' }, no_record: { text: 'No record', tone: 'neutral' },
} as const;
export const HAZARD_STATUS = { clear: { text: 'Clear', tone: 'success' }, note: { text: 'In zone', tone: 'warning' }, unknown: { text: 'Not checked', tone: 'neutral' } } as const;
export const HISTORY_TONE = { permit: 'info', complaint: 'error', planning: 'warning', sale: 'neutral', tenant: 'warning', other: 'neutral' } as const;
export const HISTORY_LEGEND = { permit: 'Permit', complaint: 'Complaint', planning: 'Planning', sale: 'Sale', tenant: 'Tenants', other: 'Other' } as const;

/** The only em dash allowed on screen: the glyph for a missing value. */
export const EMPTY_VALUE = '—';
