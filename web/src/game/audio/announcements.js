// D1: route-specific platform announcements, spoken by the browser's own
// speech synthesiser (Web Speech API — free, no recordings needed).
//
// Real Indian Railways announcements open with "यात्रीगण कृपया ध्यान दें"
// ("passengers, please pay attention") and are assembled from pre-recorded
// pieces — train, origin, destination, platform (press reports on the
// announcement system and on announcer Sarla Chaudhary's recordings). They
// are given in Hindi, English and often the regional language. No official
// script was found: the sentences below follow the familiar spoken pattern
// ("… से चलकर … को जाने वाली गाड़ी प्लेटफ़ॉर्म संख्या … पर आ रही है") and are a
// game reconstruction, not a quotation.
//
// Our train always uses platform 1 (see routes/stationLayouts.js).

const HINDI_NUMBERS = ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ'];

/** The announcement for a train arriving at `station` (pure: tested). */
export function arrivalAnnouncement({ origin, destination, station, platform = 1 }) {
  const final = station.id === destination.id;
  const pfHi = HINDI_NUMBERS[platform] ?? String(platform);
  const hindi = final
    ? `यात्रीगण कृपया ध्यान दें। ${origin.hindi ?? origin.name} से आने वाली गाड़ी प्लेटफ़ॉर्म संख्या ${pfHi} पर आ रही है।`
    : `यात्रीगण कृपया ध्यान दें। ${origin.hindi ?? origin.name} से चलकर ${destination.hindi ?? destination.name} को जाने वाली गाड़ी प्लेटफ़ॉर्म संख्या ${pfHi} पर आ रही है।`;
  const english = final
    ? `May I have your attention please. The train from ${origin.name} is arriving on platform number ${platform}.`
    : `May I have your attention please. The train from ${origin.name} to ${destination.name} is arriving on platform number ${platform}.`;
  return { hindi, english };
}

function synth() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

function pickVoice(lang) {
  const voices = synth()?.getVoices() ?? [];
  return voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang?.startsWith(lang.slice(0, 2))) ?? null;
}

/**
 * Speak the announcement: Hindi first (if the system has a Hindi voice), then
 * English, as on Indian platforms. volume 0…1. onStart/onEnd let the audio
 * engine duck the background recording.
 */
export function speakAnnouncement({ hindi, english }, { volume = 0.8, onStart, onEnd } = {}) {
  const s = synth();
  if (!s || volume <= 0) return false;
  s.cancel();
  const parts = [];
  const hi = pickVoice('hi-IN');
  if (hi) parts.push([hindi, hi, 'hi-IN']);
  parts.push([english, pickVoice('en-IN') ?? pickVoice('en-GB'), 'en-IN']);
  parts.forEach(([text, voice, lang], i) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = lang;
    u.rate = 0.92;
    u.volume = Math.min(1, volume);
    if (i === 0 && onStart) u.onstart = onStart;
    if (i === parts.length - 1 && onEnd) {
      u.onend = onEnd;
      u.onerror = onEnd;
    }
    s.speak(u);
  });
  return true;
}

export function pauseAnnouncements(paused) {
  const s = synth();
  if (!s) return;
  if (paused) s.pause();
  else s.resume();
}

export function stopAnnouncements() {
  synth()?.cancel();
}
