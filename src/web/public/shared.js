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
