/* =========================================
   GCHP Portal — Login logic
   ========================================= */

// If already signed in, send straight to the right portal.
(async function checkExistingSession() {
  const profile = await getCurrentProfile();
  if (profile) {
    window.location.replace(
      profile.role === 'executive' ? 'exec-dashboard.html' : 'dashboard.html'
    );
  }
})();

const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorBox = document.getElementById('authError');
const errorMsg = document.getElementById('authErrorMsg');

// Password visibility toggle.
const togglePw = document.getElementById('togglePw');
const pwInput = document.getElementById('password');
togglePw?.addEventListener('click', () => {
  pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorBox.style.display = 'flex';
}

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
