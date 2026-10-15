// The station photos from the design, resized for phones (assets/README.md). Credits for each:
// frontend/assets/station-content-sources.md. Metro needs literal require() paths, hence the table.
export const IMAGES = {
  home: require('../../assets/images/home.jpg'),
  about: require('../../assets/images/about.jpg'),
  history: require('../../assets/images/history.jpg'),
  team: require('../../assets/images/our-team.jpg'),
  events: require('../../assets/images/events.jpg'),
  involved: require('../../assets/images/get-involved.jpg'),
  support: require('../../assets/images/supportwjrh.jpg'),
  contact: require('../../assets/images/contact.png'),
  // The station's own abstract artwork: the design's picture for a show that has no artwork of its own.
  signal: require('../../assets/images/signal-collage.jpg'),
} as const;

export type ImageKey = keyof typeof IMAGES;
