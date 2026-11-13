/**
 * Settings proxy.
 * The trap validates numeric settings ("value" = budget, "salary") on write,
 * so an invalid budget can never reach localStorage.
 */
const handler = {
  set(target, prop, value) {
    if (prop === "value" || prop === "salary") {
      // Number.isFinite also rejects NaN and Infinity, which a plain
      // `typeof value !== "number" || value < 0` check would let through.
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("الميزانية لازم تكون رقم موجب");
      }
    }
    target[prop] = value;
    return true;
  },
  get(target, prop) {
    // Debug-level only: reading settings happens on every render.
    if (typeof prop === "string") {
      console.debug(`settings read: ${prop}`);
    }
    return target[prop];
  },
};

export function createSettings(initial) {
  return new Proxy(initial, handler);
}
