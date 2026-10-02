// Static Station-tab copy, taken from the design (frontend/index.html), which was verified against
// the official WJRH website on 21 September 2026 (frontend/assets/station-content-sources.md).
// Recheck before launch: the board-meeting time, the GroupMe invite and the donation form link
// change from year to year. Team and events are NOT here: they come from /v1/station.

export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'facts'; items: { big: string; small: string }[] }
  | { kind: 'timeline'; items: { when: string; what: string }[] }
  | { kind: 'card'; label: string; value: string; note?: string; url?: string }
  | { kind: 'link'; label: string; url: string; note?: string };

export type StaticPage = { slug: string; title: string; blocks: Block[] };

export const STATION_INTRO =
  'WJRH is Lafayette College’s freeform, all-volunteer radio station—on 104.9 FM across the Lehigh Valley and online around the clock.';

export const TEAM_INTRO =
  'Students manage WJRH’s music, events, finances, FCC compliance, community outreach, and the technology that keeps the station connected.';

export const EVENTS_INTRO =
  'WJRH brings artists to Lafayette, runs creative workshops, and organizes trips into the local music scene. Campus events are often open to the Lehigh Valley community; visitors should confirm access with the events director.';

export const EVENT_ARCHIVE_URL = 'https://www.wjrh.org/events/';
export const GENERAL_EMAIL = 'wjrh@lafayette.edu';

export const SOCIAL_LINKS = [
  { label: 'Instagram', value: '@wjrh_radio', url: 'https://instagram.com/wjrh_radio' },
  { label: 'Facebook', value: 'WJRH1049', url: 'https://www.facebook.com/WJRH1049' },
  { label: 'FCC public file', value: 'WJRH', url: 'https://publicfiles.fcc.gov/fm-profile/WJRH' },
] as const;

export const STATIC_PAGES: StaticPage[] = [
  {
    slug: 'about',
    title: 'About WJRH',
    blocks: [
      { kind: 'heading', text: 'Freeform by design' },
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
          { big: '104.9 FM', small: 'LEHIGH VALLEY' },
          { big: '100%', small: 'STUDENT MANAGED' },
          { big: 'ZERO', small: 'COMMERCIALS' },
        ],
      },
    ],
  },
  {
    slug: 'history',
    title: 'History',
    blocks: [
      { kind: 'heading', text: 'From Radio Lafayette to WJRH' },
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
    title: 'Get involved',
    blocks: [
      { kind: 'heading', text: 'Your show could be next' },
      {
        kind: 'text',
        text: 'Put your favorite music on the air, start a talk show, learn audio engineering, or help run the station. WJRH welcomes new DJs at the beginning of each broadcast season and accepts mid-semester proposals too.',
      },
      {
        kind: 'link',
        label: 'Join 2026–27 GroupMe',
        url: 'https://groupme.com/join_group/117035363/79wo8rF2',
        note: 'Applications, meeting details, event updates, and DJ troubleshooting are shared there.',
      },
      { kind: 'heading', text: 'Pitching mid-semester' },
      {
        kind: 'text',
        text: 'Email the general manager with your name, any cohosts, the show format or genre, and your top three available time slots. New DJs are welcome throughout the semester.',
      },
      {
        kind: 'link',
        label: 'Email the general manager',
        url: 'mailto:wjrh@lafayette.edu?subject=WJRH%20show%20proposal',
      },
    ],
  },
  {
    slug: 'support',
    title: 'Support WJRH',
    blocks: [
      { kind: 'heading', text: 'Keep freeform radio free' },
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
        kind: 'link',
        label: 'Give to the WJRH Fund',
        url: 'https://securelb.imodules.com/s/1699/interior.aspx?bledit=1&cid=1122&dids=187&gid=2&pgid=446&sid=1699&sort=1',
        note: 'Opens Lafayette College’s giving form with WJRH Radio selected.',
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact & follow',
    blocks: [
      { kind: 'heading', text: 'Come say hello' },
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
        url: 'https://www.openstreetmap.org/?mlat=40.6993813&mlon=-75.2069092#map=17/40.6993813/-75.2069092',
        note: 'Use 730 High Street, Easton, PA for GPS, park at Markle Parking Deck, then walk south to the gothic building on the Quad. Arrange tours by email. Tap to open the map.',
      },
      {
        kind: 'card',
        label: 'SNAIL MAIL',
        value: 'WJRH Secretariat\nBox 9473 · 111 Quad Drive\nEaston, PA 18042',
      },
      { kind: 'heading', text: 'Follow & verify' },
      ...SOCIAL_LINKS.map((l) => ({ kind: 'link' as const, label: `${l.label} · ${l.value}`, url: l.url })),
    ],
  },
];

export const findStaticPage = (slug: string) => STATIC_PAGES.find((p) => p.slug === slug);

/** The Station hub: static pages and the two API-backed ones, in display order. */
export const HUB_ORDER: { slug: string; title: string; subtitle: string }[] = [
  { slug: 'about', title: 'About WJRH', subtitle: 'Freeform by design' },
  { slug: 'history', title: 'History', subtitle: 'From Radio Lafayette to WJRH' },
  { slug: 'team', title: 'Leadership team', subtitle: 'The people behind 104.9' },
  { slug: 'events', title: 'Events', subtitle: 'Artist shows, workshops, and trips' },
  { slug: 'get-involved', title: 'Get involved', subtitle: 'Become a DJ' },
  { slug: 'support', title: 'Support WJRH', subtitle: 'Keep student radio thriving' },
  { slug: 'contact', title: 'Contact & follow', subtitle: 'Come say hello' },
];
