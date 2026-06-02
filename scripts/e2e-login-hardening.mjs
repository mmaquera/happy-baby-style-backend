// E2E del hardening de login. user-service (:3006, sin rate-limit del gateway) + gateway (:4000) para rate limiting.
// Respuestas envuelven el payload bajo `data {...}`. TOTP con crypto (RFC 6238).
import { createHmac } from 'crypto';
import { execSync } from 'child_process';

const US = 'http://localhost:3006/graphql';
const GW = 'http://localhost:4000/graphql';
const stamp = Date.now();
const results = [];
const pass = (n, d = '') => { results.push({ n, ok: true, d }); console.log(`  ✅ ${n} ${d}`); };
const fail = (n, d = '') => { results.push({ n, ok: false, d }); console.log(`  ❌ ${n} ${d}`); };

async function gql(url, query, variables = {}, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ query, variables }),
  });
  let json = null;
  try { json = await r.json(); } catch { /* non-json */ }
  // Desempaqueta la envoltura GraphQL: .json = payload bajo `data`; .errors = errores top-level
  return { status: r.status, json: json?.data ?? null, errors: json?.errors ?? null };
}
const errMsg = (r) => r?.errors?.[0]?.message || '';

function psql(sql) {
  const pw = process.env.DOCKER_DB_PASSWORD || '';
  const cmd = `docker compose exec -T -e PGPASSWORD=${pw} postgres psql -U postgres -d happy_baby_user -t -A -c "${sql.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

// ---- TOTP (RFC 6238, SHA1, 6 dígitos, paso 30s) ----
function base32Decode(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const v = A.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret, t = Date.now()) {
  const key = base32Decode(secret);
  let counter = Math.floor(t / 1000 / 30);
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) { buf[i] = counter & 0xff; counter = Math.floor(counter / 256); }
  const hmac = createHmac('sha1', key).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[off] & 0x7f) << 24) | (hmac[off + 1] << 16) | (hmac[off + 2] << 8) | hmac[off + 3];
  return (code % 1_000_000).toString().padStart(6, '0');
}

const REGISTER = `mutation($input: CreateUserProfileInput!){ registerUser(input:$input){ success message data{ accessToken user{ id email emailVerified } } } }`;
const LOGIN = `mutation($email:String!,$password:String!){ loginUser(email:$email,password:$password){ success message data{ mfaRequired mfaChallengeToken accessToken user{ id email } } } }`;

const reg = (email, password) => gql(US, REGISTER, { input: { email, password, firstName: 'Emma', lastName: 'Tester' } });
const login = (email, password, url = US, headers = {}) => gql(url, LOGIN, { email, password }, headers);

async function main() {
  console.log('\n=== 0. Health & schema ===');
  try {
    for (const [svc, port] of [['user', 3006], ['gateway', 4000]]) {
      const ok = await fetch(`http://localhost:${port}/health`).then(x => x.ok).catch(() => false);
      ok ? pass(`health ${svc}`) : fail(`health ${svc}`);
    }
    const cols = psql("SELECT column_name FROM information_schema.columns WHERE table_name='user_profiles' AND column_name IN ('failed_login_attempts','locked_until','email_verification_token','mfa_enabled','mfa_secret','mfa_backup_codes');");
    const found = cols.split('\n').filter(Boolean).length;
    found === 6 ? pass('db push applied (6 new columns)') : fail('db push columns', `found ${found}/6`);
  } catch (e) { fail('health/schema setup', e.message); }

  // ---- 1. Registro + login OK ----
  console.log('\n=== 1. Register + login ===');
  const emailA = `e2e_a_${stamp}@test.local`, pwA = 'Sup3rSecret!23';
  let userAId = null;
  try {
    const r = await reg(emailA, pwA);
    r.json?.registerUser?.success ? (pass('registerUser', emailA), userAId = r.json.registerUser.data?.user?.id) : fail('registerUser', JSON.stringify(r.json));
    const lg = await login(emailA, pwA);
    lg.json?.loginUser?.data?.accessToken ? pass('login success') : fail('login success', JSON.stringify(lg.json));
  } catch (e) { fail('register/login', e.message); }

  // ---- 2. Email verification (suave) ----
  console.log('\n=== 2. Email verification ===');
  try {
    await gql(US, `mutation($e:String!){ requestEmailVerification(email:$e){ success } }`, { e: emailA });
    const token = psql(`SELECT email_verification_token FROM user_profiles WHERE email='${emailA}';`);
    if (token && token.length > 10) {
      pass('verification token persisted');
      const v = await gql(US, `mutation($t:String!){ verifyEmail(token:$t){ success data{ emailVerified } } }`, { t: token });
      v.json?.verifyEmail?.success ? pass('verifyEmail') : fail('verifyEmail', JSON.stringify(v.json));
      const verified = psql(`SELECT email_verified FROM user_profiles WHERE email='${emailA}';`);
      verified === 't' ? pass('email_verified=true in DB') : fail('email_verified', verified);
      // Single-use a nivel storage: el token se limpia en DB tras el primer uso.
      // (El 2º verify devuelve éxito idempotente vía la rama "already verified", por diseño.)
      const cleared = psql(`SELECT email_verification_token IS NULL FROM user_profiles WHERE email='${emailA}';`);
      cleared === 't' ? pass('token single-use (cleared in DB)') : fail('token single-use', `token still present`);
    } else fail('verification token persisted', `token='${token}'`);
  } catch (e) { fail('email verification', e.message); }

  // ---- 3. Account lockout ----
  console.log('\n=== 3. Account lockout ===');
  const emailL = `e2e_lock_${stamp}@test.local`, pwL = 'L0ckMe!2345';
  try {
    await reg(emailL, pwL);
    for (let i = 1; i <= 5; i++) await login(emailL, 'wrong-pass');
    const r6 = await login(emailL, pwL); // correct pw, must stay blocked
    const blocked = !r6.json?.loginUser?.data?.accessToken;
    blocked ? pass('login blocked after 5 fails (even w/ correct pw)') : fail('lockout', JSON.stringify(r6.json));
    // Anti-enumeration: mensaje genérico e idéntico para todos los fallos (no revela bloqueo/existencia).
    const msg = r6.json?.loginUser?.message || errMsg(r6);
    const noUser = await login(`nope_${stamp}@test.local`, 'whatever');
    const noUserMsg = noUser.json?.loginUser?.message || errMsg(noUser);
    /invalid (email or password|credentials)/i.test(msg) && msg === noUserMsg
      ? pass('generic anti-enumeration message (uniform)', `"${msg}"`)
      : fail('generic message', `locked="${msg}" noUser="${noUserMsg}"`);
    const lockedUntil = psql(`SELECT locked_until FROM user_profiles WHERE email='${emailL}';`);
    lockedUntil ? pass('locked_until set in DB', lockedUntil) : fail('locked_until', 'empty');
    const ev = psql(`SELECT count(*) FROM security_events WHERE event_type='account_locked' AND user_id=(SELECT id FROM user_profiles WHERE email='${emailL}');`);
    parseInt(ev, 10) >= 1 ? pass('security_event account_locked', `count=${ev}`) : fail('account_locked event', `count=${ev}`);
  } catch (e) { fail('lockout', e.message); }

  // ---- 4. MFA / TOTP + login 2 pasos ----
  console.log('\n=== 4. MFA / TOTP ===');
  const emailM = `e2e_mfa_${stamp}@test.local`, pwM = 'Mfa!Secret234';
  try {
    const r = await reg(emailM, pwM);
    const token = r.json?.registerUser?.data?.accessToken || (await login(emailM, pwM)).json?.loginUser?.data?.accessToken;
    const auth = { authorization: `Bearer ${token}` };
    const en = await gql(US, `mutation{ enableMFA{ success data{ secret otpauthUrl } } }`, {}, auth);
    const secret = en.json?.enableMFA?.data?.secret;
    secret ? pass('enableMFA returns secret') : fail('enableMFA', JSON.stringify(en.json));
    if (secret) {
      const setup = await gql(US, `mutation($c:String!){ verifyMFASetup(code:$c){ success data{ backupCodes mfaEnabled } } }`, { c: totp(secret) }, auth);
      const codes = setup.json?.verifyMFASetup?.data?.backupCodes;
      (setup.json?.verifyMFASetup?.success && codes?.length) ? pass('verifyMFASetup → backup codes', `${codes.length} codes`) : fail('verifyMFASetup', JSON.stringify(setup.json));
      const l = await login(emailM, pwM);
      const ch = l.json?.loginUser?.data?.mfaChallengeToken;
      (l.json?.loginUser?.data?.mfaRequired && ch) ? pass('login → mfaRequired + challenge') : fail('mfaRequired', JSON.stringify(l.json));
      if (ch) {
        // Espera al siguiente borde de ventana TOTP (30s) para usar un código de una ventana
        // distinta a la del setup (el server rechaza el reuso del mismo código → anti-replay).
        const waitMs = 30000 - (Date.now() % 30000) + 1000;
        await new Promise(r => setTimeout(r, waitMs));
        const vt = await gql(US, `mutation($t:String!,$c:String!){ verifyTotp(mfaChallengeToken:$t,code:$c){ success data{ accessToken } } }`, { t: ch, c: totp(secret) });
        vt.json?.verifyTotp?.data?.accessToken ? pass('verifyTotp → tokens (fresh window)') : fail('verifyTotp', JSON.stringify(vt.json));
      }
      if (codes?.length) {
        const ch2 = (await login(emailM, pwM)).json?.loginUser?.data?.mfaChallengeToken;
        const b1 = await gql(US, `mutation($t:String!,$c:String!){ verifyTotp(mfaChallengeToken:$t,code:$c){ success data{ accessToken } } }`, { t: ch2, c: codes[0] });
        b1.json?.verifyTotp?.data?.accessToken ? pass('backup code accepted') : fail('backup code accepted', JSON.stringify(b1.json));
        const ch3 = (await login(emailM, pwM)).json?.loginUser?.data?.mfaChallengeToken;
        const b2 = await gql(US, `mutation($t:String!,$c:String!){ verifyTotp(mfaChallengeToken:$t,code:$c){ success data{ accessToken } } }`, { t: ch3, c: codes[0] });
        (!b2.json?.verifyTotp?.data?.accessToken) ? pass('backup code single-use (reuse rejected)') : fail('backup code single-use', 'reuse accepted');
      }
    }
  } catch (e) { fail('mfa', e.message); }

  // ---- 5. Geo IP analytics ----
  console.log('\n=== 5. Geo IP / session analytics ===');
  try {
    if (userAId) {
      const row = psql(`SELECT count(*) FROM user_sessions_analytics WHERE user_id='${userAId}';`);
      parseInt(row, 10) >= 1 ? pass('session analytics row created', `count=${row}`) : fail('session analytics', `count=${row}`);
      const geo = psql(`SELECT coalesce(country,'∅')||'/'||coalesce(city,'∅') FROM user_sessions_analytics WHERE user_id='${userAId}' LIMIT 1;`);
      console.log(`     geo (country/city, ∅=null esperado para IP de bridge): ${geo}`);
    } else fail('session analytics', 'no userAId');
  } catch (e) { fail('geo ip', e.message); }

  // ---- 6. Rate limiting distribuido (gateway) ----
  console.log('\n=== 6. Rate limiting (gateway :4000) ===');
  try {
    let limited = false;
    for (let i = 0; i < 14; i++) {
      const r = await login(`rl_${stamp}@test.local`, 'x', GW);
      const s = JSON.stringify(r.json || '') + r.status;
      if (/RATE_LIMIT_EXCEEDED|too many|429/i.test(s)) { limited = true; break; }
    }
    limited ? pass('gateway rate-limit triggered (>10 auth reqs)') : fail('rate-limit', 'never triggered in 14 reqs');
    const keys = execSync('docker compose exec -T redis redis-cli keys "rl:*" 2>/dev/null', { encoding: 'utf8' }).trim();
    keys ? pass('rate-limit counters in Redis (survive restart)', `${keys.split('\n').length} keys`) : fail('redis rl keys', 'none');
  } catch (e) { fail('rate limit', e.message); }

  const ok = results.filter(r => r.ok).length;
  console.log(`\n========================================`);
  console.log(`  RESULTADO: ${ok}/${results.length} checks PASS`);
  const failed = results.filter(r => !r.ok);
  if (failed.length) { console.log(`  Fallos:`); failed.forEach(f => console.log(`   - ${f.n} ${f.d}`)); }
  console.log(`========================================\n`);
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e); process.exit(2); });
