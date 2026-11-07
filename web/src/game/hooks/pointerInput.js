// Mouse/trackpad input for the cameras: drag to look/orbit, wheel to zoom,
// double-click to reset. Movement is accumulated here and consumed by the
// active camera each frame, so it never triggers React re-renders.
export const pointer = {
  dx: 0,
  dy: 0,
  wheel: 0,
  reset: false,
  dragging: false,
};

export function consumePointer() {
  const out = { dx: pointer.dx, dy: pointer.dy, wheel: pointer.wheel, reset: pointer.reset };
  pointer.dx = pointer.dy = pointer.wheel = 0;
  pointer.reset = false;
  return out;
}

/** Attach listeners to the canvas element. Returns a cleanup function. */
export function attachPointer(el) {
  const down = (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    pointer.dragging = true;
    el.setPointerCapture?.(e.pointerId);
    el.style.cursor = 'grabbing';
  };
  const move = (e) => {
    if (!pointer.dragging) return;
    pointer.dx += e.movementX;
    pointer.dy += e.movementY;
  };
  const up = (e) => {
    pointer.dragging = false;
    el.releasePointerCapture?.(e.pointerId);
    el.style.cursor = 'grab';
  };
  const wheel = (e) => {
    e.preventDefault(); // stop page zoom/scroll (trackpad pinch on Mac sends ctrl+wheel)
    pointer.wheel += Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120);
  };
  const dbl = () => {
    pointer.reset = true;
  };
  const ctx = (e) => e.preventDefault();
  el.style.cursor = 'grab';
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', wheel, { passive: false });
  el.addEventListener('dblclick', dbl);
  el.addEventListener('contextmenu', ctx);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('wheel', wheel);
    el.removeEventListener('dblclick', dbl);
    el.removeEventListener('contextmenu', ctx);
  };
}
