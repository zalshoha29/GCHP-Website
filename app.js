/* =========================================
   GCHP — Main Site JavaScript (multi-page)
   ========================================= */

// Navbar scroll effect
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// Mobile hamburger
const hamburger = document.getElementById('navHamburger');
const mobileNav = document.getElementById('navMobile');
if (hamburger && mobileNav) {
  hamburger.addEventListener('click', () => {
    mobileNav.classList.toggle('open');
    hamburger.classList.toggle('open');
  });
  // Close on any click inside mobile nav
  mobileNav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
    }
  });
}

// Highlight active nav link based on current page
(function() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href === page) {
      link.classList.add('active');
    }
  });
})();

// Smooth scroll for any in-page anchor links (e.g. #donate on get-involved)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// Intersection Observer — fade-in on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

const styleSheet = document.createElement('style');
styleSheet.textContent = `.fade-target.visible { opacity: 1 !important; transform: translateY(0) !important; }`;
document.head.appendChild(styleSheet);

document.querySelectorAll(
  '.home-feature-card, .about-card, .issue-card, .pillar-card, .wwd-item, ' +
  '.core-leader-card, .partner-benefit, .gi-card, .timeline-item, ' +
  '.leader-card, .network-item, .value-card, .mv-card'
).forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(22px)';
  el.style.transition = `opacity 0.5s ease ${i * 0.06}s, transform 0.5s ease ${i * 0.06}s`;
  el.classList.add('fade-target');
  observer.observe(el);
});

// Generic contact / partner form submit handler
document.querySelectorAll('.contact-form, .partner-form').forEach(form => {
  const submitBtn = form.querySelector('[type="submit"], .btn-form-submit');
  if (!submitBtn) return;
  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const inputs = form.querySelectorAll('input, select, textarea');
    let valid = true;
    inputs.forEach(inp => { if (inp.required && !inp.value.trim()) valid = false; });
    if (!valid) {
      submitBtn.textContent = 'Please fill all required fields';
      submitBtn.style.background = '#d97706';
      setTimeout(() => {
        submitBtn.textContent = submitBtn.dataset.original || 'Send Message';
        submitBtn.style.background = '';
      }, 2500);
      return;
    }
    submitBtn.dataset.original = submitBtn.textContent;
    submitBtn.textContent = 'Sent! We\'ll be in touch.';
    submitBtn.style.background = '#16a34a';
    inputs.forEach(inp => inp.value = '');
    setTimeout(() => {
      submitBtn.textContent = submitBtn.dataset.original || 'Send Message';
      submitBtn.style.background = '';
    }, 4000);
  });
});
