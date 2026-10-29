// Shared entry screen for the static viewer; database read permissions are unchanged.
export const INTERN_ACCESS_CODE = 'cuped2627';
export function matchesInternCode(value) {
 return typeof value === 'string' && value.trim() === INTERN_ACCESS_CODE;
}
export function requireInternAccess() {
 const shell = document.querySelector('#planner-shell');
 if (shell) { shell.hidden = true; shell.inert = true; }
 const screen = document.createElement('section');
 screen.id = 'intern-access-screen';
 screen.className = 'signin-screen intern-access-screen';
 screen.innerHTML = `<a class="secondary owner-login intern-owner-login" href="index.html?owner=1">Owner login</a><div class="signin-card"><img class="signin-logo" src="assets/cuped-logo.png" alt="CUPED — Credit Union Professional &amp; Educational Development"><p class="eyebrow">CCU CUPED · INTERN ACCESS</p><h1>Your team calendar</h1><p>Enter the shared intern access code to open the live view-only calendar.</p><form><label>Intern access code<input name="code" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required aria-describedby="intern-access-error"></label><p id="intern-access-error" role="alert"></p><button class="primary" type="submit">Open calendar</button></form><p><small>Need the code? Ask Valerie Gutierrez, your project lead.</small></p><p class="creator-credit">Created by <strong>Valerie Gutierrez</strong></p></div>`;
 document.body.append(screen);
 const form = screen.querySelector('form');
 const input = form.elements.code;
 const error = screen.querySelector('#intern-access-error');
 input.focus();
 return new Promise(resolve => {
  form.onsubmit = event => {
   event.preventDefault();
   if (!matchesInternCode(input.value)) {
    error.textContent = 'That access code did not match. Please try again.';
    input.setAttribute('aria-invalid', 'true');
    input.select();
    return;
   }
   input.value = '';
   screen.remove();
   resolve();
  };
  input.oninput = () => { error.textContent = ''; input.removeAttribute('aria-invalid'); };
 });
}
