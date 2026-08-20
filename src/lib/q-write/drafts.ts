export interface Draft {
  id: string;
  title: string;
  slug: string;
  slugManual: boolean;
  tags: string[];
  body: string;
  frontmatterExtra: Record<string, unknown>;
  hadFrontmatter: boolean;
  remotePath?: string;
  remoteSha?: string;
  state: 'local' | 'synced' | 'published';
  createdAt: string;
  updatedAt: string;
}

const DB_NAME = 'q-write';
const DB_VERSION = 1;
const STORE = 'drafts';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        if (mode === 'readwrite') {
          // For writes, resolve after transaction completes
          t.oncomplete = () => resolve(req.result);
          t.onerror = () => reject(t.error);
          t.onabort = () => reject(new Error('Transaction aborted'));
        } else {
          // For reads, resolve immediately on request success
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }
      }),
  );
}

export function newDraft(id: string, now: Date): Draft {
  const iso = now.toISOString();
  return {
    id,
    title: '',
    slug: '',
    slugManual: false,
    tags: [],
    body: '',
    frontmatterExtra: {},
    hadFrontmatter: false,
    state: 'local',
    createdAt: iso,
    updatedAt: iso,
  };
}

export function putDraft(d: Draft): Promise<void> {
  return tx('readwrite', (s) => s.put(d) as IDBRequest<IDBValidKey>).then(() => undefined);
}

export function getDraft(id: string): Promise<Draft | undefined> {
  return tx('readonly', (s) => s.get(id) as IDBRequest<Draft | undefined>);
}

export function listDrafts(): Promise<Draft[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<Draft[]>).then((all) =>
    all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
}

export function deleteDraft(id: string): Promise<void> {
  return tx('readwrite', (s) => s.delete(id) as IDBRequest<undefined>).then(() => undefined);
}
