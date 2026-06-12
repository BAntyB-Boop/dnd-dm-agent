// shared.js — Veiled Codex shared interactive behaviours

// DM passcode lock — one code + one unlock state shared by every sealed page
// (bestiary detail, one-shot guide, map & lore DM buttons). Unlock once, open everywhere.
window.VCLock = (function() {
  var CODE = '7777';
  var KEY = 'vc:dm-unlocked';
  // keys from when each page kept its own unlock state — honoured and migrated
  var LEGACY_KEYS = [
    'dm:porto-stellare:unlocked',
    'map:porto-stellare:dm-unlocked',
    'oneshot:porto-arrival:dm-unlocked'
  ];

  function isUnlocked() {
    try {
      if (localStorage.getItem(KEY) === '1') return true;
      for (var i = 0; i < LEGACY_KEYS.length; i++) {
        if (localStorage.getItem(LEGACY_KEYS[i]) === '1') {
          localStorage.setItem(KEY, '1');
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  // Returns true and persists the unlock if the code is correct.
  function attempt(code) {
    if (String(code == null ? '' : code).trim() !== CODE) return false;
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    return true;
  }

  // Hidden "type the code anywhere" unlock (digits typed outside form fields).
  // opts.skip: extra guard returning true while watching should pause.
  // opts.onUnlock: called once when the typed buffer matches the code.
  function watchKeys(opts) {
    opts = opts || {};
    var buf = '';
    var timer = null;
    document.addEventListener('keydown', function(e) {
      if (isUnlocked()) return;
      if (opts.skip && opts.skip()) return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key >= '0' && e.key <= '9') {
        buf += e.key;
        if (buf.length > CODE.length) buf = buf.slice(-CODE.length);
        if (attempt(buf)) {
          buf = '';
          if (opts.onUnlock) opts.onUnlock();
        }
        clearTimeout(timer);
        timer = setTimeout(function() { buf = ''; }, 3000);
      }
    });
  }

  // Inject a passcode overlay + lock-trigger button + auto-reveal targets.
  // Idempotent: calling twice on the same page does nothing the second time.
  // opts.reveals: array of CSS selectors that get class "unlocked" on success.
  // opts.title / opts.sub: overlay copy. opts.cancelLabel / opts.submitLabel.
  function installOverlay(opts) {
    opts = opts || {};
    if (document.getElementById('dm-code-overlay')) return;
    if (!document.getElementById('vc-lock-styles')) {
      var style = document.createElement('style');
      style.id = 'vc-lock-styles';
      style.textContent =
        '#dm-code-trigger{position:fixed;bottom:18px;left:18px;z-index:50;width:26px;height:26px;background:rgba(8,4,1,0.55);border:1px solid rgba(212,160,23,0.18);border-radius:50%;color:rgba(244,228,193,0.18);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:color .25s,border-color .25s,opacity .25s;opacity:.5;padding:0}' +
        '#dm-code-trigger:hover{color:#c9a45c;border-color:rgba(212,160,23,0.5);opacity:1}' +
        '#dm-code-trigger.unlocked{display:none}' +
        '#dm-code-trigger svg{width:12px;height:12px}' +
        '#dm-code-overlay{position:fixed;inset:0;z-index:9999;background:radial-gradient(800px 500px at 50% 40%,rgba(20,10,4,0.55),rgba(0,0,0,0.92) 75%);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;animation:vc-fade-in .3s ease}' +
        '#dm-code-overlay.open{display:flex}' +
        '@keyframes vc-fade-in{from{opacity:0}to{opacity:1}}' +
        '.dm-code-card{width:min(90vw,380px);padding:36px 30px 26px;background:linear-gradient(180deg,#15151c,#0e0e16);border:1px solid rgba(212,160,23,0.4);border-radius:3px;box-shadow:0 30px 80px rgba(0,0,0,0.7),0 0 60px rgba(212,160,23,0.08);text-align:center}' +
        '.dm-code-title{font-family:"Cinzel",serif;font-size:16px;letter-spacing:.14em;text-transform:uppercase;color:#f6efd2;margin-bottom:6px}' +
        '.dm-code-sub{font-size:12.5px;font-style:italic;color:rgba(244,228,193,0.5);margin-bottom:22px}' +
        '#dm-code-input{width:100%;padding:12px 14px;background:rgba(0,0,0,0.45);border:1px solid rgba(212,160,23,0.32);border-radius:2px;color:#f6efd2;font-family:"Cinzel",serif;font-size:20px;letter-spacing:.4em;text-align:center;outline:none;-webkit-text-security:disc;text-security:disc;transition:border-color .2s,box-shadow .2s}' +
        '#dm-code-input:focus{border-color:#c9a45c;box-shadow:0 0 0 3px rgba(212,160,23,0.12)}' +
        '#dm-code-overlay.error #dm-code-input{border-color:rgba(200,60,40,.7);box-shadow:0 0 0 3px rgba(200,60,40,0.15);animation:vc-shake .42s ease}' +
        '@keyframes vc-shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-6px)}40%,60%{transform:translateX(6px)}}' +
        '.dm-code-actions{display:flex;gap:10px;margin-top:16px}' +
        '.dm-code-btn{flex:1;padding:10px;background:linear-gradient(180deg,rgba(201,164,92,0.18),rgba(201,164,92,0.05));border:1px solid #8a6f3a;color:#f6efd2;font-family:"Cinzel",serif;font-size:10.5px;letter-spacing:.26em;text-transform:uppercase;cursor:pointer;border-radius:2px;transition:background .2s,border-color .2s}' +
        '.dm-code-btn:hover{border-color:#c9a45c;background:linear-gradient(180deg,rgba(201,164,92,0.3),rgba(201,164,92,0.1))}' +
        '.dm-code-btn.secondary{background:transparent;border-color:rgba(244,228,193,0.2);color:rgba(244,228,193,0.5)}' +
        '.dm-code-btn.secondary:hover{color:rgba(244,228,193,0.85);border-color:rgba(244,228,193,0.4)}' +
        '@media print{#dm-code-trigger,#dm-code-overlay{display:none !important}}';
      document.head.appendChild(style);
    }

    var trigger = document.createElement('button');
    trigger.id = 'dm-code-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'DM unlock');
    trigger.setAttribute('title', 'DM');
    trigger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="16" r="1"/><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    document.body.appendChild(trigger);

    var overlay = document.createElement('div');
    overlay.id = 'dm-code-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="dm-code-card">' +
        '<div class="dm-code-title">' + (opts.title || 'DM Access') + '</div>' +
        '<div class="dm-code-sub">' + (opts.sub || 'กรุณาใส่รหัสเพื่อปลดล็อก DM Guide') + '</div>' +
        '<input id="dm-code-input" type="text" inputmode="numeric" maxlength="4" placeholder="● ● ● ●" autocomplete="off" />' +
        '<div class="dm-code-actions">' +
          '<button class="dm-code-btn secondary" type="button" id="dm-code-cancel">' + (opts.cancelLabel || 'ยกเลิก') + '</button>' +
          '<button class="dm-code-btn" type="button" id="dm-code-submit">' + (opts.submitLabel || 'Unlock') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var input = overlay.querySelector('#dm-code-input');
    var submit = overlay.querySelector('#dm-code-submit');
    var cancel = overlay.querySelector('#dm-code-cancel');

    var targets = [trigger];
    (opts.reveals || []).forEach(function(sel) {
      var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
      if (el) targets.push(el);
    });

    function applyUnlock() { targets.forEach(function(el) { el.classList.add('unlocked'); }); }
    if (isUnlocked()) applyUnlock();

    function openPrompt() {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      setTimeout(function() { input.focus(); }, 100);
    }
    function closePrompt() {
      overlay.classList.remove('open');
      overlay.classList.remove('error');
      overlay.setAttribute('aria-hidden', 'true');
      input.value = '';
    }
    function doAttempt() {
      if (attempt(input.value)) {
        applyUnlock();
        closePrompt();
      } else {
        overlay.classList.add('error');
        setTimeout(function() { overlay.classList.remove('error'); }, 500);
        input.value = '';
        input.focus();
      }
    }

    trigger.addEventListener('click', openPrompt);
    submit.addEventListener('click', doAttempt);
    cancel.addEventListener('click', closePrompt);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doAttempt();
      else if (e.key === 'Escape') closePrompt();
    });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closePrompt(); });

    watchKeys({
      skip: function() { return overlay.classList.contains('open'); },
      onUnlock: applyUnlock
    });

    return { open: openPrompt, close: closePrompt, applyUnlock: applyUnlock };
  }

  return { isUnlocked: isUnlocked, attempt: attempt, watchKeys: watchKeys, installOverlay: installOverlay };
})();

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
