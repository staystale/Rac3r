// menuvideo.js — THE MENU'S BACKGROUND RACE IS A RECORDING (owner, 2026-10-16: "can it just be a
// recording not a live race?"). PARKED behind ?menuvideo=1 (owner on the phone, 2026-10-16: "the
// video plays really slowly and laggy worse than the normal one and comes in part way thru" - the
// live race is back; revisit after the graphics update). MEASURED (CPU x4, phone size): the live
// race behind the menu took the whole CPU - 2.9 s of every 5 s on the sim and AI, 2.2 s drawing,
// frames 53 ms - so menu taps waited behind it, and setting it up was 1.2 s of the first load. Now
// media/menu-race.mp4 plays behind the menu and the game neither steps nor draws (loop.js).
// tools/menuvideo.mjs records the live race, so a new look is one command away. Suspects for the
// lag: the take is recorded while the laptop draws the race in real time (uneven frames), and 3.8
// MB comes over the tunnel first. The file is fetched whole and played from a blob: Safari will not
// play a video from a server that cannot answer byte-range requests (serve.mjs cannot), and a blob
// needs none. Until it has loaded, and whenever a phone will not autoplay (iPhone Low Power Mode),
// the still frame (media/menu-race.jpg, the poster) shows instead.

const VIDEO_URL = 'media/menu-race.mp4';
const POSTER_URL = 'media/menu-race.jpg';

let video = null;
let loading = null;

/**
 * Fetches the recording into a blob (once) and hands it to the video element.
 * @returns {Promise<void>} resolves when the video has its source
 */
function loadVideo() {
  if (!loading) loading = fetch(VIDEO_URL)
    .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(response.status)))
    .then((bytes) => {
      video.src = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
    })
    .catch(() => { /* no recording: the poster stays */ });
  return loading;
}

/**
 * Shows the recording behind the menu and plays it (the poster until it can).
 * @returns {boolean} true when the recording is in use (the game need not step or draw)
 */
export function showMenuVideo() {
  video = video || document.getElementById('menuvideo');
  if (!video) return false;
  if (!video.poster) video.poster = POSTER_URL;
  video.classList.add('on');
  loadVideo().then(() => {
    if (video.classList.contains('on')) video.play().catch(() => { /* the poster stays */ });
  });
  return true;
}

/** Hides and stops the recording (leaving the menu for a session). */
export function hideMenuVideo() {
  if (!video) return;
  video.classList.remove('on');
  video.pause();
}
