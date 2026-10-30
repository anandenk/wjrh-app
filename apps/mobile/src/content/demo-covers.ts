// DEMO ONLY (EXPO_PUBLIC_DEMO_ARCHIVES=1). Five original geometric placeholder covers matching the frontend design
// (frontend/assets/recent-cover-sources.md). In demo mode they serve as local fallback placeholders while a show's
// cover loads or when remote artwork is unavailable. Metro needs literal require() paths.
export const DEMO_COVERS = [
  require('../../assets/images/demo-cover-1.jpg'),
  require('../../assets/images/demo-cover-2.jpg'),
  require('../../assets/images/demo-cover-3.jpg'),
  require('../../assets/images/demo-cover-4.jpg'),
  require('../../assets/images/demo-cover-5.jpg'),
] as const;
