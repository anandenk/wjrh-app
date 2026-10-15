// DEMO ONLY. Five album covers from the design (frontend/assets/recent-cover-sources.md), resized for phones. In demo
// mode (EXPO_PUBLIC_DEMO_ARCHIVES=1) they are what a show's cover looks like while its real album cover (demo-albums.ts)
// loads or when it can't. They are not WJRH's artwork and must be replaced before any public release. Metro needs
// literal require() paths.
export const DEMO_COVERS = [
  require('../../assets/images/demo-cover-1.jpg'),
  require('../../assets/images/demo-cover-2.jpg'),
  require('../../assets/images/demo-cover-3.jpg'),
  require('../../assets/images/demo-cover-4.jpg'),
  require('../../assets/images/demo-cover-5.jpg'),
] as const;
