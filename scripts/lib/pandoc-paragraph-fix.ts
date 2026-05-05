const FENCE_RE = /^```/;

export function stripBackslashes(input: string): string {
  const lines = input.split('\n');
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    out.push(line.replace(/\s*\\$/, ''));
  }
  return out.join('\n');
}

export function fixContent(input: string): string {
  return input;
}
