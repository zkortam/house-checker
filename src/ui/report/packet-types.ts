/**
 * Local mirror of the packet types requested for src/contract (requests.md, hc-a 22:2xZ). Remove once
 * PacketFinding / PacketSummary / Report.packet / Source.page are on main; the shapes are identical.
 */
import type { FindingLabel, Report, Source } from '@contract/types';

export type PacketDoc = 'inspection' | 'pest' | 'tds' | 'spq' | '3r' | 'nhd' | 'title' | 'hoa' | 'other';
export interface PacketFinding {
  doc: PacketDoc;
  topic: 'units' | 'baths' | 'beds' | 'sqft' | 'roof' | 'foundation' | 'permits' | 'other';
  statement: string;
  page: number;
  label: FindingLabel;
  records: string | null;
  text: string;
}
export interface PacketSummary { fileName: string | null; pages: number; findings: PacketFinding[] }

export function packetOf(r: Report): PacketSummary | null {
  const p = (r as Report & { packet?: PacketSummary | null }).packet;
  return p && Array.isArray(p.findings) ? p : null;
}
export function pageOf(s: Source): number | null {
  const n = (s as Source & { page?: number }).page;
  return typeof n === 'number' && n > 0 ? n : null;
}
