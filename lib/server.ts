import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export function database() {
  const db = (env as unknown as { DB: D1Database }).DB;
  if (!db) throw new Error('Banco indisponível');
  return db;
}
export async function identity() {
  const user = await getChatGPTUser();
  const admins = String(
    (env as unknown as { ADMIN_EMAILS?: string }).ADMIN_EMAILS || '',
  )
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { user, admin: !!user && admins.includes(user.email.toLowerCase()) };
}
