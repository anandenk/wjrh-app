import { useStation } from '@/api/queries';
import { EVENT_ARCHIVE_URL, EVENTS_INTRO } from '@/content/station';
import { stationDate } from '@/screens/schedule/schedule-state';

import { formatEventDate, splitEvents } from './station-state';
import { BodyText, CtaButton, InfoList, SectionLabel, SmallNote } from './ui';

export function EventsPage() {
  const station = useStation();
  const { upcoming, past } = splitEvents(station.data?.events ?? [], stationDate(new Date()));

  const items = (events: typeof upcoming) => events.map((e) => ({ title: e.name, meta: formatEventDate(e.date) }));

  return (
    <>
      <BodyText>{EVENTS_INTRO}</BodyText>
      {station.isPending ? <SmallNote top={16}>Loading…</SmallNote> : null}
      {station.isError && !station.data ? <SmallNote top={16}>Can&apos;t load events right now.</SmallNote> : null}
      {station.data ? (
        <>
          {upcoming.length ? (
            <>
              <SectionLabel>Upcoming</SectionLabel>
              <InfoList top={0} items={items(upcoming)} />
            </>
          ) : past.length === 0 ? (
            <SmallNote top={16}>No events are listed right now.</SmallNote>
          ) : null}
          {past.length ? (
            <>
              <SectionLabel>Event archive</SectionLabel>
              <InfoList top={0} items={items(past)} />
            </>
          ) : null}
        </>
      ) : null}
      <CtaButton cta={{ label: 'View event archive', variant: 'secondary', url: EVENT_ARCHIVE_URL }} top={18} />
    </>
  );
}
