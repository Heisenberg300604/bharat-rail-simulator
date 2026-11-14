// Vigilance Control Device (VCD) on Indian three-phase locos. Pure logic,
// unit-tested in vcd.test.js.
//
// As described for the ABB-derived WAP-7/WAG-9 (loco pilot training handbook
// reproduced at locopilotguide.blogspot.com, "Vigilance control"; IRFCA
// confirms the VCD acts on the emergency brake):
//   • the driver must act at least every 60 s — the VCD foot switch / push
//     button, moving the throttle by more than 3 %, or sanding resets it;
//   • otherwise a buzzer and lamp warn for 8 s, then the emergency brake is
//     applied and traction goes to zero;
//   • the VCD is only active above 1.5 km/h;
//   • after a penalty: throttle to 0, wait 160 s (WAP-7/WAG-9), then reset.

export const VCD = { cycle: 60, warn: 8, activeAboveKmh: 1.5, resetWait: 160 };

export function createVcd() {
  return { phase: 'ok', timer: 0, warnT: 0, penaltyT: 0, penalties: 0 };
}

/**
 * ctx: { speedKmh, ack (driver acted this step), leverZero, dt }
 * Returns 'warn' | 'penalty' | 'reset' when that happens this step, else null.
 */
export function updateVcd(v, ctx, cfg = VCD) {
  const { dt } = ctx;
  if (v.phase === 'penalty') {
    v.penaltyT += dt;
    if (v.penaltyT >= cfg.resetWait && ctx.leverZero && ctx.ack) {
      v.phase = 'ok';
      v.timer = 0;
      v.warnT = 0;
      return 'reset';
    }
    return null;
  }
  if (ctx.speedKmh <= cfg.activeAboveKmh) {
    v.phase = 'ok';
    v.timer = 0;
    v.warnT = 0;
    return null;
  }
  if (ctx.ack) {
    v.phase = 'ok';
    v.timer = 0;
    v.warnT = 0;
    return null;
  }
  if (v.phase === 'ok') {
    v.timer += dt;
    if (v.timer >= cfg.cycle) {
      v.phase = 'warning';
      v.warnT = 0;
      return 'warn';
    }
    return null;
  }
  v.warnT += dt;
  if (v.warnT >= cfg.warn) {
    v.phase = 'penalty';
    v.penaltyT = 0;
    v.penalties++;
    return 'penalty';
  }
  return null;
}

/** Seconds left before the next event (for the HUD lamp). */
export function vcdSecondsLeft(v, cfg = VCD) {
  if (v.phase === 'ok') return cfg.cycle - v.timer;
  if (v.phase === 'warning') return cfg.warn - v.warnT;
  return Math.max(0, cfg.resetWait - v.penaltyT);
}
