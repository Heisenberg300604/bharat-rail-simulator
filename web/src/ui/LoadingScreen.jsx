import { useEffect, useState } from 'react';
import { origin, destination } from '../game/state/gameStore.js';
import { ROUTE } from '../game/config/gameConfig.js';

const LOADING_STEPS = [
  { en: 'Laying 52 kg/m broad-gauge continuous welded rails…', hi: '52 किग्रा/मीटर ब्रॉड-गेज पटरी बिछाई जा रही है…' },
  { en: 'Energizing 25 kV AC 50 Hz overhead catenary line…', hi: '25 केवी एसी ओवरहेड ट्रैक्शन लाइन सक्रिय हो रही है…' },
  { en: 'Coupling the coach formation in the yard…', hi: 'यार्ड में कोच जोड़े जा रहे हैं…' },
  { en: 'Surveying cuttings, embankments, bridges and tunnels…', hi: 'कटिंग, तटबंध, पुल और सुरंगों का सर्वेक्षण…' },
  { en: 'WAP-7 dual-cab check & A9 air-brake pressure calibration…', hi: 'WAP-7 लोकोमोटिव और ए9 एयर ब्रेक की जांच जारी है…' },
  { en: 'Checking multi-aspect colour light signalling (MACLS)…', hi: 'सिग्नलिंग प्रणाली और पॉइंट इंटरलॉकिंग की पुष्टि हो रही है…' },
  { en: 'Line clear received — All systems ready for departure!', hi: 'लाइन क्लीयर मिल गई — प्रस्थान के लिए सब तैयार!' },
];

export default function LoadingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 420);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 18, 98));
    }, 280);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const currentStep = LOADING_STEPS[stepIndex];

  return (
    <div className="overlay overlay--loading" role="status" aria-live="polite">
      <div className="loading-card">
        {/* Header with authentic Indian Railways emblem style */}
        <div className="loading-header">
          <div className="loading-logo">
            <span className="loading-logo__wheel">⚙</span>
            <div className="loading-logo__text">
              <span className="loading-logo__title">BHARAT RAIL SIMULATOR</span>
              <span className="loading-logo__sub">भारतीय रेल सिम्युलेटर • Broad Gauge (1676 mm)</span>
            </div>
          </div>
          <span className="loading-badge">{ROUTE.meta.shortName}</span>
        </div>

        {/* Animated Track and Train SVG Stage */}
        <div className="loading-stage" aria-hidden="true">
          <svg className="loading-svg" viewBox="0 0 540 160" preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* Headlight conical beam gradient */}
              <linearGradient id="headlightBeam" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#fff8db" stopOpacity="0.85" />
                <stop offset="40%" stopColor="#ffea9f" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#ffea9f" stopOpacity="0" />
              </linearGradient>

              {/* Steel rail metallic shine */}
              <linearGradient id="railGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e8eff7" />
                <stop offset="35%" stopColor="#9fb0c3" />
                <stop offset="70%" stopColor="#677b91" />
                <stop offset="100%" stopColor="#3d4957" />
              </linearGradient>

              {/* Ballast bed gradient */}
              <linearGradient id="ballastGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#252422" />
                <stop offset="50%" stopColor="#1a1918" />
                <stop offset="100%" stopColor="#100f0e" />
              </linearGradient>

              {/* WAP-7 Loco body gradient */}
              <linearGradient id="locoBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fafaf6" />
                <stop offset="60%" stopColor="#ebebe5" />
                <stop offset="100%" stopColor="#d5d5cd" />
              </linearGradient>

              {/* ICF Coach Blue body gradient */}
              <linearGradient id="icfBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e3c80" />
                <stop offset="60%" stopColor="#24448f" />
                <stop offset="100%" stopColor="#182e63" />
              </linearGradient>

              {/* ICF Pale Blue Window Band */}
              <linearGradient id="icfBandGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#c5e3ee" />
                <stop offset="100%" stopColor="#9ccad8" />
              </linearGradient>

              {/* Repeating Concrete Sleepers Pattern */}
              <pattern id="sleeperPattern" width="30" height="24" patternUnits="userSpaceOnUse">
                {/* Concrete tie */}
                <rect x="2" y="4" width="14" height="18" rx="2" fill="#8c877e" />
                <rect x="3" y="5" width="12" height="16" rx="1.5" fill="#a39e94" />
                {/* Steel tie-plates and Pandrol clips */}
                <rect x="4" y="6" width="10" height="2" fill="#3a3733" />
                <rect x="4" y="18" width="10" height="2" fill="#3a3733" />
                <circle cx="5" cy="7" r="1" fill="#f5c225" />
                <circle cx="13" cy="7" r="1" fill="#f5c225" />
              </pattern>
            </defs>

            {/* Sky / Night atmosphere */}
            <rect x="0" y="0" width="540" height="126" fill="#0d182b" />
            {/* Distant telegraph line / OHE wire */}
            <line x1="0" y1="20" x2="540" y2="20" stroke="#546e7a" strokeWidth="1.2" strokeDasharray="3 3" />
            <line x1="0" y1="28" x2="540" y2="28" stroke="#90a4ae" strokeWidth="1.6" />

            {/* Passing OHE Mast in background */}
            <g className="loading-ohe-mast">
              <line x1="280" y1="12" x2="280" y2="128" stroke="#37474f" strokeWidth="3" />
              <line x1="265" y1="20" x2="295" y2="20" stroke="#455a64" strokeWidth="2.5" />
              <circle cx="280" cy="20" r="3" fill="#cfd8dc" />
            </g>

            {/* Ballast Stone Bed */}
            <polygon points="0,120 540,120 540,160 0,160" fill="url(#ballastGrad)" />
            <line x1="0" y1="120" x2="540" y2="120" stroke="#3e3a35" strokeWidth="2" />

            {/* Scrolling Sleepers Container */}
            <g className="loading-sleepers">
              <rect x="-60" y="118" width="660" height="24" fill="url(#sleeperPattern)" />
            </g>

            {/* Parallel Steel Rails (Broad Gauge pair) */}
            {/* Near rail */}
            <rect x="0" y="125" width="540" height="4.5" fill="url(#railGrad)" />
            <line x1="0" y1="125" x2="540" y2="125" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
            {/* Far rail */}
            <rect x="0" y="132" width="540" height="3.5" fill="url(#railGrad)" />
            <line x1="0" y1="132" x2="540" y2="132" stroke="#ffffff" strokeWidth="0.6" opacity="0.7" />

            {/* Headlight Beam shining forward */}
            <polygon points="380,82 540,40 540,140 380,94" fill="url(#headlightBeam)" opacity="0.85" />

            {/* THE TRAIN: WAP-7 + ICF Blue Coach (sways vertically with track motion) */}
            <g className="loading-train-assembly">
              {/* ----------------- COACH: Classic Blue ICF Sleeper ----------------- */}
              <g className="loading-icf-coach" transform="translate(40, 52)">
                {/* Coach Body */}
                <rect x="0" y="18" width="160" height="52" rx="4" fill="url(#icfBodyGrad)" stroke="#13244d" strokeWidth="1" />
                {/* Roof Curve */}
                <path d="M 0,22 Q 80,10 160,22 L 160,24 L 0,24 Z" fill="#b0aba0" stroke="#878379" strokeWidth="0.8" />
                {/* Circular Roof Ventilators */}
                <circle cx="20" cy="14" r="3" fill="#8f8c84" />
                <circle cx="50" cy="13" r="3" fill="#8f8c84" />
                <circle cx="80" cy="12.5" r="3" fill="#8f8c84" />
                <circle cx="110" cy="13" r="3" fill="#8f8c84" />
                <circle cx="140" cy="14" r="3" fill="#8f8c84" />

                {/* Pale-blue window band */}
                <rect x="0" y="30" width="160" height="20" fill="url(#icfBandGrad)" />
                {/* Coach Type & Class Label */}
                <text x="80" y="27" fill="#ffffff" fontSize="5.5" fontWeight="bold" textAnchor="middle" letterSpacing="0.8">
                  भारतीय रेल • SLEEPER
                </text>

                {/* Repeated Passenger Windows with bars and frames */}
                {[14, 28, 42, 56, 70, 84, 98, 112, 126, 140].map((wx) => (
                  <g key={wx}>
                    <rect x={wx} y="32" width="9" height="15" rx="1.5" fill="#0f1926" stroke="#486581" strokeWidth="0.8" />
                    {/* Window bars */}
                    <line x1={wx + 3} y1="32" x2={wx + 3} y2="47" stroke="#71889e" strokeWidth="0.6" />
                    <line x1={wx + 6} y1="32" x2={wx + 6} y2="47" stroke="#71889e" strokeWidth="0.6" />
                    {/* Interior warm glow */}
                    <rect x={wx + 1} y="33" width="7" height="6" fill="#ffeaa7" opacity="0.35" />
                  </g>
                ))}

                {/* Passenger Doors on both ends with handrails */}
                <rect x="2" y="25" width="8" height="42" fill="#1b346d" stroke="#f2c94c" strokeWidth="0.6" />
                <line x1="9" y1="30" x2="9" y2="58" stroke="#f2c94c" strokeWidth="0.8" />
                <rect x="150" y="25" width="8" height="42" fill="#1b346d" stroke="#f2c94c" strokeWidth="0.6" />
                <line x1="151" y1="30" x2="151" y2="58" stroke="#f2c94c" strokeWidth="0.8" />

                {/* Underframe solebars and battery equipment */}
                <rect x="4" y="70" width="152" height="4" fill="#1b1c1e" />
                <rect x="52" y="72" width="22" height="6" rx="1" fill="#2d3033" />
                <rect x="80" y="72" width="28" height="6" rx="1" fill="#2d3033" />

                {/* Bogie 1 (Rear) */}
                <rect x="18" y="72" width="28" height="4" fill="#232629" />
                {/* Wheels */}
                <g className="loading-wheel" transform="translate(22, 75)">
                  <circle cx="0" cy="0" r="5.5" fill="#3b3836" stroke="#c0c5cb" strokeWidth="1.2" />
                  <line x1="-4" y1="0" x2="4" y2="0" stroke="#f2a900" strokeWidth="0.8" />
                </g>
                <g className="loading-wheel" transform="translate(42, 75)">
                  <circle cx="0" cy="0" r="5.5" fill="#3b3836" stroke="#c0c5cb" strokeWidth="1.2" />
                  <line x1="-4" y1="0" x2="4" y2="0" stroke="#f2a900" strokeWidth="0.8" />
                </g>

                {/* Bogie 2 (Front) */}
                <rect x="114" y="72" width="28" height="4" fill="#232629" />
                <g className="loading-wheel" transform="translate(118, 75)">
                  <circle cx="0" cy="0" r="5.5" fill="#3b3836" stroke="#c0c5cb" strokeWidth="1.2" />
                  <line x1="-4" y1="0" x2="4" y2="0" stroke="#f2a900" strokeWidth="0.8" />
                </g>
                <g className="loading-wheel" transform="translate(138, 75)">
                  <circle cx="0" cy="0" r="5.5" fill="#3b3836" stroke="#c0c5cb" strokeWidth="1.2" />
                  <line x1="-4" y1="0" x2="4" y2="0" stroke="#f2a900" strokeWidth="0.8" />
                </g>
              </g>

              {/* ----------------- GANGWAY COUPLER ----------------- */}
              <g transform="translate(200, 78)">
                {/* Rubber bellows vestibule */}
                <rect x="0" y="0" width="8" height="38" rx="1" fill="#141414" stroke="#222" strokeWidth="0.8" />
                <line x1="2" y1="0" x2="2" y2="38" stroke="#333" strokeWidth="0.6" />
                <line x1="4" y1="0" x2="4" y2="38" stroke="#333" strokeWidth="0.6" />
                <line x1="6" y1="0" x2="6" y2="38" stroke="#333" strokeWidth="0.6" />
                {/* Coupler drawbar */}
                <rect x="0" y="38" width="8" height="3.5" fill="#1b1c1e" />
              </g>

              {/* ----------------- LOCOMOTIVE: WAP-7 ----------------- */}
              <g className="loading-loco" transform="translate(208, 44)">
                {/* Pantograph */}
                <g className="loading-pantograph">
                  {/* Base plate */}
                  <rect x="35" y="16" width="30" height="2" fill="#333" />
                  {/* Lower arm */}
                  <line x1="40" y1="16" x2="50" y2="2" stroke="#d32f2f" strokeWidth="1.8" />
                  <line x1="60" y1="16" x2="50" y2="2" stroke="#d32f2f" strokeWidth="1.8" />
                  {/* Upper knee & arm */}
                  <line x1="50" y1="2" x2="56" y2="-15" stroke="#d32f2f" strokeWidth="1.6" />
                  {/* Collector pan touching 25kV wire */}
                  <line x1="46" y1="-15" x2="66" y2="-15" stroke="#cfd8dc" strokeWidth="2.5" />
                  {/* Spark effect at wire contact */}
                  <circle cx="56" cy="-15" r="2.5" fill="#fff59d" className="loading-spark" />
                </g>

                {/* Locomotive Body (Aerodynamic cab front) */}
                <path
                  d="M 0,26 L 125,26 Q 148,26 156,48 Q 160,58 160,76 L 0,76 Z"
                  fill="url(#locoBodyGrad)"
                  stroke="#c2c2b8"
                  strokeWidth="1"
                />

                {/* Red chevron waist band (WAP-7 identity) */}
                <path d="M 0,50 L 140,50 Q 152,50 156,62 L 0,62 Z" fill="#d32f2f" />
                <line x1="0" y1="50" x2="140" y2="50" stroke="#f5c225" strokeWidth="1" />
                <line x1="0" y1="62" x2="156" y2="62" stroke="#f5c225" strokeWidth="1" />

                {/* Indian Railways & WAP-7 Lettering */}
                <text x="65" y="44" fill="#1b1c1e" fontSize="7" fontWeight="bold" letterSpacing="0.8">
                  भारतीय रेल • WAP-7
                </text>
                <text x="65" y="58" fill="#ffffff" fontSize="5.5" fontWeight="bold">
                  30201 • GZB SHED
                </text>

                {/* Side Air Louvres / Grilles */}
                {[18, 30, 42, 54, 98, 110].map((lx) => (
                  <rect key={lx} x={lx} y="32" width="8" height="12" rx="1" fill="#37474f" opacity="0.85" />
                ))}

                {/* Front Windshield (aerodynamic angled glass) */}
                <path d="M 132,32 L 146,32 L 153,46 L 132,46 Z" fill="#101820" stroke="#37474f" strokeWidth="0.8" />
                {/* Cab interior driver silhouette */}
                <circle cx="138" cy="40" r="3" fill="#455a64" />

                {/* Central Headlight (Twin beam housing) */}
                <rect x="156" y="54" width="4" height="6" rx="1.5" fill="#263238" />
                <circle cx="158" cy="57" r="2.5" fill="#fff9c4" stroke="#ffeb3b" strokeWidth="0.8" className="loading-headlamp" />

                {/* Lower Red Marker / Tail Lamps */}
                <circle cx="158" cy="67" r="1.5" fill="#b71c1c" />

                {/* Cowcatcher / Cattle Guard (front plow) */}
                <polygon points="152,78 162,78 165,85 148,85" fill="#212121" />

                {/* Bogie 1 (Rear 3 axles) */}
                <rect x="10" y="77" width="58" height="4" fill="#212121" />
                {[18, 38, 58].map((ax) => (
                  <g key={ax} className="loading-wheel" transform={`translate(${ax}, 82)`}>
                    <circle cx="0" cy="0" r="6" fill="#303030" stroke="#b0bec5" strokeWidth="1.4" />
                    <line x1="-4.5" y1="0" x2="4.5" y2="0" stroke="#f44336" strokeWidth="1" />
                  </g>
                ))}

                {/* Bogie 2 (Front 3 axles) */}
                <rect x="88" y="77" width="58" height="4" fill="#212121" />
                {[96, 116, 136].map((ax) => (
                  <g key={ax} className="loading-wheel" transform={`translate(${ax}, 82)`}>
                    <circle cx="0" cy="0" r="6" fill="#303030" stroke="#b0bec5" strokeWidth="1.4" />
                    <line x1="-4.5" y1="0" x2="4.5" y2="0" stroke="#f44336" strokeWidth="1" />
                  </g>
                ))}
              </g>
            </g>
          </svg>
        </div>

        {/* Route Progress Track & Station Markers */}
        <div className="loading-route">
          <div className="loading-station">
            <span className="loading-station__code">{origin.code}</span>
            <span className="loading-station__name">
              {origin.hindi} ({origin.name})
            </span>
          </div>

          <div className="loading-bar-track">
            <div className="loading-bar-fill" style={{ width: `${progress}%` }}>
              <span className="loading-bar-engine">🚂</span>
            </div>
          </div>

          <div className="loading-station loading-station--dest">
            <span className="loading-station__code">{destination.code}</span>
            <span className="loading-station__name">
              {destination.hindi} ({destination.name})
            </span>
          </div>
        </div>

        {/* Dynamic Status Text */}
        <div className="loading-status">
          <p className="loading-status__hi">{currentStep.hi}</p>
          <p className="loading-status__en">{currentStep.en}</p>
        </div>
      </div>
    </div>
  );
}
