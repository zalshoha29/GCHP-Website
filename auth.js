/* =========================================
   GCHP — Auth (Login) JavaScript
   ========================================= */

// Member accounts (demo — in production use a real backend)
const MEMBERS = [
  { email: 'zaid@gchproject.org', password: 'founder2026', name: 'Zaid Al-Shoha', role: 'Founder & Executive Director', initials: 'ZA', dept: 'executive' },
  { email: 'dina@gchproject.org', password: 'director2026', name: 'Dina Hassouna', role: 'Managing Director', initials: 'DH', dept: 'executive' },
  { email: 'laila@gchproject.org', password: 'partnerships2026', name: 'Laila Salih', role: 'Head of Partnerships', initials: 'LS', dept: 'partnerships' },
  { email: 'lin@gchproject.org', password: 'media2026', name: 'Lin Kuang', role: 'Head of Media', initials: 'LK', dept: 'media' },
  { email: 'douae@gchproject.org', password: 'mobilization2026', name: 'Douae Maarouf', role: 'Head of Student Mobilization', initials: 'DM', dept: 'mobilization' },
  { email: 'karim@gchproject.org', password: 'operations2026', name: 'Karim Jawhari', role: 'Head of Operations', initials: 'KJ', dept: 'operations' },
];

// If already logged in, redirect to dashboard
if (sessionStorage.getItem('gchp_user') || localStorage.getItem('gchp_user')) {
  window.location.href = 'dashboard.html';
}

// Toggle password visibility
const toggleBtn = document.getElementById('togglePw');
const pwInput = document.getElementById('password');
if (toggleBtn && pwInput) {
  toggleBtn.addEventListener('click', () => {
    const isText = pwInput.type === 'text';
    pwInput.type = isText ? 'password' : 'text';
  });
}

// Login form
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const loginErrorMsg = document.getElementById('loginErrorMsg');

if (loginForm) {
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    loginError.style.display = 'none';

    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('rememberMe').checked;

    // Simulate loading
    loginBtn.classList.add('loading');
    loginBtn.querySelector('span').textContent = 'Signing in...';

    setTimeout(() => {
      const member = MEMBERS.find(m => m.email === email && m.password === password);
      if (member) {
        const userData = { name: member.name, role: member.role, initials: member.initials, dept: member.dept, email: member.email };
        if (remember) {
          localStorage.setItem('gchp_user', JSON.stringify(userData));
        } else {
          sessionStorage.setItem('gchp_user', JSON.stringify(userData));
        }
        loginBtn.querySelector('span').textContent = 'Welcome back!';
        loginBtn.style.background = '#16a34a';
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
      } else {
        loginBtn.classList.remove('loading');
        loginBtn.querySelector('span').textContent = 'Sign In';
        loginErrorMsg.textContent = 'Invalid email or password. Check the demo credentials below.';
        loginError.style.display = 'flex';
        // Shake effect
        loginForm.style.animation = 'shake 0.4s ease';
        setTimeout(() => { loginForm.style.animation = ''; }, 400);
      }
    }, 800);
  });
}

// Shake animation
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);
