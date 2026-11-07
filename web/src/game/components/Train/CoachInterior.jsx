// Indian Railways passenger coach interior (ICF Sleeper Compartment).
// Visible in the 'interior' camera view. Features authentic Indian Railways
// details: longitudinal aisle, 6-berth main bay (lower, middle, upper berths
// with rexine blue cushions), 2 side berths, luggage racks with metal slats,
// ceiling with oscillating cabin fans, partition walls, window with safety bars,
// window table with chai cup, mobile charger point, and emergency alarm chain.
// Built with ModelBuilder into merged geometries for minimal draw calls.
import * as THREE from 'three';
import { ModelBuilder } from '../../world/modelBuilder.js';

// Passenger window seat position in the sleeper bay:
// Sitting comfortably on the rear bench cushion facing forward into the bay,
// right beside the open barred window, looking across the table and out at the track.
// In coach local frame: x along coach (+x forward), y up (0 = rail top), z right (-z left towards window).
export const COACH_EYE = [-0.62, 2.08, -0.96];
export const COACH_LOOK_PITCH_DEG = -4;
export const COACH_DEFAULT_YAW_DEG = 28; // slightly angled towards the window and table

const BLUE_REXINE = '#1b3b6f'; // classic Indian Railways dark blue vinyl seat cushion
const CREAM_WALL = '#e6dcce'; // laminate partition wall
const TEAK_TRIM = '#5c3a21'; // wooden edging
const STEEL_RACK = '#9aa1a6'; // stainless steel luggage rack
const FLOOR_VINYL = '#383c40'; // grey non-slip coach flooring
const FAN_METAL = '#26282a'; // 110V DC cabin fan cage
const BAR_METAL = '#b8bcbf'; // aluminium window bars

export function buildCoachInterior() {
  const b = new ModelBuilder();

  // Extended compartment bounds: spans across two full bays (x from -3.4 to 3.4)
  // so looking down the aisle reveals a seamless coach corridor.
  const X0 = -3.4;
  const X1 = 3.4;
  const Y_FLOOR = 1.15; // floor above rail
  const Y_CEIL = 3.65; // ceiling
  const W_CABIN = 1.55; // half width of coach inside

  // 1. Non-slip vinyl floor
  b.box([X0, X1], [Y_FLOOR - 0.04, Y_FLOOR], [-W_CABIN, W_CABIN], FLOOR_VINYL);
  // Longitudinal aisle floor strip (light metal threshold edging)
  for (const z of [0.35, 0.75]) {
    b.box([X0, X1], [Y_FLOOR, Y_FLOOR + 0.005], [z - 0.015, z + 0.015], '#7a8087');
  }

  // 2. Transverse partition walls (creams with teak wood trim)
  for (const x of [-2.2, -1.1, 1.1, 2.2]) {
    // Partition from window to aisle (z = -W_CABIN to z = 0.35)
    b.box([x - 0.025, x + 0.025], [Y_FLOOR, Y_CEIL - 0.08], [-W_CABIN, 0.35], CREAM_WALL);
    b.box([x - 0.032, x + 0.032], [Y_FLOOR, Y_CEIL], [0.32, 0.36], TEAK_TRIM); // aisle pillar
    b.box([x - 0.03, x + 0.03], [Y_CEIL - 0.15, Y_CEIL - 0.08], [-W_CABIN, 0.35], TEAK_TRIM); // top molding
    // Teak baseboard
    b.box([x - 0.03, x + 0.03], [Y_FLOOR, Y_FLOOR + 0.08], [-W_CABIN, 0.35], TEAK_TRIM);
  }

  // 3. Main Bay Berths (left side: z from -W_CABIN to 0.3)
  const B_Z0 = -W_CABIN + 0.08;
  const B_Z1 = 0.28;

  // Primary bay berths (x around 0)
  const bays = [0];
  for (const bx0 of bays) {
    // Lower berths (facing benches)
    for (const bx of [bx0 - 0.65, bx0 + 0.65]) {
      // Storage trunk space underneath bench
      b.box([bx - 0.35, bx + 0.35], [Y_FLOOR, Y_FLOOR + 0.42], [B_Z0, B_Z1], '#42454a');
      // Blue rexine lower berth cushion
      b.box([bx - 0.36, bx + 0.36], [Y_FLOOR + 0.42, Y_FLOOR + 0.52], [B_Z0, B_Z1], BLUE_REXINE);
      // Backrest cushion on partition wall
      const isRear = bx < bx0;
      const wallX = isRear ? bx0 - 1.1 + 0.04 : bx0 + 1.1 - 0.04;
      b.box(isRear ? [wallX - 0.04, wallX + 0.02] : [wallX - 0.02, wallX + 0.04], [Y_FLOOR + 0.55, Y_FLOOR + 1.0], [B_Z0, B_Z1], BLUE_REXINE);
      // Headrest trim
      b.box(isRear ? [wallX - 0.045, wallX + 0.025] : [wallX - 0.025, wallX + 0.045], [Y_FLOOR + 0.98, Y_FLOOR + 1.02], [B_Z0, B_Z1], TEAK_TRIM);
    }

    // Middle berths (suspended at mid height)
    for (const mx of [bx0 - 0.68, bx0 + 0.68]) {
      b.box([mx - 0.33, mx + 0.33], [Y_FLOOR + 1.15, Y_FLOOR + 1.23], [B_Z0, B_Z1], BLUE_REXINE);
      // Suspension chains & steel brackets
      b.cylinder({ radius: 0.014, length: 0.72, axis: 'y', position: [mx, Y_FLOOR + 1.55, 0.25], color: STEEL_RACK });
      b.cylinder({ radius: 0.014, length: 0.72, axis: 'y', position: [mx, Y_FLOOR + 1.55, -W_CABIN + 0.15], color: STEEL_RACK });
    }

    // Upper berths (fixed at top with safety guard rail)
    for (const ux of [bx0 - 0.68, bx0 + 0.68]) {
      b.box([ux - 0.34, ux + 0.34], [Y_FLOOR + 1.85, Y_FLOOR + 1.94], [B_Z0, B_Z1], BLUE_REXINE);
      // Safety guard rail
      b.box([ux - 0.34, ux + 0.34], [Y_FLOOR + 1.94, Y_FLOOR + 2.10], [0.22, 0.26], STEEL_RACK);
    }

    // Steel climbing ladder to upper berths
    for (const lz of [0.24, 0.32]) {
      b.cylinder({ radius: 0.016, length: 1.85, axis: 'y', position: [bx0, Y_FLOOR + 1.0, lz], color: STEEL_RACK });
    }
    for (let ry = Y_FLOOR + 0.42; ry <= Y_FLOOR + 1.8; ry += 0.34) {
      b.cylinder({ radius: 0.012, length: 0.08, axis: 'z', position: [bx0, ry, 0.28], color: STEEL_RACK });
    }

    // Overhead luggage racks
    b.box([bx0 - 0.95, bx0 + 0.95], [Y_FLOOR + 2.05, Y_FLOOR + 2.08], [B_Z0, B_Z1 - 0.05], STEEL_RACK);
    for (let sx = bx0 - 0.9; sx <= bx0 + 0.9; sx += 0.15) {
      b.box([sx - 0.01, sx + 0.01], [Y_FLOOR + 2.08, Y_FLOOR + 2.18], [B_Z0, B_Z1 - 0.05], STEEL_RACK);
    }
  }

  // 4. Side Berths across the aisle (right side: z from 0.75 to W_CABIN)
  const S_Z0 = 0.75;
  const S_Z1 = W_CABIN - 0.05;
  for (const sx0 of [-1.65, 0.55]) {
    // Side lower berth bench
    b.box([sx0 - 0.9, sx0 + 0.9], [Y_FLOOR, Y_FLOOR + 0.42], [S_Z0, S_Z1], '#42454a');
    b.box([sx0 - 0.9, sx0 + 0.9], [Y_FLOOR + 0.42, Y_FLOOR + 0.52], [S_Z0, S_Z1], BLUE_REXINE);
    // Side upper berth
    b.box([sx0 - 0.9, sx0 + 0.9], [Y_FLOOR + 1.85, Y_FLOOR + 1.94], [S_Z0, S_Z1], BLUE_REXINE);
    b.box([sx0 - 0.9, sx0 + 0.9], [Y_FLOOR + 1.94, Y_FLOOR + 2.06], [S_Z0 + 0.02, S_Z0 + 0.05], STEEL_RACK);
  }

  // 5. Windows with Aluminium Frames, Horizontal Safety Bars, and Wooden Sills
  // Left window (beside the passenger seat):
  b.box([-0.55, 0.55], [Y_FLOOR + 0.86, Y_FLOOR + 1.68], [-W_CABIN - 0.02, -W_CABIN + 0.04], '#34383c'); // frame
  // Wooden window sill (where passengers rest their elbow)
  b.box([-0.62, 0.62], [Y_FLOOR + 0.82, Y_FLOOR + 0.86], [-W_CABIN + 0.02, -W_CABIN + 0.18], TEAK_TRIM);
  // Four aluminium safety bars
  for (let k = 1; k <= 4; k++) {
    const by = Y_FLOOR + 0.88 + (0.76 * k) / 5;
    b.cylinder({ radius: 0.009, length: 1.05, axis: 'x', position: [0, by, -W_CABIN + 0.02], color: BAR_METAL });
  }
  // Half-open glass shutter frame
  b.box([-0.52, 0.52], [Y_FLOOR + 1.35, Y_FLOOR + 1.66], [-W_CABIN + 0.005, -W_CABIN + 0.015], '#222528');
  b.box([-0.06, 0.06], [Y_FLOOR + 1.33, Y_FLOOR + 1.36], [-W_CABIN + 0.01, -W_CABIN + 0.03], '#c4a242'); // brass latch

  // Right side window (side berth):
  b.box([-0.55, 0.55], [Y_FLOOR + 0.86, Y_FLOOR + 1.68], [W_CABIN - 0.04, W_CABIN + 0.02], '#34383c');
  b.box([-0.62, 0.62], [Y_FLOOR + 0.82, Y_FLOOR + 0.86], [W_CABIN - 0.18, W_CABIN - 0.02], TEAK_TRIM);
  for (let k = 1; k <= 4; k++) {
    const by = Y_FLOOR + 0.88 + (0.76 * k) / 5;
    b.cylinder({ radius: 0.009, length: 1.05, axis: 'x', position: [0, by, W_CABIN - 0.02], color: BAR_METAL });
  }

  // 6. Cabin Ceiling & Indian Railways Oscillating Electric Fans (110V DC)
  b.box([X0, X1], [Y_CEIL - 0.05, Y_CEIL], [-W_CABIN, W_CABIN], '#e2ded5');
  for (const [fx, fz] of [
    [0.0, -0.45],
    [0.0, 0.55],
    [-2.2, -0.45],
    [2.2, -0.45],
  ]) {
    // Fan mounting stem & baseplate
    b.box([fx - 0.06, fx + 0.06], [Y_CEIL - 0.02, Y_CEIL], [fz - 0.06, fz + 0.06], FAN_METAL);
    b.cylinder({ radius: 0.018, length: 0.22, axis: 'y', position: [fx, Y_CEIL - 0.11, fz], color: FAN_METAL });
    // Fan motor body
    b.cylinder({ radius: 0.07, length: 0.09, axis: 'y', position: [fx, Y_CEIL - 0.23, fz], color: FAN_METAL });
    // Wire cage outer ring
    b.cylinder({ radius: 0.21, length: 0.04, axis: 'y', position: [fx, Y_CEIL - 0.26, fz], color: '#4a4e52' });
    // 4 curved fan blades
    b.box([fx - 0.17, fx + 0.17], [Y_CEIL - 0.27, Y_CEIL - 0.25], [fz - 0.035, fz + 0.035], '#656b72');
    b.box([fx - 0.035, fx + 0.035], [Y_CEIL - 0.27, Y_CEIL - 0.25], [fz - 0.17, fz + 0.17], '#656b72');
  }

  // 7. Ceiling light strips (warm incandescent cabin glow)
  for (const lx of [-2.2, -1.1, 0, 1.1, 2.2]) {
    b.box([lx - 0.22, lx + 0.22], [Y_CEIL - 0.04, Y_CEIL - 0.01], [-0.08, 0.08], '#fff0cf', { mat: 'lamp' });
  }

  // 8. Authentic Indian Railways Compartment Details:
  // Window table between lower berths
  b.box([-0.24, 0.24], [Y_FLOOR + 0.58, Y_FLOOR + 0.62], [-W_CABIN + 0.02, -W_CABIN + 0.42], TEAK_TRIM);
  b.cylinder({ radius: 0.018, length: 0.58, axis: 'y', position: [0, Y_FLOOR + 0.29, -W_CABIN + 0.32], color: STEEL_RACK });

  // Clay tea cup (Chai kulhad) on the window table
  b.cylinder({ radius: 0.035, radiusTop: 0.045, length: 0.08, axis: 'y', position: [0.08, Y_FLOOR + 0.66, -W_CABIN + 0.24], color: '#c27244' });
  // Stainless steel water bottle
  b.cylinder({ radius: 0.038, length: 0.22, axis: 'y', position: [-0.1, Y_FLOOR + 0.73, -W_CABIN + 0.32], color: '#b5bcc2' });

  // Mobile charging switchboard ("220V 50Hz MOBILE CHARGER ONLY") on partition wall
  b.box([1.08, 1.11], [Y_FLOOR + 1.45, Y_FLOOR + 1.58], [-W_CABIN + 0.18, -W_CABIN + 0.36], '#ffffff');
  b.box([1.11, 1.115], [Y_FLOOR + 1.47, Y_FLOOR + 1.56], [-W_CABIN + 0.2, -W_CABIN + 0.26], '#1b1c1e'); // socket 1
  b.box([1.11, 1.115], [Y_FLOOR + 1.47, Y_FLOOR + 1.56], [-W_CABIN + 0.28, -W_CABIN + 0.34], '#1b1c1e'); // socket 2
  b.box([1.11, 1.115], [Y_FLOOR + 1.54, Y_FLOOR + 1.56], [-W_CABIN + 0.265, -W_CABIN + 0.275], '#e82525', { mat: 'lamp' }); // red indicator LED

  // Emergency alarm chain box on partition wall near aisle
  b.box([1.08, 1.12], [Y_FLOOR + 2.0, Y_FLOOR + 2.22], [0.18, 0.32], '#c41c1c');
  b.cylinder({ radius: 0.016, length: 0.18, axis: 'z', position: [1.14, Y_FLOOR + 1.96, 0.25], color: '#e5b010' }); // brass pull ring

  // Berth numbering plaque ("1 - 8 / शयनयान SLEEPER")
  b.box([1.09, 1.11], [Y_FLOOR + 1.72, Y_FLOOR + 1.86], [-0.32, -0.04], '#1a437a');
  b.box([1.11, 1.115], [Y_FLOOR + 1.74, Y_FLOOR + 1.84], [-0.3, -0.06], '#ffffff');

  // Coat hooks on partition wall
  for (const hz of [-0.65, -0.45]) {
    b.box([1.09, 1.13], [Y_FLOOR + 1.62, Y_FLOOR + 1.68], [hz - 0.015, hz + 0.015], STEEL_RACK);
  }

  return b.build();
}
