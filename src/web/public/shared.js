// shared.js — Veiled Codex shared interactive behaviours

// Live clock — only runs if #live-clock element exists on page
(function() {
  const el = document.getElementById('live-clock');
  if (!el) return;
  function tick() {
    const n = new Date();
    el.textContent = [n.getHours(), n.getMinutes(), n.getSeconds()]
      .map(v => String(v).padStart(2, '0')).join(':');
  }
  tick();
  setInterval(tick, 1000);
})();

// Scroll reveal — only runs if .panel elements exist
(function() {
  const panels = document.querySelectorAll('.panel');
  if (!panels.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  panels.forEach(p => io.observe(p));
})();

// M key — toggle music mute if #music-btn exists (skip when typing in inputs)
(function() {
  const btn = document.getElementById('music-btn');
  if (!btn) return;
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'm' && e.key !== 'M') return;
    const tag = (document.activeElement || {}).tagName || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    btn.click();
  });
})();

// Arrow keys — navigate prev/next folio when .folio-nav-link exists
// Fades out BGM (if playing) before navigating, for a smoother transition.
(function() {
  var prev = document.querySelector('.folio-nav-link.prev');
  var next = document.querySelector('.folio-nav-link.next');
  if (!prev && !next) return;
  function navigateTo(href) {
    var audio = document.getElementById('bg-audio');
    if (audio && !audio.paused && !audio.muted && audio.volume > 0) {
      var start = audio.volume;
      var steps = 12, interval = 18; // ~216ms fade
      var step = 0;
      var fade = setInterval(function() {
        step++;
        audio.volume = Math.max(0, start * (1 - step / steps));
        if (step >= steps) { clearInterval(fade); window.location.href = href; }
      }, interval);
    } else {
      window.location.href = href;
    }
  }
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (document.activeElement || {}).tagName || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var link = e.key === 'ArrowLeft' ? prev : next;
    if (link) { e.preventDefault(); navigateTo(link.href); }
  });
  [prev, next].forEach(function(link) {
    if (!link) return;
    link.addEventListener('click', function(e) {
      var audio = document.getElementById('bg-audio');
      if (audio && !audio.paused && !audio.muted && audio.volume > 0) {
        e.preventDefault();
        navigateTo(link.href);
      }
    });
  });
})();

// Folio keyboard hint — inject "← → navigate · M music" label into folio-nav
(function() {
  var nav = document.querySelector('.folio-nav');
  if (!nav) return;
  var hint = document.createElement('span');
  hint.className = 'folio-nav-keys';
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML = '<kbd>&#8592;</kbd><kbd>&#8594;</kbd> navigate &nbsp;&middot;&nbsp; <kbd>M</kbd> music';
  nav.appendChild(hint);
})();

// Folio visit tracking — record timestamp on folio pages so the roster can show recent visits
(function() {
  if (!document.querySelector('.folio-nav')) return;
  var key = 'folio:visited:' + window.location.pathname.replace(/\//g, '-').replace(/^-/, '');
  try { localStorage.setItem(key, Date.now()); } catch(e) {}
})();

// Folio scroll persistence — save and restore scroll position per folio
(function() {
  if (!document.querySelector('.folio-nav')) return;
  var scrollKey = 'folio:scroll:' + window.location.pathname.replace(/\//g, '-').replace(/^-/, '');
  // Restore on load (skip if URL has an anchor hash)
  try {
    var saved = parseInt(localStorage.getItem(scrollKey) || '0', 10);
    if (saved > 200 && !window.location.hash) window.scrollTo(0, saved);
  } catch(e) {}
  // Save on scroll (debounced)
  var scrollTimer;
  window.addEventListener('scroll', function() {
    if (window.scrollY < 200) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      try { localStorage.setItem(scrollKey, window.scrollY); } catch(e) {}
    }, 500);
  }, { passive: true });
  // Clear when scroll-to-top is clicked
  var scrollTopBtn = document.getElementById('scroll-top');
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', function() {
      try { localStorage.removeItem(scrollKey); } catch(e) {}
    });
  }
})();

// Folio DM note — inject collapsible textarea before .colophon on folio pages only
(function() {
  // Only run on character folio pages (has both .colophon and .folio-nav)
  var anchor = document.querySelector('.colophon');
  if (!anchor || !document.querySelector('.folio-nav')) return;

  var key = 'folio:note:' + window.location.pathname.replace(/\//g, '-').replace(/^-/, '');
  var openKey = key + ':open';
  var saved = '';
  var isOpen = false;
  try { saved = localStorage.getItem(key) || ''; isOpen = localStorage.getItem(openKey) === '1'; } catch(e) {}

  var style = document.createElement('style');
  style.textContent = [
    '.folio-dm-note{margin:32px 0 16px;max-width:680px}',
    '.folio-dm-toggle{display:inline-flex;align-items:center;gap:8px;font-family:"Cinzel",serif;font-size:.52rem;letter-spacing:.28em;text-transform:uppercase;color:var(--ink-faint,#4a4636);background:none;border:1px solid var(--line,#2a2a35);padding:6px 14px;cursor:pointer;transition:color .2s,border-color .2s}',
    '.folio-dm-toggle:hover{color:var(--gold-dim,#8a6f3a);border-color:var(--gold-dim,#8a6f3a)}',
    '.folio-dm-toggle.open{color:var(--gold-dim,#8a6f3a);border-color:var(--gold-dim,#8a6f3a)}',
    '.folio-dm-body{display:none;padding:10px 0 4px}',
    '.folio-dm-body.open{display:block}',
    '.folio-dm-ta{width:100%;min-height:80px;resize:vertical;background:rgba(7,7,10,.55);border:1px solid var(--line,#2a2a35);color:var(--ink-soft,#c9c2ad);font-family:"Cormorant Garamond",Georgia,serif;font-size:.9rem;padding:10px 13px;outline:none;transition:border-color .2s;box-sizing:border-box}',
    '.folio-dm-ta:focus{border-color:var(--gold-dim,#8a6f3a)}',
    '.folio-dm-ta::placeholder{color:var(--ink-faint,#4a4636)}',
    '.folio-dm-saved{display:inline-block;font-family:"Cinzel",serif;font-size:.48rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold-dim,#8a6f3a);opacity:0;transition:opacity .3s;padding-left:8px}',
    '.folio-dm-saved.show{opacity:1}',
    '@media print{.folio-dm-note{display:none!important}}'
  ].join('');
  document.head.appendChild(style);

  var wrap = document.createElement('div');
  wrap.className = 'folio-dm-note';
  wrap.innerHTML =
    '<button class="folio-dm-toggle' + (isOpen ? ' open' : '') + '" aria-expanded="' + isOpen + '"><span>' + (isOpen ? '&#9662;' : '&#9658;') + '</span> DM Notes</button>' +
    '<div class="folio-dm-body' + (isOpen ? ' open' : '') + '">' +
      '<textarea class="folio-dm-ta" placeholder="Notes on this character — auto-saved…" rows="3"></textarea>' +
      '<span class="folio-dm-saved">Saved</span>' +
    '</div>';
  anchor.parentNode.insertBefore(wrap, anchor);

  var toggleBtn = wrap.querySelector('.folio-dm-toggle');
  var body = wrap.querySelector('.folio-dm-body');
  var ta = wrap.querySelector('.folio-dm-ta');
  var savedLabel = wrap.querySelector('.folio-dm-saved');
  if (saved) ta.value = saved;

  toggleBtn.addEventListener('click', function() {
    var opening = !body.classList.contains('open');
    toggleBtn.classList.toggle('open', opening);
    body.classList.toggle('open', opening);
    toggleBtn.setAttribute('aria-expanded', String(opening));
    toggleBtn.querySelector('span').textContent = opening ? '▾' : '▶';
    try { localStorage.setItem(openKey, opening ? '1' : '0'); } catch(e) {}
  });

  var saveTimer;
  ta.addEventListener('input', function() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() {
      try { localStorage.setItem(key, ta.value); } catch(e) {}
      savedLabel.classList.add('show');
      setTimeout(function() { savedLabel.classList.remove('show'); }, 1600);
    }, 600);
  });
})();
