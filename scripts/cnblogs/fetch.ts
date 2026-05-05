// Fetch posts from cnblogs MetaWeblog API and cache to disk.
// Idempotent: skips already-cached IDs unless --force is passed.
//
// Usage:
//   pnpm cnblogs:fetch         # fetch and cache new posts
//   pnpm cnblogs:fetch:force   # re-fetch even if cached

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import xmlrpc from 'xmlrpc';

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadEnvFile('.env.local');

const USERNAME = process.env.CNBLOGS_USERNAME;
const PASSWORD = process.env.CNBLOGS_PASSWORD;
const BLOGID = process.env.CNBLOGS_BLOGID;
const URL_OVERRIDE = process.env.CNBLOGS_METAWEBLOG_URL;

if (!USERNAME || !PASSWORD || !BLOGID) {
  console.error('Missing CNBLOGS_USERNAME, CNBLOGS_PASSWORD, or CNBLOGS_BLOGID in .env.local');
  process.exit(1);
}

const FORCE = process.argv.includes('--force');
const LIMIT = parseInt(process.env.CNBLOGS_LIMIT ?? '9999', 10);
const CACHE_DIR = join('scripts', 'cnblogs-cache');

const rpcUrl = URL_OVERRIDE ?? `https://rpc.cnblogs.com/metaweblog/${USERNAME}`;
console.log(`RPC endpoint: ${rpcUrl}`);

const client = xmlrpc.createSecureClient({ url: rpcUrl });

type CnblogsPost = {
  postid?: string | number;
  title?: string;
  description?: string;
  dateCreated?: Date | string;
  categories?: string[];
  mt_keywords?: string;
  permalink?: string;
  link?: string;
  [k: string]: unknown;
};

function callRpc<T>(method: string, params: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, value) => {
      if (err) reject(err);
      else resolve(value as T);
    });
  });
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  console.log(`Fetching up to ${LIMIT} posts from cnblogs (user: ${USERNAME}, blog: ${BLOGID})...`);

  const posts = await callRpc<CnblogsPost[]>('metaWeblog.getRecentPosts', [
    BLOGID,
    USERNAME,
    PASSWORD,
    LIMIT,
  ]);

  console.log(`Got ${posts.length} posts.`);

  let cached = 0;
  let skipped = 0;
  for (const post of posts) {
    const id = String(post.postid ?? '').trim();
    if (!id) {
      console.warn('Skipping post with no postid:', post.title);
      continue;
    }
    const path = join(CACHE_DIR, `${id}.json`);
    if (!FORCE && existsSync(path)) {
      skipped++;
      continue;
    }
    // Date may be xmlrpc.dateFormatter Date instance; serialize manually
    const serialized = JSON.stringify(post, (_k, v) => {
      if (v instanceof Date) return v.toISOString();
      return v;
    }, 2);
    writeFileSync(path, serialized);
    cached++;
  }

  console.log(`Cached: ${cached}, skipped: ${skipped}, total: ${posts.length}`);
  console.log(`Cache dir: ${CACHE_DIR}/`);
}

main().catch((err) => {
  console.error('Fetch failed:', err.message ?? err);
  process.exit(1);
});
