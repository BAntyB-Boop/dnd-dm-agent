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
