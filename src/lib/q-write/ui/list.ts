import type { Draft } from '../drafts.js';
import { slugFromEntryName } from '../paths.js';
import { countWords } from './state.js';

export function filterEntries(names: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return names;
  return names.filter((n) => n.toLowerCase().includes(q));
}

const STATE_LABEL: Record<Draft['state'], string> = {
  local: '本地',
  synced: '已存仓库',
  published: '已发布',
};

function relTime(iso: string, now: Date): string {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}

export function renderDrafts(
  container: HTMLElement,
  drafts: Draft[],
  onOpen: (id: string) => void,
  now: Date = new Date(),
): void {
  container.textContent = '';
  for (const d of drafts) {
    const row = document.createElement('button');
    row.className = 'row';
    const title = document.createElement('div');
    title.className = 'row-title';
    title.textContent = d.title || '(无标题)';
    const meta = document.createElement('div');
    meta.className = 'row-meta';
    const dot = document.createElement('span');
    dot.className = `dot ${d.state}`;
    meta.append(dot, `${STATE_LABEL[d.state]} · ${relTime(d.updatedAt, now)} · ${countWords(d.body)} 字`);
    row.append(title, meta);
    row.addEventListener('click', () => onOpen(d.id));
    container.append(row);
  }
}

export function renderRepoList(
  container: HTMLElement,
  names: string[],
  onOpen: (slug: string) => void,
): void {
  container.textContent = '';
  for (const name of names.slice(0, 50)) {
    const slug = slugFromEntryName(name);
    const row = document.createElement('button');
    row.className = 'row';
    const title = document.createElement('div');
    title.className = 'row-slug';
    title.textContent = slug;
    row.append(title);
    row.addEventListener('click', () => onOpen(slug));
    container.append(row);
  }
}
