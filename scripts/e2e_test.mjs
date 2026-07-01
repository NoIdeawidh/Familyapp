import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Load .env.local
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split('=').map((s) => s.trim()))
    .map(([k, ...v]) => [k, v.join('=')])
);
const SUPA_URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

const stamp = Date.now();
const log = (...a) => console.log(...a);
const fail = (m) => { console.error('❌ FAIL:', m); process.exitCode = 1; };
const ok = (m) => log('✅', m);

function fresh() {
  return createClient(SUPA_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

function pinToPassword(pin) { return `familyapp-pin-${pin}`; }

async function main() {
  // === ADMIN creates a family ===
  const admin = fresh();
  const adminEmail = `devin.test.admin.${stamp}@example.com`;
  const adminPw = 'TestPass123!';
  let r = await admin.auth.signUp({ email: adminEmail, password: adminPw });
  if (r.error || !r.data.user) return fail('admin signUp: ' + r.error?.message);
  if (!r.data.session) return fail('admin signUp returned no session (email confirmation still ON?)');
  ok('admin signed up with active session');

  const famName = `Devin-Test-Familie ${stamp}`;
  r = await admin.rpc('create_family', { p_family_name: famName, p_admin_name: 'Test-Admin' });
  if (r.error) return fail('create_family RPC: ' + r.error.message);
  const familyId = r.data;
  ok('family created via RPC: ' + familyId);

  // admin member + permissions should now exist (created by the RPC)
  r = await admin.from('family_members').select('id, role').eq('family_id', familyId).single();
  if (r.error || r.data.role !== 'admin') return fail('admin member not created by RPC');
  const adminMemberId = r.data.id;
  ok('admin member exists (role=admin)');

  r = await admin.from('member_permissions').select('permission');
  if (r.error || r.data.length !== 23) return fail('admin permissions count = ' + (r.data?.length ?? 'err') + ' (expected 23)');
  ok('admin has 23 permissions (full access)');

  // default rules + first season created by RPC
  r = await admin.from('seasons').select('name, active').eq('family_id', familyId).single();
  if (r.error || !r.data.active) return fail('first season not created/active');
  ok('first season created and active: ' + r.data.name);
  r = await admin.from('family_rules').select('id').eq('family_id', familyId).single();
  if (r.error) return fail('family_rules not created');
  ok('default family_rules created');

  // === ADMIN creates a player invite code ===
  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  r = await admin.from('invite_codes').insert({
    family_id: familyId, code, role: 'player',
    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), created_by: adminMemberId,
  });
  if (r.error) return fail('create invite: ' + r.error.message);
  ok('invite code created: ' + code);

  // === Anonymous lookup of family summary (RLS-safe RPC) ===
  const anon = fresh();
  r = await anon.rpc('get_family_summary', { p_family_id: familyId });
  if (r.error || !r.data?.[0] || r.data[0].name !== famName) return fail('get_family_summary: ' + (r.error?.message || 'wrong name'));
  ok('anon get_family_summary returns correct family name');

  // === PLAYER joins via redeem_invite RPC ===
  const player = fresh();
  const playerEmail = `player_${stamp}@familienreich.internal`;
  const pin = '1234';
  r = await player.auth.signUp({ email: playerEmail, password: pinToPassword(pin) });
  if (r.error || !r.data.session) return fail('player signUp: ' + (r.error?.message || 'no session'));
  r = await player.rpc('redeem_invite', { p_code: code, p_name: 'Test-Kind', p_avatar: '🦊' });
  if (r.error) return fail('redeem_invite: ' + r.error.message);
  const playerMemberId = r.data;
  ok('player joined via redeem_invite');

  // player should have exactly 7 default permissions of their own
  r = await player.from('member_permissions').select('permission').eq('member_id', playerMemberId);
  if (r.error || r.data.length !== 7) return fail('player own permissions count = ' + (r.data?.length ?? 'err'));
  ok('player has 7 own default permissions');

  // === Invite reuse must fail ===
  const player2 = fresh();
  await player2.auth.signUp({ email: `player2_${stamp}@familienreich.internal`, password: pinToPassword('5678') });
  r = await player2.rpc('redeem_invite', { p_code: code, p_name: 'Hacker', p_avatar: '🐉' });
  if (!r.error) return fail('invite reuse was NOT blocked'); else ok('invite reuse blocked: ' + r.error.message);

  // === RLS isolation: a foreign family must not see our family ===
  const outsider = fresh();
  await outsider.auth.signUp({ email: `devin.test.outsider.${stamp}@example.com`, password: adminPw });
  r = await outsider.from('families').select('*').eq('id', familyId);
  if (r.error) return fail('outsider select error: ' + r.error.message);
  if (r.data.length !== 0) return fail('RLS LEAK: outsider can see our family!'); else ok('RLS isolation: outsider sees 0 rows of our family');
  r = await outsider.from('family_members').select('*').eq('family_id', familyId);
  if ((r.data?.length ?? 0) !== 0) return fail('RLS LEAK: outsider can see our members!'); else ok('RLS isolation: outsider sees 0 of our members');

  // === PIN login (multi-device): list profiles, then sign in with PIN ===
  const device = fresh();
  r = await device.rpc('get_login_profiles', { p_family_id: familyId });
  const playerProfile = r.data?.find((p) => p.name === 'Test-Kind');
  if (!playerProfile?.uses_pin) return fail('get_login_profiles missing player'); else ok('get_login_profiles lists player for PIN login');
  // sign in with the player's synthetic email + derived pin password
  r = await device.from('family_members').select('auth_email').eq('id', playerProfile.id).single();
  // note: anon can't read auth_email via RLS; emulate auth.tsx which signs in. Use known email.
  const login = await device.auth.signInWithPassword({ email: playerEmail, password: pinToPassword(pin) });
  if (login.error) return fail('PIN login: ' + login.error.message); else ok('player PIN login works');

  // wrong PIN must fail
  const badDevice = fresh();
  const bad = await badDevice.auth.signInWithPassword({ email: playerEmail, password: pinToPassword('0000') });
  if (!bad.error) return fail('wrong PIN was accepted!'); else ok('wrong PIN rejected');

  log('\nFAMILY_ID=' + familyId);
  log('ADMIN_EMAIL=' + adminEmail + '  ADMIN_PW=' + adminPw);
  log('INVITE_CODE(used)=' + code);
}

main().then(() => log('\nDone. exitCode=' + (process.exitCode || 0)));
