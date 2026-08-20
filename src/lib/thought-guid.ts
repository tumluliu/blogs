// A thought has no slug and no per-entry route: `entry.id` (derived from its
// filename) is its only identity today, which makes it fragile — any future
// change to how content-loader ids are computed silently changes every
// thought's RSS <guid> and re-marks the whole feed as unread for subscribers.
//
// The thought's `date` is intrinsic and does not depend on filenames, ids,
// or loader internals, so it is the stable key instead. Millisecond-precision
// ISO 8601 is unique as long as two thoughts are never posted in the same
// millisecond (checked against all real thought dates in thought-guid.test.ts).
export function stableThoughtGuid(date: Date): string {
  return `thought:${date.toISOString()}`;
}
