// Static Station-tab copy, taken from the design (frontend/index.html), which was verified against
// the official WJRH website on 21 September 2026 (frontend/assets/station-content-sources.md).
// Recheck before launch: the board-meeting time, the GroupMe invite and the donation form link
// change from year to year. Team and events lists are NOT here: they come from /v1/station.

import type { ImageKey } from './images';

export const GENERAL_EMAIL = 'wjrh@lafayette.edu';
export const EVENT_ARCHIVE_URL = 'https://www.wjrh.org/events/';

export const STATION_INTRO =
  'WJRH is Lafayette College’s freeform, all-volunteer radio station—on 104.9 FM across the Lehigh Valley and online around the clock.';
export const TEAM_INTRO =
  'Students manage WJRH’s music, events, finances, FCC compliance, community outreach, and the technology that keeps the station connected.';
export const EVENTS_INTRO =
  'WJRH brings artists to Lafayette, runs creative workshops, and organizes trips into the local music scene. Campus events are often open to the Lehigh Valley community; visitors should confirm access with the events director.';

/** A button. `page` goes to another Station page, `schedule` to the Schedule tab, `url` out of the app. */
export type Cta = { label: string; variant: 'primary' | 'secondary'; url?: string; page?: string; schedule?: boolean };

export type Block =
  | { kind: 'text'; text: string; flush?: boolean } // flush: no space above (right under a label)
  | { kind: 'label'; text: string }
  | { kind: 'facts'; items: { big: string; small: string }[] }
  | { kind: 'timeline'; items: { when: string; what: string }[] }
  | { kind: 'note'; title: string; text: string }
  | { kind: 'buttons'; items: Cta[] }
  | { kind: 'button'; cta: Cta; gapAbove: number; after?: string } // `after`: a small caption under it
  | { kind: 'card'; label: string; value: string; note?: string; url?: string; cta?: Cta }
  | { kind: 'rows'; items: { label: string; page: string }[] };

/** The photo at the top of a page. `y` is the design's object-position (where to crop a tall photo), in percent. */
export type Hero = { image: ImageKey; alt: string; credit?: string; y?: number };

export type StaticPage = { slug: string; kicker: string; title: string; hero: Hero; blocks: Block[] };

export const STATIC_PAGES: StaticPage[] = [
  {
    slug: 'about',
    kicker: 'About the station',
    title: 'Freeform by design',
    hero: { image: 'about', alt: 'Inside WJRH’s Hogg Hall radio studio' },
    blocks: [
      {
        kind: 'text',
        text: 'Broadcasting from Hogg Hall since 1946, WJRH gives live DJs full control of what reaches the air. The station is entirely student-managed, all-volunteer, and built around programming that would be difficult to hear anywhere else.',
      },
      {
        kind: 'text',
        text: 'WJRH is a federally licensed, noncommercial educational station owned by the Lafayette College Board of Trustees. It never airs commercials and offers hands-on experience in music, broadcasting, audio production, engineering, acoustics, podcasting, and station management.',
      },
      {
        kind: 'facts',
        items: [
          { big: '24 / 7', small: 'ON AIR ALL YEAR' },
          { big: '104.9', small: 'FM · LEHIGH VALLEY' },
          { big: '100%', small: 'STUDENT MANAGED' },
          { big: 'ZERO', small: 'COMMERCIALS' },
        ],
      },
      { kind: 'label', text: 'Keep exploring' },
      {
        kind: 'rows',
        items: [
          { label: 'Read the history', page: 'history' },
          { label: 'Meet the team', page: 'team' },
        ],
      },
    ],
  },
  {
    slug: 'history',
    kicker: 'The archive',
    title: 'From Radio Lafayette to WJRH',
    hero: {
      image: 'history',
      alt: 'Original WJRH members testing early broadcasting equipment',
      credit: 'Photograph courtesy of Skillman Library Special Collections',
      y: 42,
    },
    blocks: [
      {
        kind: 'text',
        text: 'Radio Lafayette began on the third floor of Hogg Hall in 1946. The call letters WJRH arrived in May 1947, honoring James Renwick Hogg, whose name the station’s home still carries.',
      },
      {
        kind: 'timeline',
        items: [
          { when: '1946', what: 'Radio Lafayette is established in Hogg Hall.' },
          { when: 'October 1, 1947', what: 'The first official broadcast, “Songs at Seven,” airs from 7 to 11 PM.' },
          { when: '1948–1949', what: 'Regular sports coverage begins, followed by quiz shows and talk programming.' },
          { when: '2011', what: 'WJRH begins streaming online at WJRH.org.' },
          { when: 'Today', what: 'A recording studio, podcasting, student and community DJs, and a proudly freeform signal.' },
        ],
      },
    ],
  },
  {
    slug: 'get-involved',
    kicker: 'Your show could be next',
    title: 'Get involved',
    hero: {
      image: 'involved',
      alt: 'WJRH students making radio together',
      credit: 'Photograph by Jaquan Alston',
    },
    blocks: [
      {
        kind: 'text',
        text: 'Put your favorite music on the air, start a talk show, learn audio engineering, or help run the station. WJRH welcomes new DJs at the beginning of each broadcast season and accepts mid-semester proposals too.',
      },
      {
        kind: 'note',
        title: 'START WITH GROUPME',
        text: 'Applications, meeting details, event updates, and DJ troubleshooting are shared there.',
      },
      {
        kind: 'buttons',
        items: [
          { label: 'Join 2026–27 GroupMe', variant: 'primary', url: 'https://groupme.com/join_group/117035363/79wo8rF2' },
          { label: 'Check schedule', variant: 'secondary', schedule: true },
        ],
      },
      { kind: 'label', text: 'Pitching mid-semester' },
      {
        kind: 'text',
        flush: true,
        text: 'Email the general manager with your name, any cohosts, the show format or genre, and your top three available time slots. New DJs are welcome throughout the semester.',
      },
      {
        kind: 'button',
        gapAbove: 16,
        cta: { label: 'Email the general manager', variant: 'secondary', url: 'mailto:wjrh@lafayette.edu?subject=WJRH%20show%20proposal' },
      },
    ],
  },
  {
    slug: 'support',
    kicker: 'Keep freeform radio free',
    title: 'Support WJRH',
    hero: { image: 'support', alt: 'WJRH support artwork' },
    blocks: [
      {
        kind: 'text',
        text: 'Individual gifts help WJRH pursue new station projects and keep a vibrant, student-run radio community available to future generations of Lafayette Leopards.',
      },
      {
        kind: 'facts',
        items: [
          { big: 'ONE-TIME', small: 'GIVE WHEN YOU CAN' },
          { big: 'RECURRING', small: 'SUSTAIN THE SIGNAL' },
        ],
      },
      {
        kind: 'button',
        gapAbove: 20,
        cta: {
          label: 'Give to the WJRH Fund',
          variant: 'primary',
          url: 'https://securelb.imodules.com/s/1699/interior.aspx?bledit=1&cid=1122&dids=187&gid=2&pgid=446&sid=1699&sort=1',
        },
        after: 'Opens Lafayette College’s giving form with WJRH Radio selected.',
      },
    ],
  },
  {
    slug: 'contact',
    kicker: 'Come say hello',
    title: 'Contact & follow',
    hero: { image: 'contact', alt: 'Illustrated WJRH contact artwork' },
    blocks: [
      {
        kind: 'card',
        label: 'OPEN BOARD MEETING',
        value: 'Tuesday · 7 PM · Hogg Hall studio',
        note: 'Only while Lafayette is in session.',
      },
      {
        kind: 'card',
        label: 'EMAIL',
        value: GENERAL_EMAIL,
        url: `mailto:${GENERAL_EMAIL}?subject=%23readnow%20`,
        note: 'Add #readnow to the subject of a direct email so it reaches the top of the station inbox.',
      },
      {
        kind: 'card',
        label: 'REQUEST LINE',
        value: '+1 610-330-5316',
        url: 'tel:+16103305316',
        note: 'For on-air requests—not a business line.',
      },
      {
        kind: 'card',
        label: 'VISIT THE STUDIO',
        value: 'Hogg Hall · Lafayette College',
        note: 'Use 730 High Street, Easton, PA for GPS, park at Markle Parking Deck, then walk south to the gothic building on the Quad. Arrange tours by email.',
        cta: {
          label: 'Open map',
          variant: 'secondary',
          url: 'https://www.openstreetmap.org/?mlat=40.6993813&mlon=-75.2069092#map=17/40.6993813/-75.2069092',
        },
      },
      {
        kind: 'card',
        label: 'SNAIL MAIL',
        value: 'WJRH Secretariat\nBox 9473 · 111 Quad Drive\nEaston, PA 18042',
      },
    ],
  },
];

/** The two pages whose lists come from the API (see team-page.tsx and events-page.tsx). */
export const API_PAGES: Record<string, { kicker: string; title: string; hero: Hero }> = {
  team: {
    kicker: 'The people behind 104.9',
    title: 'Leadership team',
    hero: {
      image: 'team',
      alt: 'Members of the WJRH leadership team',
      credit: 'Members of the WJRH leadership team · not everyone pictured',
      y: 42,
    },
  },
  events: {
    kicker: 'Beyond the booth',
    title: 'Events at WJRH',
    hero: {
      image: 'events',
      alt: 'WJRH members at the Fall 2026 club fair',
      credit: 'WJRH at the Fall 2026 club fair',
    },
  },
};

export const findStaticPage = (slug: string) => STATIC_PAGES.find((p) => p.slug === slug);

/** The hub's three photo tiles (the first one is full width). */
export const HUB_TILES: { slug: string; title: string; sub: string; image: ImageKey; wide?: boolean }[] = [
  { slug: 'events', title: 'Events', sub: 'Artist shows, workshops, and trips into the local music scene', image: 'events', wide: true },
  { slug: 'get-involved', title: 'Get involved', sub: 'Become a DJ', image: 'involved' },
  { slug: 'support', title: 'Support WJRH', sub: 'Keep student radio thriving', image: 'support' },
];

/** The hub's "Explore WJRH" rows. */
export const HUB_ROWS: { slug: string; label: string }[] = [
  { slug: 'about', label: 'About WJRH' },
  { slug: 'history', label: 'History' },
  { slug: 'team', label: 'Leadership team' },
  { slug: 'contact', label: 'Contact & follow' },
];

export const SOCIAL_LINKS = [
  { id: 'instagram', label: 'WJRH on Instagram, @wjrh_radio', url: 'https://instagram.com/wjrh_radio' },
  { id: 'facebook', label: 'WJRH on Facebook, WJRH1049', url: 'https://www.facebook.com/WJRH1049' },
  { id: 'twitter', label: 'WJRH on Twitter, @wjrh1049fm', url: 'https://twitter.com/wjrh1049fm/' },
  { id: 'fcc', label: 'WJRH FCC public file', url: 'https://publicfiles.fcc.gov/fm-profile/WJRH' },
] as const;
