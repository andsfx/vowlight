// Keyboard steering, pointer aim, the brace keys and the one-shot keys (start, restart, mute).

const MOVE_KEYS = {
  KeyW: [0, -1],
  KeyA: [-1, 0],
  KeyS: [0, 1],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowRight: [1, 0],
};

/** The keys that act once per press rather than while held. */
const ONE_SHOT_KEYS = new Set(['Space', 'Enter', 'KeyR', 'KeyM']);

/** Keyboard held state, pointer position in field coordinates, and the frame's one-shot presses. */
export function createInput(canvas) {
  const input = {
    held: new Set(),
    pressed: new Set(),
    pointer: { x: 640, y: 360, moved: false, inside: false, leftDown: false, rightDown: false },
    viewport: { scale: 1, offsetX: 0, offsetY: 0 },
    detach: null,
  };

  const onKeyDown = (event) => {
    if (MOVE_KEYS[event.code] || ONE_SHOT_KEYS.has(event.code)) event.preventDefault();
    if (!event.repeat) input.pressed.add(event.code);
    input.held.add(event.code);
  };
  const onKeyUp = (event) => {
    input.held.delete(event.code);
  };
  const onBlur = () => {
    input.held.clear();
    input.pointer.leftDown = false;
    input.pointer.rightDown = false;
  };
  const toField = (event) => {
    const rect = canvas.getBoundingClientRect();
    const { scale, offsetX, offsetY } = input.viewport;
    input.pointer.x = (event.clientX - rect.left - offsetX) / scale;
    input.pointer.y = (event.clientY - rect.top - offsetY) / scale;
  };
  const onPointerMove = (event) => {
    toField(event);
    input.pointer.moved = true;
    input.pointer.inside = true;
  };
  const onPointerDown = (event) => {
    toField(event);
    input.pointer.moved = true;
    input.pointer.inside = true;
    if (event.button === 2) input.pointer.rightDown = true;
    else input.pointer.leftDown = true;
    canvas.focus?.();
  };
  const onPointerUp = (event) => {
    if (event.button === 2) input.pointer.rightDown = false;
    else input.pointer.leftDown = false;
  };
  const onPointerLeave = () => {
    input.pointer.inside = false;
    input.pointer.rightDown = false;
  };
  const onContextMenu = (event) => event.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('contextmenu', onContextMenu);

  input.detach = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('contextmenu', onContextMenu);
  };
  return input;
}

/** Where logical field coordinates sit in the canvas element, for mapping the pointer. */
export function setInputViewport(input, scale, offsetX, offsetY) {
  input.viewport.scale = scale;
  input.viewport.offsetX = offsetX;
  input.viewport.offsetY = offsetY;
}

/** Whether a key is held right now. */
export function isKeyHeld(input, code) {
  return input.held.has(code);
}

/** Whether a key went down this frame; the press is consumed so it acts once. */
export function consumeKeyPress(input, code) {
  if (!input.pressed.has(code)) return false;
  input.pressed.delete(code);
  return true;
}

/** The frame's control intent: a steer vector, a pointer aim, and the brace. */
export function readControl(input) {
  let moveX = 0;
  let moveY = 0;
  for (const code of input.held) {
    const axis = MOVE_KEYS[code];
    if (axis === undefined) continue;
    moveX += axis[0];
    moveY += axis[1];
  }
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }
  const braced = input.held.has('Space') || input.pointer.rightDown;
  return {
    moveX,
    moveY,
    aimActive: input.pointer.moved,
    aimX: input.pointer.x,
    aimY: input.pointer.y,
    braced,
  };
}

/** Drop the frame's one-shot presses once the frame has read them. */
export function clearInputFrame(input) {
  input.pressed.clear();
}
