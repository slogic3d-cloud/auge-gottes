// Kuratierte Startliste öffentlicher Livestreams.
// YouTube-Kanal-Einbettungen ("live_stream?channel=") zeigen immer den aktuellen Livestream des Kanals,
// auch wenn sich die Video-ID ändert. Weitere Kameras: Verkehrs-APIs, Windy oder eigene hinzufügen.
GE.CURATED_CAMS = [
  { id: 'c-earthcam', name: 'EarthCam – aktueller Livestream (z. B. Times Square)', cat: 'city', lat: 40.758, lon: -73.9855, kind: 'youtube', channel: 'UC6qrG3W8SMK0jior2olka3g', link: 'https://www.youtube.com/@earthcam/streams' },
  { id: 'c-shibuya', name: 'Tokio – Shibuya (ANN News Live)', cat: 'city', lat: 35.6595, lon: 139.7005, kind: 'youtube', channel: 'UCGCZAYq5Xxojl_tSXcVJhiQ', link: 'https://www.youtube.com/@ANNnewsCH/streams' },
  { id: 'c-explore', name: 'explore.org – Natur-Livecams', cat: 'nature', lat: 58.555, lon: -155.79, kind: 'youtube', channel: 'UC-2KSeUU5SMCX6XLRD-AEvw', link: 'https://explore.org/livecams' },
  { id: 'c-mbayaq', name: 'Monterey Bay Aquarium – Live', cat: 'nature', lat: 36.618, lon: -121.902, kind: 'youtube', channel: 'UCnM5iMGiKsZg-iOlIO2ZkdQ', link: 'https://www.montereybayaquarium.org/animals/live-cams' },
  { id: 'c-cornell', name: 'Cornell Lab – Vogel-Livecams', cat: 'nature', lat: 42.48, lon: -76.45, kind: 'youtube', channel: 'UCZXZQxS3d6NpR-eH_gdDwYA', link: 'https://www.allaboutbirds.org/cams/' },
  { id: 'c-nasa', name: 'NASA – Live (ISS, Starts, Missionen)', cat: 'space', lat: 28.5729, lon: -80.649, kind: 'youtube', channel: 'UCLA_DiR1FfKNvjuUpBHmylQ', link: 'https://www.nasa.gov/live/' },
  { id: 'c-tfl-picc', name: 'London – Piccadilly Circus (TfL JamCam, Video)', cat: 'traffic', lat: 51.5096, lon: -0.13484, kind: 'video', url: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.07450.mp4', link: 'https://tfl.gov.uk/traffic/status/' },
  { id: 'c-tfl-tower', name: 'London – Tower Bridge App. (TfL JamCam, Video)', cat: 'traffic', lat: 51.509, lon: -0.07368, kind: 'video', url: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.03500.mp4', link: 'https://tfl.gov.uk/traffic/status/' },
  { id: 'c-tfl-westm', name: 'London – Westminster Bridge (TfL JamCam, Video)', cat: 'traffic', lat: 51.5012, lon: -0.11583, kind: 'video', url: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.04227.mp4', link: 'https://tfl.gov.uk/traffic/status/' },
  { id: 'c-nyc-cpw', name: 'New York – Central Park West @ 86 St (NYC DOT)', cat: 'traffic', lat: 40.785302, lon: -73.969353, kind: 'image', url: 'https://webcams.nyctmc.org/api/cameras/8a6bc417-4877-4ebe-8052-88c1b261baf1/image', refresh: 5, link: 'https://webcams.nyctmc.org/' }
];
