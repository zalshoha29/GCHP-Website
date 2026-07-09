/* =========================================
   GCHP Portal — Login logic
   ========================================= */

const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorBox = document.getElementById('authError');
const errorMsg = document.getElementById('authErrorMsg');
const setPwForm = document.getElementById('setPwForm');

function showError(msg) {
  errorMsg.textContent = msg;
  errorBox.style.display = 'flex';
}

// Detect an invite / password-recovery link. Supabase puts the token in the URL
// hash (e.g. #access_token=...&type=invite  or  type=recovery). When present,
// the user must set a password before proceeding — so we show that form and do
// NOT auto-redirect to the dashboard.
function hashParams() {
  const h = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(h);
}

(async function init() {
  const params = hashParams();
  const type = params.get('type');
  const isSetPasswordFlow = type === 'invite' || type === 'recovery';

  if (isSetPasswordFlow) {
    // Show the set-password form; hide the normal login form.
    if (form) form.style.display = 'none';
    if (setPwForm) setPwForm.style.display = 'block';
    const header = document.querySelector('.auth-header h1');
    const sub = document.querySelector('.auth-header p');
    if (header) header.textContent = type === 'invite' ? 'Set Your Password' : 'Reset Your Password';
    if (sub) sub.textContent = 'Choose a password to finish setting up your account.';
    return; // do not run the existing-session redirect
  }

  // Normal case: if already signed in, go straight to the right portal.
  const profile = await getCurrentProfile();
  if (profile) {
    window.location.replace(profile.role === 'executive' ? 'exec-dashboard.html' : 'dashboard.html');
  }
})();

// Password visibility toggle.
const togglePw = document.getElementById('togglePw');
const pwInput = document.getElementById('password');
togglePw?.addEventListener('click', () => {
  pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
});

// ---- Set-password submit (invite / recovery) ----
setPwForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.style.display = 'none';
  const pw = document.getElementById('newPassword').value;
  const confirm = document.getElementById('confirmPassword').value;
  if (pw.length < 8) { showError('Password must be at least 8 characters.'); return; }
  if (pw !== confirm) { showError('Passwords do not match.'); return; }

  const btn = document.getElementById('setPwBtn');
  btn.classList.add('loading');
  btn.querySelector('span').textContent = 'Setting password...';

  // Ensure the invite/recovery session has been established from the URL token
  // before attempting to set the password (detectSessionInUrl runs async).
  let { data: { session } } = await sb.auth.getSession();
  if (!session) {
    await new Promise(r => setTimeout(r, 600));
    ({ data: { session } } = await sb.auth.getSession());
  }
  if (!session) {
    btn.classList.remove('loading');
    btn.querySelector('span').textContent = 'Set Password & Continue';
    showError('This link is no longer valid or has expired. Please ask GCHP to resend your invite.');
    return;
  }

  // The invite/recovery token has established a session, so updateUser can set the password.
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) {
    btn.classList.remove('loading');
    btn.querySelector('span').textContent = 'Set Password & Continue';
    showError('Could not set password: ' + error.message + ' The link may have expired — ask GCHP to resend your invite.');
    return;
  }

  // Password set; the user is now authenticated. Send them to their portal.
  btn.querySelector('span').textContent = 'Success!';
  const profile = await getCurrentProfile();
  window.location.replace(profile && profile.role === 'executive' ? 'exec-dashboard.html' : 'dashboard.html');
});

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.style.display = 'none';

  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = pwInput.value;

  loginBtn.classList.add('loading');
  loginBtn.querySelector('span').textContent = 'Signing in...';

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    loginBtn.classList.remove('loading');
    loginBtn.querySelector('span').textContent = 'Sign In';
    // Supabase returns a generic message for bad credentials; keep it user-friendly.
    if (/email not confirmed/i.test(error.message)) {
      showError('Please confirm your email address before signing in. Check your inbox for the confirmation link.');
    } else {
      showError('Invalid email or password. Please try again.');
    }
    return;
  }

  // Load profile to decide which portal to enter.
  const profile = await getCurrentProfile();
  if (!profile) {
    loginBtn.classList.remove('loading');
    loginBtn.querySelector('span').textContent = 'Sign In';
    showError('Your account has no profile set up. Please contact GCHP.');
    return;
  }

  loginBtn.querySelector('span').textContent = 'Welcome back!';
  window.location.replace(
    profile.role === 'executive' ? 'exec-dashboard.html' : 'dashboard.html'
  );
});
