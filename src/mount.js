// What the player is riding right now (null on foot). A tiny module of its own
// so player.js, game.js and the farm can all read it without import cycles.
//   kind: 'bike' | 'truck' | 'tractor', k: which one, speed / turn / accel: handling,
//   seat: 'bike' (pedalling), 'seat' (sitting) or 'hidden' (inside a cab)
export const mount = { active: null }

export const riding = (kind, k) => !!mount.active && mount.active.kind === kind && (k == null || mount.active.k === k)
