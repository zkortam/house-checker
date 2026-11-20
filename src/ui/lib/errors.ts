import type { ApiError } from '@contract/types';
import { S, fill } from '../strings.en';

/** ApiError kind to Plan B's own words. Never debug text or a status code. */
export function errorText(e: ApiError): string {
  switch (e.kind) {
    case 'invalid': return S.errInvalid;
    case 'outside_sf': return S.errOutsideSf;
    case 'not_found': return S.errNotFound;
    case 'offline': return S.errOffline;
    case 'timeout': return S.errTimeout;
    case 'rate': return fill(S.errRate, { n: Math.max(1, Math.ceil((e.retryAfterSec ?? 600) / 60)) });
    case 'refused': return S.errRefused;
    case 'unavailable':
    default:
      return e.reference ? fill(S.errUnavailable, { ref: e.reference }) : S.errUnavailableNoRef;
  }
}
