import {CloudCalendar, validateCloudConfig} from './cloud.js?v=15';

export const OWNER_PROJECT_URL = 'https://esyhbmbbmktzvylgphxj.supabase.co';
export const OWNER_USER_ID = '82d08a21-3af2-4c4e-ace3-8c328ff8408b';
const SESSION_KEY = 'cuped-cloud-session';
const CLOUD_CONFIG_KEY = 'cuped-cloud-config';
const PUBLIC_KEY = 'cuped-owner-public-key';

// Identity comes from deployment configuration, never a claim in browser storage.
export function validateAuthConfig(config) {
 if (!config || config.url !== OWNER_PROJECT_URL || config.ownerId !== OWNER_USER_ID) {
  throw new Error('Owner sign-in setup is unavailable. The planner will stay locked.');
 }
 const key = typeof config.key === 'string' ? config.key.trim() : '';
 if (key) validateCloudConfig({url: config.url, key});
 return {url: OWNER_PROJECT_URL, ownerId: OWNER_USER_ID, key};
}

export async function verifyOwner(client, ownerId = OWNER_USER_ID) {
 const user = await client.getUser();
 if (!user || user.id !== ownerId) {
  try { await client.signOut(); } catch { client.restoreSession(null); }
  throw new Error('This account is not authorized to open Valerie’s editable planner.');
 }
 return user;
}

export async function authenticateOwner(client, email, password, ownerId = OWNER_USER_ID) {
 await client.signIn(email.trim(), password);
 // Verify the live server identity. A valid session for a different user is insufficient.
 return verifyOwner(client, ownerId);
}

function stored(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function store(key, value) {
 try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function publicKeyFromBrowser(config) {
 for (const candidate of [stored(CLOUD_CONFIG_KEY), stored(PUBLIC_KEY)]) {
  if (candidate?.url !== config.url || !candidate.key) continue;
  try { return validateCloudConfig({url: config.url, key: candidate.key}).key; } catch {}
 }
 return '';
}
export function ownerAuthError(error) {
 const text = error?.message || '';
 if (/invalid login credentials|invalid_credentials/i.test(text)) return 'The owner email or password did not match. Use the account created in Supabase Authentication → Users.';
 if (/email not confirmed/i.test(text)) return 'Confirm the owner user in Supabase Authentication → Users, then sign in again.';
 if (/invalid api key|invalid.*publishable/i.test(text)) return 'The public publishable key is incomplete or incorrect. Copy its full value from Supabase API Keys.';
 if (/public publishable or anon key/i.test(text)) return 'Paste the complete public publishable key, including all characters after sb_publishable_. Do not enter a password or a secret key in that field.';
 if (/not authorized|setup is unavailable/i.test(text)) return text;
 if (/reach|connection|fetch|network/i.test(text)) return 'Could not verify your sign-in. Check your internet connection and try again. The planner stays locked until verification succeeds.';
 return text || 'Could not verify your sign-in. Please try again.';
}

export async function requireOwnerAccess({readOnly = false, onLock = () => {}, onUnlock = () => {}} = {}) {
 if (readOnly) return null;
 const shell = document.querySelector('#planner-shell');
 if (shell) shell.hidden = true;
 const screen = document.querySelector('#signin-screen') || document.createElement('section');
 screen.id = 'signin-screen'; screen.classList.add('signin-screen'); screen.hidden = false;
 screen.innerHTML = `<div class="signin-card"><img class="signin-logo" src="assets/edfed-logo.png" alt="EdFed"><p class="eyebrow">CCU CUPED · OWNER ACCESS</p><h1>Owner sign-in</h1><p>Sign in to open the editable planner. Your email address is your username.</p><form id="owner-signin-form"><label>Email address<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><details id="owner-key-help"><summary>First-time sign-in setup</summary><p>Use the public publishable key from your Supabase project. This is public connection information, separate from your password.</p><label>Project URL<input name="project" readonly value="${OWNER_PROJECT_URL}"></label><label>Public publishable / anon key<input name="publicKey" autocomplete="off" spellcheck="false" placeholder="Paste the complete sb_publishable_… key"></label><p><small>Never paste a database password, secret key, or service-role key here.</small></p></details><p id="owner-signin-error" role="alert"></p><p id="owner-signin-status" role="status"></p><button class="primary" type="submit">Sign in</button></form><p class="signin-view-link"><a href="view.html">Open the live view-only schedule</a></p><p class="creator-credit">Created by <strong>Valerie Gutierrez</strong></p></div>`;
 if (!screen.isConnected) document.body.append(screen);
 const form = screen.querySelector('form');
 const errorNode = screen.querySelector('#owner-signin-error');
 const statusNode = screen.querySelector('#owner-signin-status');
 const keyHelp = screen.querySelector('#owner-key-help');
 const button = form.querySelector('[type=submit]');
 let config = null, client = null, authorized = false, alreadyResolved = false, generation = 0;
 let resolveAccess;
 const access = new Promise(resolve => { resolveAccess = resolve; });
 const lock = message => {
  generation += 1;
  authorized = false;
  if (client) client.onSession = null;
  store(SESSION_KEY, null);
  button.disabled = false;
  if (shell) shell.hidden = true;
  screen.hidden = false;
  errorNode.textContent = message || '';
  statusNode.textContent = '';
  form.elements.password.value = '';
  onLock(message);
 };
 const persistSession = session => {
  if (!session) store(SESSION_KEY, null);
  else if (authorized && session.project_url === OWNER_PROJECT_URL) store(SESSION_KEY, session);
 };
 const control = {
  get client() { return client; },
  getUser() { return authorized ? client?.session?.user || null : null; },
  isAuthorized() { return authorized; },
  async verify() {
   if (!authorized || !client) return false;
   const epoch = generation, verifyingClient = client;
   try {
    const latestSession = stored(SESSION_KEY);
    if (!latestSession) throw new Error('Sign in again to open the editable planner.');
    verifyingClient.restoreSession(latestSession);
    const user = await verifyOwner(verifyingClient, config.ownerId);
    if (epoch !== generation || !authorized || client !== verifyingClient) return false;
    store(SESSION_KEY, verifyingClient.session);
    return user;
   } catch (error) {
    if (epoch === generation && client === verifyingClient) {
     verifyingClient.restoreSession(null);
     lock(ownerAuthError(error));
    }
    return false;
   }
  },
  async signOut() {
   const signingOutClient = client;
   if (signingOutClient) signingOutClient.onSession = null;
   lock('Signed out. Sign in again to open the editable planner.');
   const epoch = generation;
   try { if (signingOutClient?.session) await signingOutClient.signOut(); }
   finally {
    if (signingOutClient) signingOutClient.restoreSession(null);
    if (epoch === generation && client === signingOutClient) client = null;
   }
  }
 };
 function unlock(user, epoch, authenticatedClient) {
  if (epoch !== generation || client !== authenticatedClient) return false;
  authorized = true;
  store(PUBLIC_KEY, {url: config.url, key: client.config.key});
  store(SESSION_KEY, client.session);
  const current = stored(CLOUD_CONFIG_KEY);
  store(CLOUD_CONFIG_KEY, {url: config.url, key: client.config.key, planId: current?.url === config.url ? current.planId || null : null});
  screen.hidden = true; form.elements.password.value = ''; errorNode.textContent = ''; statusNode.textContent = '';
  if (alreadyResolved) { if (shell) shell.hidden = false; onUnlock(user); }
  else { alreadyResolved = true; resolveAccess(control); }
 }
 function makeClient(key, epoch = generation) {
  const next = new CloudCalendar({url: config.url, key});
  next.onSession = session => { if (epoch === generation) persistSession(session); };
  return next;
 }
 form.onsubmit = async event => {
  event.preventDefault();
  errorNode.textContent = ''; statusNode.textContent = 'Verifying owner sign-in…'; button.disabled = true;
  const password = form.elements.password.value; form.elements.password.value = '';
  const epoch = ++generation;
  if (client) client.onSession = null;
  try {
   if (!config) throw new Error('Owner sign-in setup is unavailable. The planner will stay locked.');
   const key = form.elements.publicKey.value.trim();
   validateCloudConfig({url: config.url, key});
   authorized = false;
   client = makeClient(key, epoch);
   const authenticatedClient = client;
   const user = await authenticateOwner(authenticatedClient, form.elements.email.value, password, config.ownerId);
   unlock(user, epoch, authenticatedClient);
  } catch (error) {
   if (epoch !== generation) return;
   authorized = false; if (client) client.restoreSession(null); store(SESSION_KEY, null);
   errorNode.textContent = ownerAuthError(error); statusNode.textContent = '';
   if (/key|publishable/i.test(errorNode.textContent)) keyHelp.open = true;
  } finally { if (epoch === generation) button.disabled = false; }
 };
 try {
  statusNode.textContent = 'Checking sign-in setup…';
  const response = await fetch('./auth-config.json', {cache: 'no-store', credentials: 'omit', redirect: 'error'});
  if (!response.ok) throw new Error('Owner sign-in setup is unavailable. The planner will stay locked.');
  config = validateAuthConfig(await response.json());
  const key = config.key || publicKeyFromBrowser(config);
  form.elements.publicKey.value = key;
  keyHelp.open = !key;
  if (!key) {
   statusNode.textContent = 'One-time setup: paste the complete public publishable key above, then sign in.';
   return access;
  }
  client = makeClient(key);
  const session = stored(SESSION_KEY);
  if (session) {
   const authenticatedClient = client, epoch = generation;
   // Do not make a new successful sign-in wait for an older restore request.
   (async () => {
    try {
     authenticatedClient.restoreSession(session);
     const user = await verifyOwner(authenticatedClient, config.ownerId);
     unlock(user, epoch, authenticatedClient);
    } catch (error) {
     if (epoch === generation && client === authenticatedClient) {
      authenticatedClient.restoreSession(null); store(SESSION_KEY, null);
      errorNode.textContent = ownerAuthError(error); statusNode.textContent = '';
     }
    }
   })();
  } else statusNode.textContent = '';
 } catch (error) { errorNode.textContent = ownerAuthError(error); statusNode.textContent = ''; }
 return access;
}
