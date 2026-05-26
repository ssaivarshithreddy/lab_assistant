export function isLocalModeForced(): boolean {
  return import.meta.env.VITE_FORCE_LOCAL_MODE === "true";
}

export function cloudEnabled(): boolean {
  return !isLocalModeForced();
}
