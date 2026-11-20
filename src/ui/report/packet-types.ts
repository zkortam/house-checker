/** Packet helpers over the contract types (Report.packet, Source.page). */
import type { Report, Source, PacketSummary } from '@contract/types';
export type { PacketDoc, PacketFinding, PacketSummary } from '@contract/types';

export function packetOf(r: Report): PacketSummary | null {
  return r.packet && Array.isArray(r.packet.findings) ? r.packet : null;
}
export function pageOf(s: Source): number | null {
  return typeof s.page === 'number' && s.page > 0 ? s.page : null;
}
