// DEMO ONLY (EXPO_PUBLIC_DEMO_ARCHIVES=1). Real album covers, used as placeholder artwork so the demo looks like a
// real station app: one per show in the Archive, and one for the Now screen while the station is on automation.
//
// The pictures are NOT in the repo or the app: only these links to Apple's public image service (found with the
// iTunes Search API) are, and the app loads them when it runs, then keeps them on the phone. They are other people's
// artwork, fine for a private pitch and not licensed for a release. A real app would get covers from a source the
// station is licensed to use, or from each show's own artwork (the API's `artwork` field).
//
// The order is the grid order: bright and dark covers alternate so neighbours differ. Show N gets album N (wrapping).
export type DemoAlbum = { artist: string; album: string; /** `{size}` is the width and height in pixels. */ url: string };

export const DEMO_ALBUMS: readonly DemoAlbum[] = [
  { artist: 'Nirvana', album: 'Nevermind', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/95/fd/b9/95fdb9b2-6d2b-92a6-97f2-51c1a6d77f1a/00602527874609.rgb.jpg/{size}x{size}bb.jpg' },
  { artist: 'Joy Division', album: 'Unknown Pleasures', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/13/90/c0/1390c072-4249-3739-7b3d-fd73ee4a5698/825646562831.jpg/{size}x{size}bb.jpg' },
  { artist: 'Run The Jewels', album: 'Run The Jewels 2', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d7/32/29/d73229cf-9692-0a67-9821-1f84ed7f3b1b/198704917011_Cover.jpg/{size}x{size}bb.jpg' },
  { artist: 'Pink Floyd', album: 'The Dark Side of the Moon', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/76/b0/3e76b0e3-762b-2286-a019-8afb19cee541/886445635829.jpg/{size}x{size}bb.jpg' },
  { artist: 'Fleetwood Mac', album: 'Rumours', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/{size}x{size}bb.jpg' },
  { artist: 'Talking Heads', album: 'Remain In Light', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music/87/5f/5b/mzi.zzquknhm.jpg/{size}x{size}bb.jpg' },
  { artist: 'The Velvet Underground & Nico', album: 'The Velvet Underground & Nico', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/92/93/39/9293397f-a707-237e-ec7e-0ca613a67e3c/06UMGIM04143.rgb.jpg/{size}x{size}bb.jpg' },
  { artist: 'Arctic Monkeys', album: 'AM', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/{size}x{size}bb.jpg' },
  { artist: 'Frank Ocean', album: 'channel ORANGE', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/04/f8/63/04f863fc-2852-604f-c910-a97ac069506b/12UMGIM40339.rgb.jpg/{size}x{size}bb.jpg' },
  { artist: 'Miles Davis', album: 'Kind of Blue', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music/7f/9f/d6/mzi.vtnaewef.jpg/{size}x{size}bb.jpg' },
  { artist: 'Stevie Wonder', album: 'Songs in the Key of Life', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/eb/1f/12/eb1f12ec-474c-63aa-43af-09282f423b9d/00602537004737.rgb.jpg/{size}x{size}bb.jpg' },
  { artist: 'Joni Mitchell', album: 'Blue', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/00/a2/43/00a24363-cf69-bfd2-a26a-a042d57ab141/075992719926.jpg/{size}x{size}bb.jpg' },
  { artist: 'David Bowie', album: 'Aladdin Sane', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/aa/3e/32aa3eeb-830e-e378-dd40-ac2b701066d8/825646123582.jpg/{size}x{size}bb.jpg' },
  { artist: 'Wu-Tang Clan', album: 'Enter the Wu-Tang (36 Chambers)', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/8c/20/1f/8c201f03-7617-2d8b-3d8d-e0ba2d55041b/196872123784.jpg/{size}x{size}bb.jpg' },
  { artist: 'Tame Impala', album: 'Currents', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a8/2e/b4/a82eb490-f30a-a321-461a-0383c88fec95/15UMGIM23316.rgb.jpg/{size}x{size}bb.jpg' },
  { artist: 'Pixies', album: 'Doolittle', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/34/07/72/34077276-8f67-c638-8c4f-73dd89d2dfab/5014436905025.png/{size}x{size}bb.jpg' },
  { artist: 'The Strokes', album: 'Is This It', url: 'https://is1-ssl.mzstatic.com/image/thumb/Features115/v4/ea/04/d4/ea04d45d-6f5d-ede6-fb64-71f3e6a6e62f/dj.ojkzzidd.jpg/{size}x{size}bb.jpg' },
  { artist: 'Daft Punk', album: 'Random Access Memories', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/{size}x{size}bb.jpg' },
  { artist: 'Prince & The Revolution', album: 'Purple Rain', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/00/17/f2/0017f24f-e580-b77a-71a8-1bc7b75881bf/603497822065.jpg/{size}x{size}bb.jpg' },
  { artist: 'Sonic Youth', album: 'Daydream Nation', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/9a/55/3b/9a553bab-12a5-a385-31b7-720087fa3130/818756010958_cover.jpg/{size}x{size}bb.jpg' },
  { artist: 'Björk', album: 'Homogenic', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/7f/bd/d0/7fbdd0e0-c588-ef4b-a6dd-4dca21f8b41f/081227607364.jpg/{size}x{size}bb.jpg' },
  { artist: 'Kendrick Lamar', album: 'To Pimp a Butterfly', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/{size}x{size}bb.jpg' },
  { artist: 'Radiohead', album: 'OK Computer', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/{size}x{size}bb.jpg' },
  { artist: 'Madvillain', album: 'Madvillainy', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/2d/33/99/2d33992f-4550-269a-bab2-a2558996e5c3/816.jpg/{size}x{size}bb.jpg' },
  { artist: 'The Beatles', album: 'Abbey Road', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/{size}x{size}bb.jpg' },
  { artist: 'Portishead', album: 'Dummy', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/c1/71/93/c1719342-df7d-e9c5-c87c-53dae5afb289/00042282855329.rgb.jpg/{size}x{size}bb.jpg' },
  { artist: 'Janelle Monáe', album: 'The ArchAndroid', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/9f/12/48/9f124811-b7e8-3312-a27f-b54a553cc644/mzi.rndulspu.jpg/{size}x{size}bb.jpg' },
  { artist: 'Black Sabbath', album: 'Paranoid', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/be/27/91/be279120-2285-16c6-c7ba-9d6643d4a948/075992732727.jpg/{size}x{size}bb.jpg' },
  { artist: 'Vampire Weekend', album: 'Vampire Weekend', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ba/01/17/ba01176d-e46f-aac5-e1be-4256c26c173e/634904831868.png/{size}x{size}bb.jpg' },
  { artist: 'Herbie Hancock', album: 'Head Hunters', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/4f/e5/f5/4fe5f511-462e-e87b-0711-d4e42809fb17/dj.goshfswo.jpg/{size}x{size}bb.jpg' },
  { artist: 'Lauryn Hill', album: 'The Miseducation of Lauryn Hill', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/6b/55/096b55c4-ee8f-23bd-df8f-0ca0821f3028/886446727189.jpg/{size}x{size}bb.jpg' },
  { artist: 'Phoebe Bridgers', album: 'Punisher', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/39/91/4f/39914f60-e9aa-4ae9-3962-44b0a5e5d570/656605150062.jpg/{size}x{size}bb.jpg' },
  { artist: 'Amy Winehouse', album: 'Back to Black', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/cf/3f/09/cf3f0994-980d-d8ed-088d-ae89af256b73/15UMGIM24224.rgb.jpg/{size}x{size}bb.jpg' },
  { artist: 'Nick Drake', album: 'Pink Moon', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/2f/9a/a0/2f9aa0ed-18c9-5e42-4630-2637efbc876a/00042284292320.rgb.jpg/{size}x{size}bb.jpg' },
  { artist: 'Japanese Breakfast', album: 'Soft Sounds from Another Planet', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/20/47/60/20476017-7ede-d198-3ddb-1c7ae8b48105/656605143361.jpg/{size}x{size}bb.jpg' },
  { artist: 'Patti Smith', album: 'Horses', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/0b/cd/a8/0bcda80a-0046-aa13-1416-71d844dfb711/886445500394.jpg/{size}x{size}bb.jpg' },
];

/** The Now screen's picture while the station is on automation: a dark cover, so the text over it stays readable. */
export const AUTOMATION_ALBUM: DemoAlbum = { artist: 'The Smiths', album: 'The Queen Is Dead', url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/1a/e8/70/1ae870c3-b402-096b-c4c4-8022af5a2ed9/745099189662.jpg/{size}x{size}bb.jpg' };

export function albumForSlot(slot: number): DemoAlbum {
  return DEMO_ALBUMS[((slot % DEMO_ALBUMS.length) + DEMO_ALBUMS.length) % DEMO_ALBUMS.length];
}

/** Where to load an album's cover from, at a size in pixels. */
export function albumArtUrl(album: DemoAlbum, size: number): string {
  return album.url.replace(/\{size\}/g, String(size));
}
