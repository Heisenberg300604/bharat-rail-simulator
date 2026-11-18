// One canvas-drawn texture atlas for all the rich scenery (original artwork, no
// downloads): plaster walls with windows, exposed brick, shop shutters, roof
// tiles, thatch, tin, tarpaulin, boundary walls, shop signboards and painted
// wall ads (generic words in English + the route's own script; no brands).
//
// The atlas is 8 × 4 tiles of 128 px. A part picks its tile with the `aTile`
// vertex attribute (see kit.js); the shader repeats the tile with fract() so a
// 20 m wall shows five windows, not one stretched window.
import * as THREE from 'three';
import { seededRandom } from './geometry.js';
import { DEVANAGARI, REGIONAL_FONTS } from './textures.js';

export const TILE = {
  PLAIN: 0, // white: colour comes from the vertex colour (trees, props, paint)
  WIN: 1, // plaster + window with a chajja (sunshade); 4 m × 3 m per repeat
  WIN_GRILLE: 2, // plaster + window with a grille
  BRICK: 3, // exposed red brick
  BRICK_WIN: 4, // exposed brick + window opening
  SHUTTER: 5, // rolling shutter, half open
  SHOP: 6, // open shop front with shelves and hanging sachet strips
  MUD: 7, // mud-plastered hut wall
  ROOF_TILES: 8, // Mangalore-style clay tiles
  THATCH: 9,
  TIN: 10, // corrugated sheet
  TARP: 11, // blue tarpaulin
  CONCRETE: 12,
  WALL: 13, // whitewashed boundary wall with grime
  HAY: 14,
  DUNG: 15, // dung cakes (upla / gobar) stacked to dry
  SIGN: 16, // 16…23 shop signboards
  AD: 24, // 24…27 painted wall ads
  LEAVES: 28,
  STONE: 29, // dressed stone blocks (laterite / basalt by vertex colour)
  BARK: 30,
  STRIPES: 31, // red-and-white temple-wall stripes (south India)
};
export const SIGN_COUNT = 8;
export const AD_COUNT = 4;
/** Tiles whose window rectangle may light up at night. */
const WINDOW_TILES = [TILE.WIN, TILE.WIN_GRILLE, TILE.BRICK_WIN];

const T = 128;
const COLS = 8;
const ROWS = 4;

const SIGNS_EN = ['KIRANA STORE', 'CHAI', 'SWEETS', 'MEDICAL', 'MOBILE', 'TAILORS', 'HARDWARE', 'HOTEL'];
const SIGNS = {
  deva: ['किराना स्टोर', 'चाय', 'मिठाई', 'मेडिकल', 'मोबाइल', 'टेलर्स', 'हार्डवेयर', 'होटल'],
  beng: ['মুদিখানা', 'চা', 'মিষ্টি', 'ওষুধ', 'মোবাইল', 'দর্জি', 'হার্ডওয়্যার', 'হোটেল'],
  taml: ['மளிகை', 'டீ', 'இனிப்பு', 'மருந்தகம்', 'மொபைல்', 'டெய்லர்ஸ்', 'ஹார்டுவேர்', 'உணவகம்'],
};
const SIGN_BG = ['#c62828', '#1565c0', '#f9a825', '#2e7d32', '#ef6c00', '#f5f5f0', '#7b1f2a', '#00838f'];
const ADS_EN = ['CEMENT · SARIYA', 'COACHING CLASSES', 'PIPES & FITTINGS', 'TILES · MARBLE'];
const ADS = {
  deva: ['सीमेंट · सरिया', 'कोचिंग क्लासेस', 'पाइप फिटिंग्स', 'टाइल्स · मार्बल'],
  beng: ['সিমেন্ট · রড', 'কোচিং ক্লাস', 'পাইপ ফিটিংস', 'টাইলস · মার্বেল'],
  taml: ['சிமெண்ட் · கம்பி', 'கோச்சிங் வகுப்புகள்', 'பைப் ஃபிட்டிங்ஸ்', 'டைல்ஸ் · மார்பிள்'],
};
const AD_INK = ['#c62828', '#1a4fa0', '#1b7a3a', '#6a1b9a'];

function fontFor(script) {
  return script === 'deva' ? DEVANAGARI : (REGIONAL_FONTS[script] ?? DEVANAGARI);
}

/** Draws every tile. `script` = the route's regional script ('deva' | 'beng' | 'taml'). */
export function makeSceneryAtlas(script = 'deva') {
  const c = document.createElement('canvas');
  c.width = T * COLS;
  c.height = T * ROWS;
  const g = c.getContext('2d');
  const rand = seededRandom(77);
  const tile = (i, fn) => {
    g.save();
    g.translate((i % COLS) * T, Math.floor(i / COLS) * T);
    g.beginPath();
    g.rect(0, 0, T, T);
    g.clip();
    fn();
    g.restore();
  };
  const noise = (n, rgba, min = 1, max = 5) => {
    for (let k = 0; k < n; k++) {
      g.fillStyle = rgba(rand());
      const r = min + rand() * (max - min);
      g.fillRect(rand() * T, rand() * T, r, r);
    }
  };
  const streaks = (n, color) => {
    for (let k = 0; k < n; k++) {
      g.fillStyle = color;
      const x = rand() * T;
      g.fillRect(x, rand() * T * 0.5, 1 + rand() * 2, 20 + rand() * 60);
    }
  };
  // window rectangle (matches the night-glow test in the shader)
  const WX0 = 0.29 * T, WX1 = 0.71 * T, WY0 = (1 - 0.74) * T, WY1 = (1 - 0.34) * T;
  const windowPane = (grille) => {
    g.fillStyle = '#2b3036';
    g.fillRect(WX0, WY0, WX1 - WX0, WY1 - WY0);
    g.fillStyle = '#56646d';
    g.fillRect(WX0 + 4, WY0 + 4, (WX1 - WX0) / 2 - 6, WY1 - WY0 - 8);
    g.fillStyle = '#3c474e';
    g.fillRect(WX0 + (WX1 - WX0) / 2 + 2, WY0 + 4, (WX1 - WX0) / 2 - 6, WY1 - WY0 - 8);
    if (grille) {
      g.fillStyle = '#1d2226';
      for (let x = WX0 + 5; x < WX1 - 2; x += 6) g.fillRect(x, WY0, 1.5, WY1 - WY0);
      g.fillRect(WX0, (WY0 + WY1) / 2, WX1 - WX0, 1.5);
    }
  };

  tile(TILE.PLAIN, () => {
    g.fillStyle = '#f4f4f4';
    g.fillRect(0, 0, T, T);
    noise(260, (r) => `rgba(0,0,0,${r * 0.05})`, 2, 7);
  });
  for (const [id, grille] of [
    [TILE.WIN, false],
    [TILE.WIN_GRILLE, true],
  ]) {
    tile(id, () => {
      g.fillStyle = '#f2efe8';
      g.fillRect(0, 0, T, T);
      noise(500, (r) => `rgba(80,70,60,${r * 0.08})`, 2, 6);
      streaks(6, 'rgba(70,60,50,0.06)');
      g.fillStyle = '#d6d0c4';
      g.fillRect(0, T - 10, T, 10); // floor band
      windowPane(grille);
      g.fillStyle = '#bdb6a8';
      g.fillRect(WX0 - 8, WY0 - 9, WX1 - WX0 + 16, 7); // chajja
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(WX0 - 8, WY0 - 2, WX1 - WX0 + 16, 3);
      if (grille) {
        g.fillStyle = '#c9c2b4';
        g.fillRect(WX0 - 4, WY1 + 2, WX1 - WX0 + 8, 4); // sill
      }
    });
  }
  const bricks = () => {
    g.fillStyle = '#b8a48d';
    g.fillRect(0, 0, T, T);
    const reds = ['#9c4a32', '#a8553a', '#8e4029', '#b05e3e', '#94462e'];
    for (let y = 0; y < T; y += 4) {
      const off = (y / 4) % 2 ? 5 : 0;
      for (let x = -off; x < T; x += 10) {
        g.fillStyle = reds[Math.floor(rand() * reds.length)];
        g.fillRect(x, y, 9, 3);
      }
    }
    noise(120, (r) => `rgba(30,20,10,${r * 0.12})`, 2, 8);
  };
  tile(TILE.BRICK, bricks);
  tile(TILE.BRICK_WIN, () => {
    bricks();
    g.fillStyle = '#9a9184';
    g.fillRect(WX0 - 6, WY0 - 6, WX1 - WX0 + 12, 5); // concrete lintel
    windowPane(true);
  });
  tile(TILE.SHUTTER, () => {
    g.fillStyle = '#e6e0d4';
    g.fillRect(0, 0, T, T);
    g.fillStyle = '#20232a';
    g.fillRect(8, 20, T - 16, T - 20); // opening
    // the shutter rolled two-thirds down, ribbed
    for (let y = 20; y < 82; y += 3) {
      g.fillStyle = y % 6 ? '#8d9296' : '#7a7f84';
      g.fillRect(8, y, T - 16, 3);
    }
    g.fillStyle = 'rgba(120,70,40,0.35)';
    for (let k = 0; k < 6; k++) g.fillRect(8 + rand() * (T - 30), 20 + rand() * 55, 6 + rand() * 12, 4 + rand() * 10);
    // goods glimpsed below
    for (let k = 0; k < 14; k++) {
      g.fillStyle = ['#d84315', '#f9a825', '#1565c0', '#2e7d32', '#ad1457', '#eeeeee'][Math.floor(rand() * 6)];
      g.fillRect(12 + rand() * (T - 30), 92 + rand() * 26, 5 + rand() * 6, 5 + rand() * 6);
    }
  });
  tile(TILE.SHOP, () => {
    g.fillStyle = '#e6e0d4';
    g.fillRect(0, 0, T, T);
    g.fillStyle = '#2a2622';
    g.fillRect(6, 14, T - 12, T - 14);
    // shelves of packets
    for (let row = 0; row < 4; row++) {
      const y = 40 + row * 20;
      g.fillStyle = '#6b5236';
      g.fillRect(6, y + 14, T - 12, 3);
      for (let x = 10; x < T - 12; x += 7) {
        g.fillStyle = ['#d84315', '#f9a825', '#1565c0', '#2e7d32', '#ad1457', '#f5f5f5', '#6a1b9a'][Math.floor(rand() * 7)];
        g.fillRect(x, y + 2 + rand() * 4, 5, 10);
      }
    }
    // hanging sachet strips
    for (let x = 10; x < T - 10; x += 9) {
      const col = ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc'][Math.floor(rand() * 5)];
      for (let y = 16; y < 34 + rand() * 6; y += 4) {
        g.fillStyle = col;
        g.fillRect(x, y, 5, 3);
      }
    }
    g.fillStyle = '#8a7a64'; // counter
    g.fillRect(6, T - 18, T - 12, 18);
  });
  tile(TILE.MUD, () => {
    g.fillStyle = '#b08a5e';
    g.fillRect(0, 0, T, T);
    noise(600, (r) => (r > 0.5 ? `rgba(90,60,30,${r * 0.12})` : `rgba(230,210,170,${r * 0.15})`), 2, 9);
    g.fillStyle = 'rgba(70,45,25,0.25)';
    g.fillRect(0, T - 20, T, 20);
    g.strokeStyle = 'rgba(60,40,20,0.3)';
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      let x = rand() * T, y = rand() * T;
      g.moveTo(x, y);
      for (let s = 0; s < 4; s++) g.lineTo((x += (rand() - 0.5) * 20), (y += rand() * 12));
      g.stroke();
    }
  });
  tile(TILE.ROOF_TILES, () => {
    g.fillStyle = '#7a3420';
    g.fillRect(0, 0, T, T);
    for (let y = 0; y < T; y += 8) {
      for (let x = (y / 8) % 2 ? -6 : 0; x < T; x += 12) {
        const v = rand();
        g.fillStyle = v < 0.33 ? '#b0553a' : v < 0.66 ? '#a24c31' : '#bd6444';
        g.fillRect(x + 1, y, 10, 6);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + 1, y + 6, 10, 2);
      }
    }
    noise(70, (r) => `rgba(40,50,30,${r * 0.25})`, 3, 9); // monsoon moss
  });
  tile(TILE.THATCH, () => {
    g.fillStyle = '#8f7444';
    g.fillRect(0, 0, T, T);
    for (let k = 0; k < 900; k++) {
      g.strokeStyle = ['#c2a463', '#a88a50', '#7d6339', '#d1b878'][Math.floor(rand() * 4)];
      g.lineWidth = 1;
      const x = rand() * T, y = rand() * T;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rand() - 0.5) * 4, y + 6 + rand() * 10);
      g.stroke();
    }
  });
  tile(TILE.TIN, () => {
    for (let x = 0; x < T; x += 4) {
      g.fillStyle = x % 8 ? '#9ba1a4' : '#7f8588';
      g.fillRect(x, 0, 4, T);
    }
    for (let k = 0; k < 9; k++) {
      g.fillStyle = `rgba(${130 + rand() * 30},${70 + rand() * 20},40,${0.25 + rand() * 0.35})`;
      g.beginPath();
      g.ellipse(rand() * T, rand() * T, 6 + rand() * 18, 4 + rand() * 12, 0, 0, Math.PI * 2);
      g.fill();
    }
  });
  tile(TILE.TARP, () => {
    g.fillStyle = '#2f6db3';
    g.fillRect(0, 0, T, T);
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,40,0.18)';
      g.lineWidth = 2 + rand() * 5;
      g.beginPath();
      const x = rand() * T;
      g.moveTo(x, 0);
      g.lineTo(x + (rand() - 0.5) * 50, T);
      g.stroke();
    }
    noise(60, (r) => `rgba(20,20,20,${r * 0.2})`, 2, 6);
  });
  tile(TILE.CONCRETE, () => {
    g.fillStyle = '#b3aea5';
    g.fillRect(0, 0, T, T);
    noise(500, (r) => `rgba(60,55,50,${r * 0.1})`, 2, 7);
    streaks(10, 'rgba(50,45,40,0.12)');
  });
  tile(TILE.WALL, () => {
    g.fillStyle = '#ece9e2';
    g.fillRect(0, 0, T, T);
    noise(400, (r) => `rgba(90,80,70,${r * 0.08})`, 2, 8);
    streaks(12, 'rgba(80,70,60,0.08)');
    const grime = g.createLinearGradient(0, T * 0.6, 0, T);
    grime.addColorStop(0, 'rgba(110,95,75,0)');
    grime.addColorStop(1, 'rgba(110,95,75,0.6)');
    g.fillStyle = grime;
    g.fillRect(0, T * 0.6, T, T * 0.4);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, 0, T, 5); // coping
  });
  tile(TILE.HAY, () => {
    g.fillStyle = '#b8964e';
    g.fillRect(0, 0, T, T);
    for (let k = 0; k < 900; k++) {
      g.strokeStyle = ['#e0c374', '#c9a95c', '#9c7c3f', '#ecd690'][Math.floor(rand() * 4)];
      const x = rand() * T, y = rand() * T, a = rand() * Math.PI;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
      g.stroke();
    }
  });
  tile(TILE.DUNG, () => {
    g.fillStyle = '#4e3a27';
    g.fillRect(0, 0, T, T);
    for (let y = 6; y < T + 8; y += 13) {
      for (let x = (y / 13) % 2 ? 0 : 7; x < T + 8; x += 14) {
        g.fillStyle = ['#7a5d3f', '#6d5236', '#86684a', '#5f4630'][Math.floor(rand() * 4)];
        g.beginPath();
        g.ellipse(x, y, 6.5, 5.5, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x - 5, y + 4, 10, 1.5);
      }
    }
  });
  // Signboards: the board is ~4 m × 1 m, so text is drawn squashed 4:1 and the
  // board's stretch restores it.
  const fitText = (text, font, maxW, size, x, y, scaleX) => {
    let px = size;
    g.font = `bold ${px}px ${font}`;
    while (g.measureText(text).width * scaleX > maxW && px > 8) {
      px -= 2;
      g.font = `bold ${px}px ${font}`;
    }
    g.save();
    g.translate(x, y);
    g.scale(scaleX, 1);
    g.fillText(text, 0, 0);
    g.restore();
  };
  const regional = SIGNS[script] ?? SIGNS.deva;
  const regionalFont = fontFor(script);
  for (let k = 0; k < SIGN_COUNT; k++) {
    tile(TILE.SIGN + k, () => {
      const bg = SIGN_BG[k];
      const light = bg === '#f9a825' || bg === '#f5f5f0';
      g.fillStyle = bg;
      g.fillRect(0, 0, T, T);
      g.strokeStyle = light ? '#7b1f2a' : '#ffffff';
      g.lineWidth = 6;
      g.strokeRect(4, 6, T - 8, T - 12);
      g.fillStyle = light ? '#7b1f2a' : '#ffffff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      fitText(regional[k], regionalFont, T - 14, 50, T / 2, T * 0.36, 0.25);
      g.fillStyle = light ? '#1a1a1a' : '#fff3c4';
      fitText(SIGNS_EN[k], 'Helvetica, Arial, sans-serif', T - 14, 34, T / 2, T * 0.74, 0.25);
    });
  }
  const adRegional = ADS[script] ?? ADS.deva;
  for (let k = 0; k < AD_COUNT; k++) {
    // painted on a whitewashed wall panel ~6 m × 2.2 m → squash 2.7:1
    tile(TILE.AD + k, () => {
      g.fillStyle = '#f1eee6';
      g.fillRect(0, 0, T, T);
      noise(200, (r) => `rgba(90,80,70,${r * 0.08})`, 2, 6);
      g.fillStyle = AD_INK[k];
      g.fillRect(0, 0, T, 16);
      g.fillRect(0, T - 12, T, 12);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = AD_INK[k];
      fitText(adRegional[k], regionalFont, T - 8, 44, T / 2, T * 0.42, 0.37);
      g.fillStyle = '#222';
      fitText(ADS_EN[k], 'Impact, Helvetica, Arial, sans-serif', T - 8, 30, T / 2, T * 0.7, 0.37);
      const grime = g.createLinearGradient(0, T * 0.75, 0, T);
      grime.addColorStop(0, 'rgba(110,95,75,0)');
      grime.addColorStop(1, 'rgba(110,95,75,0.45)');
      g.fillStyle = grime;
      g.fillRect(0, T * 0.75, T, T * 0.25);
    });
  }
  tile(TILE.LEAVES, () => {
    g.fillStyle = '#ececec';
    g.fillRect(0, 0, T, T);
    for (let k = 0; k < 700; k++) {
      const v = rand();
      g.fillStyle = v < 0.5 ? 'rgba(60,70,50,0.14)' : v < 0.85 ? 'rgba(255,255,245,0.22)' : 'rgba(40,50,30,0.22)';
      g.beginPath();
      g.ellipse(rand() * T, rand() * T, 1.5 + rand() * 3, 1 + rand() * 2, rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  });
  tile(TILE.STONE, () => {
    g.fillStyle = '#9a948a';
    g.fillRect(0, 0, T, T);
    for (let y = 0; y < T; y += 16) {
      for (let x = (y / 16) % 2 ? -14 : 0; x < T; x += 28) {
        const v = 0.85 + rand() * 0.3;
        g.fillStyle = `rgb(${Math.round(225 * v)},${Math.round(220 * v)},${Math.round(212 * v)})`;
        g.fillRect(x + 1, y + 1, 26, 14);
      }
    }
    noise(150, (r) => `rgba(30,25,20,${r * 0.15})`, 2, 5);
  });
  tile(TILE.BARK, () => {
    g.fillStyle = '#d8d2c8';
    g.fillRect(0, 0, T, T);
    for (let k = 0; k < 160; k++) {
      g.fillStyle = `rgba(40,30,20,${0.08 + rand() * 0.2})`;
      g.fillRect(rand() * T, rand() * T, 1 + rand() * 2, 10 + rand() * 30);
    }
  });
  tile(TILE.STRIPES, () => {
    for (let x = 0; x < T; x += 32) {
      g.fillStyle = '#b3312a';
      g.fillRect(x, 0, 16, T);
      g.fillStyle = '#f2ece0';
      g.fillRect(x + 16, 0, 16, T);
    }
    noise(150, (r) => `rgba(60,50,40,${r * 0.12})`, 2, 6);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** Night window glow for the rich scenery (set from the environment, 0 = day). */
export const kitGlow = { value: 0 };

/**
 * The single material every rich-scenery chunk uses: vertex colour × atlas
 * tile, flat lighting, fog, and lit windows / signboards at night.
 */
export function makeKitMaterial(atlas) {
  const mat = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.92, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uKitGlow = kitGlow;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aTile;
        varying vec2 vKitUv;
        varying float vKitTile;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vKitUv = uv;
        vKitTile = aTile;`,
      );
    const winTest = WINDOW_TILES.map((t) => `tileId == ${t.toFixed(1)}`).join(' || ');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uKitGlow;
        varying vec2 vKitUv;
        varying float vKitTile;`,
      )
      .replace(
        '#include <map_fragment>',
        `
        float tileId = floor(vKitTile);
        vec2 cell = vec2(mod(tileId, ${COLS}.0), floor(tileId / ${COLS}.0));
        vec2 inner = mix(vec2(0.02), vec2(0.98), fract(vKitUv));
        vec2 auv = vec2((cell.x + inner.x) / ${COLS}.0, (${ROWS - 1}.0 - cell.y + inner.y) / ${ROWS}.0);
        vec2 gs = vec2(0.96 / ${COLS}.0, 0.96 / ${ROWS}.0);
        vec4 kitTexel = textureGrad(map, auv, dFdx(vKitUv) * gs, dFdy(vKitUv) * gs);
        diffuseColor *= kitTexel;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uKitGlow > 0.0) {
          if (${winTest}) {
            vec2 cellId = floor(vKitUv);
            vec2 f = fract(vKitUv);
            float inWin = step(0.29, f.x) * step(f.x, 0.71) * step(0.34, f.y) * step(f.y, 0.74);
            float h = fract(sin(dot(cellId + fract(vKitTile) * 57.0, vec2(12.9898, 78.233))) * 43758.5453);
            vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(0.8, 0.92, 1.0), step(0.82, h));
            totalEmissiveRadiance += warm * inWin * step(0.55, h) * uKitGlow * (0.7 + 0.6 * fract(h * 13.7));
          } else if (tileId >= ${TILE.SIGN}.0 && tileId < ${TILE.SIGN + SIGN_COUNT}.0) {
            totalEmissiveRadiance += kitTexel.rgb * 0.35 * uKitGlow; // shop boards lit by a tube light
          }
        }`,
      );
  };
  return mat;
}
