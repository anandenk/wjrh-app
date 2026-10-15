// DEMO ONLY (EXPO_PUBLIC_DEMO_ARCHIVES=1). Sample genres and descriptions for the real shows, which have none in the
// API yet, so the show pages, archive pages and Schedule can be shown complete. They are guesses from each show's name
// (and, for the eight shows whose genre the station's calendar does give, they agree with it), written to say nothing
// about the hosts as people. Hosts should write their own. Screens label them "Sample description".
//
// They only fill gaps: a genre or description that really comes from the API or the calendar always wins.

export type DemoShowInfo = {
  /** A short genre line in the style of the calendar's ("Folk and anti-folk"). */
  genres: string;
  description: string;
};

const INFO: Record<string, DemoShowInfo> = {
  'alternative-sound': {
    genres: 'Alternative, indie',
    description: 'Guitar-forward alternative and indie, from the college-radio classics to this month’s new releases.',
  },
  'amber-on-audio': {
    genres: 'Indie pop, singer-songwriter',
    description: 'A warm, personal hour of indie pop and singer-songwriters, with a story or two behind the songs.',
  },
  'api-on-air': {
    genres: 'Electronic, tech talk',
    description: 'Electronic music with a little tech talk on the side: what’s new in the studio, on campus and in the music world.',
  },
  'barthalomew-the-aquarium': {
    genres: 'Experimental, ambient',
    description: 'An offbeat deep-sea dive through experimental, ambient and just plain strange records.',
  },
  'basement-jams': {
    genres: 'Garage, punk, DIY',
    description: 'Loud, loose garage rock, punk and DIY bands: the records that sound best played in a basement.',
  },
  'c-squared': {
    genres: 'Indie, pop',
    description: 'Two hosts, one playlist: indie, pop and whatever else the pair can’t stop listening to.',
  },
  earworm: {
    genres: 'Pop, throwbacks',
    description: 'Songs that stick in your head: catchy pop, guilty pleasures and throwbacks you’ll be humming all week.',
  },
  'fatou-talks': {
    genres: 'Talk, music',
    description: 'Conversation and music: chats, campus news and the songs that go with them.',
  },
  'fern-s-folk-fun': {
    genres: 'Folk, acoustic',
    description: 'Acoustic and folk music for a slow morning, from old standards to new voices.',
  },
  'freak-show': {
    genres: 'Experimental, noise',
    description: 'A celebration of the strange: experimental, noise and left-field records that don’t fit anywhere else.',
  },
  giuseppe: {
    genres: 'Eclectic',
    description: 'Two hosts, one mic and a very mixed playlist. Expect a little of everything.',
  },
  'harry-son-s-hits': {
    genres: 'Pop/Sports talk',
    description: 'Pop hits and sports talk in one show: the week’s games, the big debates and songs to match.',
  },
  'j-j-jams': {
    genres: 'Pop, dance, R&B',
    description: 'Two hosts and their favorite jams: upbeat pop, dance and R&B to get the week moving.',
  },
  'mayo-s-mix': {
    genres: 'Mixtape, eclectic',
    description: 'A mixtape in radio form: a hand-built mix of songs that shouldn’t work together, but do.',
  },
  mouthpeace: {
    genres: 'Spoken word, music',
    description: 'Words and music: poetry, spoken word and the songs that say it best.',
  },
  'naive-melody': {
    genres: 'Indie, dream pop',
    description: 'Dreamy, melodic indie and dream pop: songs that sound like they were written in a bedroom.',
  },
  'off-the-record': {
    genres: 'Music talk, trivia',
    description: 'The stories that don’t make the liner notes: music history, trivia and behind-the-scenes tales.',
  },
  'playlist-of-the-month': {
    genres: 'Curated, themed',
    description: 'A new theme each month, with one carefully built playlist to match.',
  },
  'postmodern-jrh': {
    genres: 'Ambient, electronic, jazz',
    description: 'A slow Sunday-morning mix of ambient, electronic and jazz for waking up gently.',
  },
  'rock-on-evening': {
    genres: 'Rock, pop punk, emo, alternative',
    description: 'Evening rock for guitar fans: pop punk, emo and alternative favorites, loud and ready to sing along.',
  },
  'sarah-smiles': {
    genres: 'Music/Popculture (movies, shows, etc.)',
    description: 'Music and pop culture: what’s new in movies, TV and the charts, with plenty of songs along the way.',
  },
  soupburger: {
    genres: 'everything',
    description: 'Everything, in no particular order: a genre-free show that goes wherever the hosts’ tastes do.',
  },
  supercut: {
    genres: 'Indie, alternative, oldies',
    description: 'Indie and alternative favorites cut together with oldies: new and old records that belong in the same breath.',
  },
  'the-bit': {
    genres: 'Eclectic, alternative, metal, jazz, soul, R and B, electronic, etc.',
    description: 'A bit of everything: eclectic sets that jump from metal to jazz to soul to electronic.',
  },
  'the-rodeo': {
    genres: 'Folk and anti-folk',
    description: 'Folk and anti-folk: storytelling songs, rough edges and the odd sing-along.',
  },
  'the-spinoff-with-orry': {
    genres: 'HipHop, soul, jazz, rock, ect.',
    description: 'A spin through hip-hop, soul, jazz and rock, where one record leads to the next, and the next.',
  },
  'what-s-poppin-radio-show': {
    genres: 'Pop, hip-hop',
    description: 'The pop, rap and R&B that’s popping right now, with a little chatter in between.',
  },
};

/** Show ids that have a hand-written sample, for tests. */
export const DEMO_SHOW_INFO_IDS: readonly string[] = Object.keys(INFO);

/**
 * The sample genre line and description for a show. A show that is not in the list (a new one) gets a plain
 * stand-in built from its name, so a new show never shows up blank in the demo.
 */
export function demoShowInfo(showId: string, showName: string): DemoShowInfo {
  return (
    INFO[showId] ?? {
      genres: 'Eclectic',
      description: `${showName}: a sample description for the demo. The hosts will write their own.`,
    }
  );
}
