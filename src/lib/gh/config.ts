const PAT_KEY = 'qsort.pat';
const REPO_KEY = 'qsort.repo';
const DEFAULT_REPO = 'tumluliu/blogs';

export interface GhConfig {
  pat: string | null;
  repo: string;
}

export function loadConfig(): GhConfig {
  return {
    pat: localStorage.getItem(PAT_KEY),
    repo: localStorage.getItem(REPO_KEY) ?? DEFAULT_REPO,
  };
}

export function saveConfig(pat: string, repo: string): void {
  localStorage.setItem(PAT_KEY, pat);
  localStorage.setItem(REPO_KEY, repo);
}

export function clearConfig(): void {
  localStorage.removeItem(PAT_KEY);
  localStorage.removeItem(REPO_KEY);
}
