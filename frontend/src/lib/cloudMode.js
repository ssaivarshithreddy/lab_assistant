export function isLocalModeForced() {
  return import.meta.env.VITE_FORCE_LOCAL_MODE === "true";
}

export function cloudEnabled() {
  return !isLocalModeForced();
}
