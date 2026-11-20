'use client';
import type { Glyph } from '@contract/types';
import {
  MapPinArea, Receipt, FileText, Drop, Lightning, Megaphone, WarningOctagon, ClipboardText, Warning, CurrencyDollar,
  Users, MapTrifold, TrendUp, MapPin, HouseLine, Wall, Question, SealCheck, Paperclip, Waves, Mountains, Bathtub,
  ArrowLeft, ShareNetwork, Sun, Moon, X, CaretDown, Clock, XCircle, CheckCircle, Envelope, CalendarCheck,
  CircleNotch, ArrowSquareOut, Star, ThumbsUp, Eye, Info, Check, Copy, Buildings, WarningCircle, Calculator,
  type Icon,
} from '@phosphor-icons/react';

/** One catalogue: one Phosphor glyph per concept [craft §18, §21]. Regular weight; fill only for selected. */
export const GLYPHS: Record<Glyph, Icon> = {
  parcel: MapPinArea,
  roll: Receipt,
  permit: FileText,
  plumbing: Bathtub,
  electrical: Lightning,
  complaint: Megaphone,
  violation: WarningOctagon,
  planning: ClipboardText,
  hazard: Warning,
  money: CurrencyDollar,
  tenants: Users,
  zoning: MapTrifold,
  grow: TrendUp,
  nearby: MapPin,
  roof: HouseLine,
  foundation: Wall,
  unknown: Question,
  resolved: SealCheck,
  warning: WarningCircle,
  packet: Paperclip,
  reservoir: Drop,
  landslide: Mountains,
  flood: Waves,
};

/** UI chrome glyphs, also one per concept. */
export const UI = {
  back: ArrowLeft, share: ShareNetwork, sun: Sun, moon: Moon, close: X, caret: CaretDown,
  same: CheckCircle, pending: Clock, different: XCircle, unknown: Question,
  email: Envelope, book: CalendarCheck, spinner: CircleNotch, external: ArrowSquareOut, ai: Star,
  good: ThumbsUp, watch: Eye, info: Info, done: Check, copy: Copy, city: Buildings, failed: WarningCircle,
  attach: Paperclip, house: HouseLine, open: WarningOctagon, cost: Calculator, ask: Question,
} satisfies Record<string, Icon>;

export function G({ glyph, size, className }: { glyph: Glyph; size?: number; className?: string }) {
  const C = GLYPHS[glyph] ?? Question;
  return <C className={className ? `g ${className}` : 'g'} size={size} aria-hidden="true" />;
}

export function U({ name, size, className, weight }: { name: keyof typeof UI; size?: number; className?: string; weight?: 'regular' | 'fill' }) {
  const C = UI[name];
  return <C className={className ? `g ${className}` : 'g'} size={size} weight={weight ?? 'regular'} aria-hidden="true" />;
}
