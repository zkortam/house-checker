/**
 * B9 sponsor integration: Amplitude product events over the HTTP V2 API. Off (no network call) when
 * NEXT_PUBLIC_AMPLITUDE_API_KEY is unset. No address, listing text or email text ever goes in a property.
 */
const KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY ?? '';
const URL_V2 = 'https://api2.amplitude.com/2/httpapi';

export type ProductEvent =
  | 'check_started' | 'report_shown' | 'tile_tapped' | 'source_opened' | 'email_sent' | 'specialist_requested' | 'step_failed';

type Props = Record<string, string | number | boolean>;

function deviceId(): string {
  try {
    let id = localStorage.getItem('hc-device');
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('hc-device', id); }
    return id;
  } catch {
    return 'anonymous';
  }
}

export function track(event: ProductEvent, props: Props = {}): void {
  if (!KEY || typeof window === 'undefined') return;
  const body = JSON.stringify({ api_key: KEY, events: [{ event_type: event, device_id: deviceId(), time: Date.now(), event_properties: props }] });
  fetch(URL_V2, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
    .catch(() => undefined); // analytics never affects the product; a dropped event is acceptable
}
