/* ================================================================
   FitQuest.dev — Enhanced JavaScript v2
   Animated theme switch, language dropdown, reading progress,
   scroll-to-top, counters, particles, tilt, smooth scroll
   ================================================================ */
(function () {
  'use strict';

  /* ---- Theme Toggle (Premium Pill Switch) ---- */
  var THEME_KEY = 'fitquest-theme';

  function getPreferred() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(THEME_KEY, t);
  }

  applyTheme(getPreferred());

  document.addEventListener('click', function (e) {
    var sw = e.target.closest('.theme-switch');
    if (sw) {
      var cur = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    }
  });

  /* ---- Language Selector (wired to i18n engine) ---- */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.lang-trigger');
    var selector = document.querySelector('.lang-selector');
    if (!selector) return;

    if (trigger) {
      selector.classList.toggle('open');
      return;
    }

    var option = e.target.closest('.lang-option');
    if (option && selector.contains(option)) {
      selector.querySelectorAll('.lang-option').forEach(function (o) { o.classList.remove('active'); });
      option.classList.add('active');
      var code = option.dataset.code || 'EN';
      var codeEl = selector.querySelector('.lang-trigger__text');
      if (codeEl) codeEl.textContent = code;
      selector.classList.remove('open');

      // Apply translations via i18n engine
      if (window.FitQuestI18n) {
        window.FitQuestI18n.setLanguage(code.toLowerCase());
      }
      return;
    }

    if (!e.target.closest('.lang-selector')) {
      selector.classList.remove('open');
    }
  });

  /* ---- Reading Progress Bar ---- */
  var progressBar = document.querySelector('.reading-progress__bar');
  function updateProgress() {
    if (!progressBar) return;
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = Math.min(pct, 100) + '%';
  }

  /* ---- Nav Scroll Effect ---- */
  var nav = document.getElementById('nav');
  function handleScroll() {
    if (!nav) return;
    if (window.scrollY > 60) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
    updateProgress();
    updateScrollTop();
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  /* ---- Scroll-to-Top Button ---- */
  var scrollTopBtn = document.querySelector('.scroll-top');
  function updateScrollTop() {
    if (!scrollTopBtn) return;
    if (window.scrollY > 500) scrollTopBtn.classList.add('visible');
    else scrollTopBtn.classList.remove('visible');
  }
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---- Scroll-Reveal Observer ---- */
  var revealEls = document.querySelectorAll('.reveal, .reveal--scale, .reveal--left, .reveal--right');
  if ('IntersectionObserver' in window) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          revealObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ---- Mobile Hamburger + Overlay ---- */
  var hamburger = document.getElementById('hamburger');
  var navLinks = document.getElementById('navLinks');
  var navOverlay = document.getElementById('navOverlay');

  function closeMobileNav() {
    if (hamburger) hamburger.classList.remove('open');
    if (navLinks) navLinks.classList.remove('open');
    if (navOverlay) navOverlay.classList.remove('open');
  }

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', function () {
      var isOpen = hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
      if (navOverlay) navOverlay.classList.toggle('open');
    });
    navLinks.querySelectorAll('.nav__link, .nav__cta').forEach(function (l) {
      l.addEventListener('click', closeMobileNav);
    });
  }
  if (navOverlay) {
    navOverlay.addEventListener('click', closeMobileNav);
  }

  /* ---- Animated Counters ---- */
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var counterObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          animateCounter(e.target, parseInt(e.target.dataset.count, 10));
          counterObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { counterObs.observe(el); });
  }

  function animateCounter(el, target) {
    var dur = 2200, start = performance.now();
    function tick(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 4);
      var val = Math.round(target * eased);
      el.textContent = val.toLocaleString() + (target >= 100 ? '+' : '');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---- Floating Particles ---- */
  var pc = document.getElementById('particles');
  if (pc) {
    var count = window.innerWidth < 768 ? 15 : 30;
    for (var i = 0; i < count; i++) {
      var dot = document.createElement('div');
      dot.className = 'particle';
      dot.style.left = Math.random() * 100 + '%';
      dot.style.animationDuration = 20 + Math.random() * 25 + 's';
      dot.style.animationDelay = Math.random() * 20 + 's';
      var sz = 1 + Math.random() * 2;
      dot.style.width = sz + 'px';
      dot.style.height = sz + 'px';
      var op = 0.06 + Math.random() * 0.14;
      dot.style.setProperty('--particle-opacity', op);
      dot.style.opacity = '0';
      pc.appendChild(dot);
    }
  }

  /* ---- Smooth Anchor Scroll ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = this.getAttribute('href');
      if (id === '#') return;
      var t = document.querySelector(id);
      if (t) {
        e.preventDefault();
        closeMobileNav();
        var offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
        var y = t.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });

  /* ---- Card Tilt ---- */
  if (window.innerWidth > 960) {
    document.querySelectorAll('.glass-card:not(.glass-card--static)').forEach(function (c) {
      c.addEventListener('mousemove', function (e) {
        var r = this.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        this.style.transform = 'translateY(-6px) perspective(700px) rotateX(' + (-y * 4) + 'deg) rotateY(' + (x * 4) + 'deg)';
      });
      c.addEventListener('mouseleave', function () { this.style.transform = ''; });
    });
  }

  /* ---- Button Magnetic Effect (desktop only) ---- */
  if (window.innerWidth > 960) {
    document.querySelectorAll('.btn--primary').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = this.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        this.style.transform = 'translateY(-3px) translate(' + (x * 0.06) + 'px,' + (y * 0.06) + 'px)';
      });
      b.addEventListener('mouseleave', function () { this.style.transform = ''; });
    });
  }

  /* ---- Regional Pricing Detection ---- */
  var PRICING_TABLE = {
    africa:        { monthly: '$2.69',  annual: '$24.21',  perMonth: '$2.02',  symbol: '$',  save: '$8.07',  label: 'Africa' },
    europe:        { monthly: '€5.99',  annual: '€53.99',  perMonth: '€4.50',  symbol: '€',  save: '€17.89', label: 'Europe' },
    north_america: { monthly: '$8.99',  annual: '$80.91',  perMonth: '$6.74',  symbol: '$',  save: '$26.97', label: 'North America' },
    south_america: { monthly: '$4.49',  annual: '$40.41',  perMonth: '$3.37',  symbol: '$',  save: '$13.47', label: 'South America' },
    asia:          { monthly: '$3.99',  annual: '$35.91',  perMonth: '$2.99',  symbol: '$',  save: '$11.97', label: 'Asia' },
    oceania:       { monthly: 'A$9.49', annual: 'A$85.41', perMonth: 'A$7.12', symbol: 'A$', save: 'A$28.47', label: 'Oceania' },
    middle_east:   { monthly: '$4.99',  annual: '$44.91',  perMonth: '$3.74',  symbol: '$',  save: '$14.97', label: 'Middle East' },
  };

  var TIMEZONE_TO_REGION = {
    'Africa': 'africa', 'Europe': 'europe', 'America/New_York': 'north_america',
    'America/Chicago': 'north_america', 'America/Denver': 'north_america',
    'America/Los_Angeles': 'north_america', 'America/Toronto': 'north_america',
    'America/Vancouver': 'north_america', 'US': 'north_america', 'Canada': 'north_america',
    'America/Mexico_City': 'north_america', 'America/Sao_Paulo': 'south_america',
    'America/Argentina': 'south_america', 'America/Bogota': 'south_america',
    'America/Lima': 'south_america', 'America/Santiago': 'south_america',
    'Asia': 'asia', 'Australia': 'oceania', 'Pacific/Auckland': 'oceania',
    'Asia/Dubai': 'middle_east', 'Asia/Riyadh': 'middle_east', 'Asia/Qatar': 'middle_east',
    'Asia/Kuwait': 'middle_east', 'Asia/Bahrain': 'middle_east', 'Asia/Tehran': 'middle_east',
    'Asia/Jerusalem': 'middle_east', 'Asia/Baghdad': 'middle_east',
  };

  function detectRegion() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      // Exact match first
      if (TIMEZONE_TO_REGION[tz]) return TIMEZONE_TO_REGION[tz];
      // Prefix match (e.g. "Africa/Maseru" → "Africa")
      var prefix = tz.split('/')[0];
      if (TIMEZONE_TO_REGION[prefix]) return TIMEZONE_TO_REGION[prefix];
      // Language-based fallback
      var lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (lang.indexOf('en-us') === 0 || lang.indexOf('en-ca') === 0) return 'north_america';
      if (lang.indexOf('pt-br') === 0 || lang.indexOf('es-ar') === 0 || lang.indexOf('es-cl') === 0 || lang.indexOf('es-co') === 0) return 'south_america';
      if (lang.indexOf('ar') === 0) return 'middle_east';
      if (lang.indexOf('en-au') === 0 || lang.indexOf('en-nz') === 0) return 'oceania';
      if (lang.indexOf('af') === 0 || lang.indexOf('zu') === 0 || lang.indexOf('xh') === 0 || lang.indexOf('st') === 0 || lang.indexOf('sw') === 0) return 'africa';
      if (lang.indexOf('zh') === 0 || lang.indexOf('ja') === 0 || lang.indexOf('ko') === 0 || lang.indexOf('hi') === 0) return 'asia';
      if (lang.indexOf('fr') === 0 || lang.indexOf('de') === 0 || lang.indexOf('es') === 0 || lang.indexOf('it') === 0 || lang.indexOf('pt-pt') === 0 || lang.indexOf('nl') === 0) return 'europe';
    } catch (e) { /* ignore */ }
    return 'africa'; // default: most affordable
  }

  function applyRegionalPricing() {
    var region = detectRegion();
    var p = PRICING_TABLE[region];
    if (!p) return;
    var elMonthly = document.getElementById('price-monthly');
    var elAnnual = document.getElementById('price-annual');
    var elBilled = document.getElementById('price-annual-billed');
    var elSave = document.getElementById('price-annual-save');
    if (elMonthly) elMonthly.innerHTML = p.monthly + ' <span>/ month</span>';
    if (elAnnual)  elAnnual.innerHTML  = p.perMonth + ' <span>/ month</span>';
    if (elBilled)  elBilled.textContent = 'Billed at ' + p.annual + '/year';
    if (elSave)    elSave.textContent   = 'Save ' + p.save + '/year — 2 months free';
  }

  applyRegionalPricing();

  /* ---- Parallax on Hero Orbs (subtle, desktop) ---- */
  if (window.innerWidth > 960) {
    var orbs = document.querySelectorAll('.hero__orb');
    if (orbs.length) {
      window.addEventListener('mousemove', function (e) {
        var mx = (e.clientX / window.innerWidth - 0.5) * 2;
        var my = (e.clientY / window.innerHeight - 0.5) * 2;
        orbs.forEach(function (orb, i) {
          var speed = 12 + i * 8;
          orb.style.transform = 'translate(' + (mx * speed) + 'px, ' + (my * speed) + 'px)';
        });
      }, { passive: true });
    }
  }

})();
