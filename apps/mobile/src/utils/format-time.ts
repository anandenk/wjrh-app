// The station's clock is Eastern time (the API's schedule is America/New_York). Show it that way
// for everyone, wherever the phone is.
const STATION_TZ = 'America/New_York';

/** "5:18 PM" for an ISO 8601 timestamp, in station time. Empty string if unparseable. */
export function formatStationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: STATION_TZ });
}
