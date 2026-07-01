import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split('=').map((s) => s.trim())).map(([k, ...v]) => [k, v.join('=')])
);
const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
const r = await c.auth.signUp({ email: `dbg.${stamp}@example.com`, password: 'TestPass123!' });
console.log('signUp error:', r.error?.message);
console.log('has session:', !!r.data.session);
const tok = r.data.session?.access_token;
if (tok) {
  const payload = JSON.parse(Buffer.from(tok.split('.')[1], 'base64').toString());
  console.log('JWT role:', payload.role, '| sub:', payload.sub?.slice(0, 8));
}
const sess = await c.auth.getSession();
console.log('getSession has session:', !!sess.data.session);
const u = await c.auth.getUser();
console.log('getUser id:', u.data.user?.id?.slice(0, 8), 'err:', u.error?.message);
// try insert
const ins = await c.from('families').insert({ name: `dbg ${stamp}` }).select().single();
console.log('insert err:', ins.error?.message, '| code:', ins.error?.code);
