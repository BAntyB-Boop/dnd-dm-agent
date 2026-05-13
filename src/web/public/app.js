// ── D&D DM Atmosphere Viewer ──────────────────────────────────────────────

const $ = id => document.getElementById(id);

const WS_URL = `ws://${location.host}/ws`;
const API_URL = `${location.protocol}//${location.host}/api/state`;

const WEATHER_ICONS = {
  clear: '☀️', cloudy: '☁️', rainy: '🌧️', stormy: '⛈️',
  foggy: '🌫️', snowy: '❄️', windy: '💨', magical: '✨'
};
const TIME_ICONS = {
  dawn: '🌅', morning: '🌤️', noon: '☀️', afternoon: '🌞',
  dusk: '🌆', evening: '🌇', night: '🌙', midnight: '🌑'
};
const LIGHTING_LABEL = {
  daylight: '☀️ Daylight', dim: '🕯️ Dim', dark: '🌑 Dark',
  torchlight: '🔥 Torchlight', magical: '🔮 Magical',
  blinding: '💡 Blinding', candlelight: '🕯️ Candlelight'
};
const HP_COLORS = pct =>
  pct > 0.6 ? '#3a9a50' : pct > 0.25 ? '#c9a84c' : '#c04040';

let ws = null;
let reconnectTimer = null;
let pingTimer = null;
let state = { atmosphere: null, characters: [], combat: { active: false } };

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  setStatus('connecting');
  loadChatHistory();
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const data = await res.json();
      applyFullState(data);
    }
  } catch (_) { /* will get state via WS */ }

  connect();
}

// ── WebSocket ─────────────────────────────────────────────────────────────

function connect() {
  clearTimeout(reconnectTimer);
  clearInterval(pingTimer);

  // Remove handlers before closing to prevent spurious reconnect
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.close();
  }

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    setStatus('connected');
    addLog('system', '🔗 Connected to DM server');

    // Send ping every 20s to keep connection alive
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  };

  ws.onmessage = ({ data }) => {
    try {
      const msg = JSON.parse(data);
      if (msg.event === 'pong') return; // ignore pong
      handleEvent(msg.event, msg.data);
    } catch (_) {}
  };

  ws.onclose = () => {
    clearInterval(pingTimer);
    setStatus('disconnected');
    addLog('system', '⚠️ Connection lost — reconnecting in 3s...');
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    setStatus('disconnected');
  };
}

// ── Event Handlers ────────────────────────────────────────────────────────

function handleEvent(event, data) {
  switch (event) {
    case 'init':
      applyFullState(data);
      break;

    case 'atmosphere':
      applyAtmosphere(data);
      addLog('atmosphere', `🌍 Scene updated: ${data.scene ?? data.location ?? data.mood}`);
      break;

    case 'combat_start':
      addLog('combat', '⚔️ Combat has begun!');
      // Full state comes via combat_update broadcast immediately after
      fetchAndRefreshState();
      break;

    case 'combat_end':
      $('combat-panel').style.display = 'none';
      state.combat = { active: false };
      addLog('combat', `🏆 Combat ended: ${data.outcome ?? 'resolved'}`);
      break;

    case 'hp_update':
      updateCombatantHp(data.name, data.hp, data.max_hp);
      if (data.died) addLog('combat', `💀 ${data.name} has fallen!`);
      else addLog('hp', `❤️ ${data.name}: ${data.hp}/${data.max_hp} HP`);
      silentRefreshCharSheet();
      break;

    case 'party_update':
      renderParty(data);
      addLog('system', `👥 Party updated (${data.length} member${data.length !== 1 ? 's' : ''})`);
      break;

    case 'xp_award':
      addLog('xp', `⭐ ${data.name} +${data.amount} XP${data.leveledUp ? ` 🎉 Level ${data.newLevel}!` : ''}`);
      fetchAndRefreshParty();
      break;

    case 'spell_slot_used': {
      const sc = state.characters.find(c => c.name === data.character);
      if (sc && sc.spell_slots) {
        sc.spell_slots[String(data.level)] = data.remaining;
        renderParty(state.characters);
      }
      addLog('spell', `📖 ${data.character} cast **${data.spell}** (L${data.level} slot · ${data.remaining} remaining)`);
      break;
    }

    case 'long_rest':
      addLog('system', `🌙 Long rest — HP and all spell slots restored`);
      fetchAndRefreshState();
      break;

    case 'short_rest':
      addLog('system', `☀️ Short rest complete`);
      fetchAndRefreshState();
      break;

    case 'combat_update':
      state.combat = { ...state.combat, ...data };
      if (state.combat.active) $('combat-panel').style.display = '';
      renderCombat(state.combat);
      updateMapMarkers();
      break;

    case 'dice_roll':
      addLog('dice', `🎲 ${data.purpose}: ${data.breakdown} (${data.result})`);
      break;

    case 'campaign_changed':
      $('campaign-name').textContent = `⚔️ ${data.name}`;
      clearChatHistory();
      fetchAndRefreshState();
      addLog('system', `📋 Switched to campaign: ${data.name}`);
      break;
  }
}

async function fetchAndRefreshParty() {
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const data = await res.json();
      if (data.characters) renderParty(data.characters);
    }
  } catch (_) {}
}

async function fetchAndRefreshState() {
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const data = await res.json();
      if (data.characters) renderParty(data.characters);
      if (data.combat) {
        state.combat = data.combat;
        if (data.combat.active) {
          $('combat-panel').style.display = '';
          renderCombat(data.combat);
        }
      }
    }
  } catch (_) {}
}

// ── State Application ─────────────────────────────────────────────────────

function applyFullState(data) {
  if (data.campaign) {
    $('campaign-name').textContent = `⚔️ ${data.campaign.name}`;
  }
  if (data.atmosphere) applyAtmosphere(data.atmosphere);
  if (data.characters) renderParty(data.characters);
  if (data.combat) {
    state.combat = data.combat;
    if (data.combat.active) {
      $('combat-panel').style.display = '';
      renderCombat(data.combat);
    }
  }
}

function applyAtmosphere(atm) {
  state.atmosphere = atm;

  // Scene text
  if (atm.scene) {
    const el = $('scene-text');
    el.style.opacity = '0';
    setTimeout(() => { el.textContent = atm.scene; el.style.opacity = '1'; }, 300);
  }

  // Location / time / weather
  if (atm.location) $('location-text').textContent = atm.location;
  if (atm.time_of_day) {
    $('time-text').textContent = atm.time_of_day;
    $('time-icon').textContent = TIME_ICONS[atm.time_of_day] ?? '🕐';
  }
  if (atm.weather) {
    $('weather-text').textContent = atm.weather;
    $('weather-icon').textContent = WEATHER_ICONS[atm.weather] ?? '🌤️';
  }

  // Lighting
  if (atm.lighting) $('lighting-val').textContent = LIGHTING_LABEL[atm.lighting] ?? atm.lighting;

  // Mood
  if (atm.mood) {
    const moodClasses = Array.from(document.body.classList).filter(c => c.startsWith('mood-'));
    moodClasses.forEach(c => document.body.classList.remove(c));
    document.body.classList.add(`mood-${atm.mood}`);
    $('mood-label').textContent = atm.mood;
    const moodPct = { tense: 0.8, dangerous: 0.9, dark: 0.3, peaceful: 0.5, triumphant: 0.95, mysterious: 0.6, eerie: 0.45, joyful: 0.85, neutral: 0.5 };
    $('mood-fill').style.width = `${(moodPct[atm.mood] ?? 0.5) * 100}%`;
  }

  // Sounds
  const soundsRaw = atm.sounds;
  const sounds = Array.isArray(soundsRaw) ? soundsRaw
    : (typeof soundsRaw === 'string' ? tryParse(soundsRaw, []) : []);
  const soundsEl = $('sounds-list');
  soundsEl.innerHTML = '';
  sounds.forEach(s => {
    const tag = document.createElement('span');
    tag.className = 'sound-tag';
    tag.textContent = s;
    soundsEl.appendChild(tag);
  });

  // Active effects
  const effectsRaw = atm.active_effects;
  const effects = Array.isArray(effectsRaw) ? effectsRaw
    : (typeof effectsRaw === 'string' ? tryParse(effectsRaw, []) : []);
  const effectsEl = $('active-effects');
  effectsEl.innerHTML = '';
  effects.forEach(e => {
    const tag = document.createElement('span');
    tag.className = 'effect-tag';
    tag.textContent = e;
    effectsEl.appendChild(tag);
  });

  // Map
  if (atm.current_map !== undefined) {
    setMap(atm.current_map);
  }

  // Update map markers when position changes
  if (atm.player_x !== undefined && atm.player_y !== undefined) {
    updateMapMarkers();
  }
}

// ── Map Markers ────────────────────────────────────────────────────────────

function makeMarker(x, y, avatarHtml, name, hpColor, extraClass) {
  const m = document.createElement('div');
  m.className = 'char-map-marker' + (extraClass ? ' ' + extraClass : '');
  m.style.left      = `${x * 100}%`;
  m.style.top       = `${y * 100}%`;
  m.style.transform = 'translate(-50%, -100%)';
  m.innerHTML = `
    <div class="cmap-ring${extraClass ? ' monster-ring' : ''}" style="border-color:${hpColor};box-shadow:0 0 10px ${hpColor}66,0 2px 8px #000a">
      ${avatarHtml}
    </div>
    <div class="cmap-name${extraClass ? ' monster-name' : ''}">${name}</div>
    <div class="cmap-pin" style="background:${hpColor}"></div>
  `;
  return m;
}

function updateMapMarkers() {
  const container = $('party-markers');
  if (!container) return;
  container.innerHTML = '';

  const atm = state.atmosphere;
  if (!atm) return;

  // Player markers — individual positions from player_positions JSON
  const positions = tryParse(atm.player_positions || '{}', {});
  (state.characters || []).forEach(c => {
    const pos = positions[c.id] ?? positions[String(c.id)];
    if (!pos || pos.x < 0 || pos.y < 0) return;

    const pct = c.max_hp > 0 ? c.hp / c.max_hp : 0;
    const col = HP_COLORS(pct);
    const avatarHtml = c.avatar
      ? `<img class="cmap-img" src="/avatars/${encodeURIComponent(c.avatar)}" alt="${c.name}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
         <div class="cmap-fallback" style="display:none">⚔️</div>`
      : `<div class="cmap-fallback">⚔️</div>`;

    container.appendChild(makeMarker(pos.x, pos.y, avatarHtml, c.name, col, ''));
  });

  // Monster markers — positions from active combat participants
  if (state.combat && state.combat.active) {
    (state.combat.participants || []).forEach(p => {
      if (p.is_player) return;
      if (p.map_x == null || p.map_x < 0 || p.map_y == null || p.map_y < 0) return;

      const pct = p.max_hp > 0 ? p.hp / p.max_hp : 0;
      const col = HP_COLORS(pct);
      const avatarHtml = p.avatar
        ? `<img class="cmap-img" src="/monsters/${encodeURIComponent(p.avatar)}" alt="${p.name}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
           <div class="cmap-fallback" style="display:none">👾</div>`
        : `<div class="cmap-fallback">👾</div>`;

      const marker = makeMarker(p.map_x, p.map_y, avatarHtml, p.name, col, 'monster-marker');
      if (p.hp <= 0) marker.classList.add('dead-marker');
      container.appendChild(marker);
    });
  }
}

// ── Map Viewer ─────────────────────────────────────────────────────────────


let mapScale = 1;
let mapOffsetX = 0;
let mapOffsetY = 0;
let mapDragging = false;
let mapDragStart = { x: 0, y: 0 };

function setMap(filename) {
  const section = $('map-section');
  if (!filename) {
    section.style.display = 'none';
    return;
  }
  const img = $('map-img');
  const url = `/maps/${encodeURIComponent(filename)}${/\.[^.]+$/.test(filename) ? '' : '.png'}`;
  img.src = url;
  img.onload = () => {
    resetMapView();
    section.style.display = '';
    $('map-title').textContent = `🗺️ ${filename.replace(/\.[^.]+$/, '')}`;
    addLog('atmosphere', `🗺️ Map loaded: ${filename}`);
  };
  img.onerror = () => {
    // Try common extensions
    const exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const base = filename.replace(/\.[^.]+$/, '');
    const nextExt = exts.find(e => !url.endsWith(e));
    if (nextExt) img.src = `/maps/${encodeURIComponent(base)}${nextExt}`;
  };
}

function applyMapTransform() {
  const canvas = $('map-canvas');
  canvas.style.transform = `translate(calc(-50% + ${mapOffsetX}px), calc(-50% + ${mapOffsetY}px)) scale(${mapScale})`;
}

function resetMapView() {
  mapScale = 1;
  mapOffsetX = 0;
  mapOffsetY = 0;
  applyMapTransform();
}

function initMapControls() {
  const viewport = $('map-viewport');

  // Zoom with wheel
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.18;
    mapScale = Math.min(8, Math.max(0.2, mapScale * delta));
    applyMapTransform();
  }, { passive: false });

  // Pan with drag
  viewport.addEventListener('mousedown', (e) => {
    mapDragging = true;
    mapDragStart = { x: e.clientX - mapOffsetX, y: e.clientY - mapOffsetY };
    viewport.classList.add('grabbing');
  });

  window.addEventListener('mousemove', (e) => {
    if (!mapDragging) return;
    mapOffsetX = e.clientX - mapDragStart.x;
    mapOffsetY = e.clientY - mapDragStart.y;
    applyMapTransform();
  });

  window.addEventListener('mouseup', () => {
    mapDragging = false;
    $('map-viewport').classList.remove('grabbing');
  });

  // Touch support
  let lastTouchDist = 0;
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      mapDragging = true;
      mapDragStart = { x: e.touches[0].clientX - mapOffsetX, y: e.touches[0].clientY - mapOffsetY };
    } else if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && mapDragging) {
      mapOffsetX = e.touches[0].clientX - mapDragStart.x;
      mapOffsetY = e.touches[0].clientY - mapDragStart.y;
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDist > 0) {
        mapScale = Math.min(8, Math.max(0.2, mapScale * (dist / lastTouchDist)));
      }
      lastTouchDist = dist;
    }
    applyMapTransform();
  }, { passive: false });

  viewport.addEventListener('touchend', () => { mapDragging = false; lastTouchDist = 0; });

  // Double-click to reset
  viewport.addEventListener('dblclick', resetMapView);

  // Reset button
  $('map-reset-btn').addEventListener('click', resetMapView);

  // Expand / collapse map height
  $('map-expand-btn').addEventListener('click', () => {
    const section = $('map-section');
    const btn = $('map-expand-btn');
    const isExpanded = section.classList.toggle('expanded');
    btn.textContent = isExpanded ? '⤡' : '⤢';
    btn.title = isExpanded ? 'Collapse map' : 'Expand map';
    btn.classList.toggle('expanded', isExpanded);
  });

  // Fullscreen button
  $('map-fullscreen-btn').addEventListener('click', () => {
    const overlay = $('map-fullscreen-overlay');
    $('map-fullscreen-img').src = $('map-img').src;
    overlay.classList.add('active');
  });

  $('map-fullscreen-close').addEventListener('click', () => {
    $('map-fullscreen-overlay').classList.remove('active');
  });

  $('map-fullscreen-overlay').addEventListener('click', (e) => {
    if (e.target === $('map-fullscreen-overlay')) {
      $('map-fullscreen-overlay').classList.remove('active');
    }
  });
}

function renderParty(characters) {
  state.characters = characters;
  const cards = $('party-cards');
  cards.innerHTML = '';
  updateMapMarkers();
  if (!characters.length) return;

  characters.forEach(c => {
    const pct = c.max_hp > 0 ? c.hp / c.max_hp : 0;
    const hpColor = HP_COLORS(pct);
    const ringColor = HP_COLORS(pct);

    const avatarInner = c.avatar
      ? `<img class="char-avatar-img" src="/avatars/${encodeURIComponent(c.avatar)}" alt="${c.name}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
         <div class="char-avatar-fallback" style="display:none">⚔️</div>`
      : `<div class="char-avatar-fallback">⚔️</div>`;

    // Spell slots — only show if character has any
    const slots = c.spell_slots && typeof c.spell_slots === 'object' ? c.spell_slots : {};
    const slotEntries = Object.entries(slots).filter(([, v]) => Number(v) >= 0);
    let spellSlotsHtml = '';
    if (slotEntries.length > 0) {
      const pips = slotEntries.map(([k, v]) => {
        const num = Number(v);
        return `<span class="slot-group" title="Level ${k} slots">${'🔷'.repeat(num) || '⬜'}<span class="slot-label">${k}</span></span>`;
      }).join('');
      spellSlotsHtml = `<div class="char-card-slots">📖 ${pips}</div>`;
    }

    const card = document.createElement('div');
    card.className = 'char-card';
    card.dataset.name = c.name;
    card.dataset.id = c.id;
    card.style.cursor = 'pointer';
    card.title = 'Click to view character sheet';
    card.addEventListener('click', () => openCharSheet(c.id));
    card.innerHTML = `
      <div class="char-avatar-ring" style="--ring-color:${ringColor}">
        ${avatarInner}
      </div>
      <div class="char-card-body">
        <div class="char-card-name">${c.name}</div>
        <div class="char-card-sub">${c.race} ${c.class} · Lv ${c.level} · 🛡${c.ac}</div>
        <div class="char-card-hp-wrap">
          <div class="char-card-hp-bar">
            <div class="char-card-hp-fill" style="width:${pct*100}%;background:${hpColor}"></div>
          </div>
          <div class="char-card-hp-text">${c.hp}/${c.max_hp} HP</div>
        </div>
        ${spellSlotsHtml}
      </div>
    `;
    cards.appendChild(card);
  });

  // Update character selector in chat
  const sel = $('chat-character');
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Character —</option>';
  characters.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;
  silentRefreshCharSheet();
}

function renderCombat(combat) {
  if (!combat.active) return;
  $('combat-round').textContent = `Round ${combat.round}`;
  const container = $('combat-participants');
  container.innerHTML = '';
  const parts = combat.participants ?? [];
  parts.forEach((p, i) => {
    const pct    = p.max_hp > 0 ? p.hp / p.max_hp : 0;
    const dead   = p.hp <= 0;
    const active = i === combat.current_turn_index;

    // Avatar — players: look up from party; monsters: use p.avatar
    let avatarHtml;
    if (p.is_player) {
      const char = (state.characters || []).find(c => c.name === p.name);
      if (char && char.avatar) {
        avatarHtml = `<img class="combatant-avatar" src="/avatars/${encodeURIComponent(char.avatar)}"
                           onerror="this.outerHTML='<span class=combatant-icon>🧙</span>'" />`;
      } else {
        avatarHtml = `<span class="combatant-icon">🧙</span>`;
      }
    } else {
      if (p.avatar) {
        avatarHtml = `<img class="combatant-avatar monster-avatar" src="/monsters/${encodeURIComponent(p.avatar)}"
                           onerror="this.outerHTML='<span class=combatant-icon>👾</span>'" />`;
      } else {
        avatarHtml = `<span class="combatant-icon">👾</span>`;
      }
    }

    const row = document.createElement('div');
    row.className = `combatant-row${active ? ' active-turn' : ''}${dead ? ' dead' : ''}`;
    row.dataset.name = p.name;
    row.innerHTML = `
      ${active ? '<span class="turn-arrow">▶</span>' : '<span class="turn-arrow-placeholder"></span>'}
      ${avatarHtml}
      <span class="combatant-name">${p.name}</span>
      <span class="combatant-init" title="Initiative">⚡${p.initiative ?? '?'}</span>
      <span class="combatant-ac" title="Armor Class">🛡${p.ac}</span>
      <div class="hp-bar-wrap">
        <div class="hp-bar">
          <div class="hp-fill" style="width:${pct*100}%;background:${HP_COLORS(pct)}"></div>
        </div>
        <div class="hp-text">${p.hp}/${p.max_hp}</div>
      </div>
    `;
    container.appendChild(row);
  });
}

function updateCombatantHp(name, hp, maxHp) {
  const rows = document.querySelectorAll(`.combatant-row[data-name="${name}"]`);
  rows.forEach(row => {
    const pct = maxHp > 0 ? hp / maxHp : 0;
    const fill = row.querySelector('.hp-fill');
    const text = row.querySelector('.hp-text');
    if (fill) { fill.style.width = `${pct*100}%`; fill.style.background = HP_COLORS(pct); }
    if (text) text.textContent = `${hp}/${maxHp}`;
    if (hp <= 0) row.classList.add('dead');
  });
}

// ── Log ───────────────────────────────────────────────────────────────────

function addLog(type, message) {
  const log = $('event-log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  entry.innerHTML = `<span class="log-time">${now}</span>${message}`;
  log.insertBefore(entry, log.firstChild);
  // Keep last 50 entries
  while (log.children.length > 50) log.removeChild(log.lastChild);
}

// ── Utils ─────────────────────────────────────────────────────────────────

function setStatus(status) {
  const dot = $('connection-status');
  dot.className = `status-dot ${status}`;
  dot.title = status.charAt(0).toUpperCase() + status.slice(1);
}

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ── Chat ─────────────────────────────────────────────────────────────────

let chatLoading = false;
const CHAT_STORAGE_KEY = 'dnd_chat_history';
const chatHistory = []; // in-memory mirror

function mdToHtml(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function renderChatMsgEl(type, name, html) {
  const box = $('chat-messages');
  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;
  const nameHtml = name ? `<span class="chat-name">${name}</span>` : '';
  div.innerHTML = `${nameHtml}<span class="chat-text">${html}</span>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  while (box.children.length > 120) box.removeChild(box.firstChild);
}

function addChatMsg(type, name, text) {
  const html = mdToHtml(text);
  renderChatMsgEl(type, name, html);
  chatHistory.push({ type, name, html });
  const trimmed = chatHistory.slice(-80);
  try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed)); } catch {}
}

function loadChatHistory() {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!stored) return;
    const msgs = JSON.parse(stored);
    if (!msgs.length) return;
    const box = $('chat-messages');
    box.innerHTML = '';
    msgs.forEach(m => { chatHistory.push(m); renderChatMsgEl(m.type, m.name, m.html); });
  } catch {}
}

function clearChatHistory() {
  chatHistory.length = 0;
  try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch {}
  const box = $('chat-messages');
  box.innerHTML = '<div class="chat-msg system"><span class="chat-text"><em>Adventure awaits — speak to your Dungeon Master...</em></span></div>';
}

function setChatLoading(on) {
  chatLoading = on;
  const btn = $('chat-send-btn');
  btn.disabled = on;
  btn.textContent = on ? '...' : '⚔️ Send';
  const existing = $('chat-loading-indicator');
  if (on && !existing) {
    const box = $('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-msg loading';
    el.id = 'chat-loading-indicator';
    el.innerHTML = '<span class="chat-dots"><span>.</span><span>.</span><span>.</span></span>';
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  } else if (!on && existing) {
    existing.remove();
  }
}

function showRollBtn(pending) {
  const area = $('chat-roll-area');
  area.innerHTML = '';
  if (!pending) return;
  const adv = pending.advantage && pending.advantage !== 'normal' ? ` (${pending.advantage})` : '';
  const dc  = pending.dc ? ` — DC ${pending.dc}` : '';
  const btn = document.createElement('button');
  btn.className = 'chat-roll-btn';
  btn.textContent = `🎲 ${pending.purpose} (${pending.expression})${adv}${dc}`;
  btn.onclick = () => executeRoll(pending);
  area.appendChild(btn);
}

function showPartyRollBtns(partyRoll) {
  const area = $('chat-roll-area');
  area.innerHTML = '';
  if (!partyRoll) return;
  const adv = partyRoll.advantage && partyRoll.advantage !== 'normal' ? ` (${partyRoll.advantage})` : '';
  const dc  = partyRoll.dc ? ` — DC ${partyRoll.dc}` : '';
  const hdr = document.createElement('div');
  hdr.className = 'chat-party-roll-header';
  hdr.textContent = `🎲 Party Roll: ${partyRoll.purpose} (${partyRoll.expression})${adv}${dc} — กดปุ่มของตัวละครคุณ`;
  area.appendChild(hdr);
  partyRoll.entries.forEach((e, idx) => {
    const btn = document.createElement('button');
    btn.className = 'chat-roll-btn';
    btn.textContent = `🎲 ${e.characterName}`;
    btn.dataset.idx = String(idx);
    btn.onclick = () => executePartyRoll(partyRoll.groupId, idx, btn);
    area.appendChild(btn);
  });
}

async function executeRoll(pending) {
  const provider = $('chat-provider').value;
  $('chat-roll-area').innerHTML = '';
  setChatLoading(true);
  try {
    const res  = await fetch(`/api/roll/${pending.rollId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    const data = await res.json();
    setChatLoading(false);
    if (data.roll)      addChatMsg('roll', '🎲', `${pending.characterName} — ${pending.purpose}: ${data.roll.breakdown}`);
    if (data.narrative) addChatMsg('dm', 'DM', data.narrative);
    if (data.pendingRoll)      showRollBtn(data.pendingRoll);
    else if (data.pendingPartyRoll) showPartyRollBtns(data.pendingPartyRoll);
  } catch (err) {
    setChatLoading(false);
    addChatMsg('system', '', `❌ Roll error: ${err.message}`);
  }
}

async function executePartyRoll(groupId, charIdx, btn) {
  btn.disabled = true;
  const charName = btn.textContent.replace('🎲 ', '');
  btn.textContent = `✅ ${charName}`;
  const provider = $('chat-provider').value;
  try {
    const res  = await fetch(`/api/party-roll/${groupId}/${charIdx}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    const data = await res.json();
    if (data.roll) addChatMsg('roll', '🎲', `${charName}: ${data.roll.breakdown}`);
    if (data.allDone) {
      $('chat-roll-area').innerHTML = '';
      if (data.narrative) addChatMsg('dm', 'DM', data.narrative);
      if (data.pendingRoll)           showRollBtn(data.pendingRoll);
      else if (data.pendingPartyRoll) showPartyRollBtns(data.pendingPartyRoll);
    }
  } catch (err) {
    addChatMsg('system', '', `❌ Roll error: ${err.message}`);
  }
}

async function sendToDM() {
  if (chatLoading) return;
  const input = $('chat-input');
  const message = input.value.trim();
  if (!message) return;
  const characterName = $('chat-character').value || null;
  const provider = $('chat-provider').value;
  input.value = '';
  addChatMsg('player', characterName || 'Player', message);
  setChatLoading(true);
  try {
    const res  = await fetch('/api/dm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, characterName, provider }),
    });
    const data = await res.json();
    setChatLoading(false);
    if (data.error) { addChatMsg('system', '', `❌ ${data.error}`); return; }
    if (data.narrative) addChatMsg('dm', 'DM', data.narrative);
    if (data.pendingRoll)           showRollBtn(data.pendingRoll);
    else if (data.pendingPartyRoll) showPartyRollBtns(data.pendingPartyRoll);
  } catch (err) {
    setChatLoading(false);
    addChatMsg('system', '', `❌ Error: ${err.message}`);
  }
}

// ── Character Sheet Modal ─────────────────────────────────────────────────

let _openCharId = null;

function csActivateTab(tab) {
  document.querySelectorAll('.cs-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('charsheet-content').style.display  = tab === 'sheet'     ? '' : 'none';
  $('charsheet-abilities').style.display = tab === 'abilities' ? '' : 'none';
}

function statMod(v) {
  const mod = Math.floor((v - 10) / 2);
  return (mod >= 0 ? '+' : '') + mod;
}

function profBonus(level) {
  return Math.floor((level - 1) / 4) + 2;
}

function weaponStats(item, c) {
  const desc  = (item.description ?? '').toLowerCase();
  const strMod = Math.floor((c.strength    - 10) / 2);
  const dexMod = Math.floor((c.dexterity   - 10) / 2);
  const prof   = profBonus(c.level);

  // Determine which stat to use
  let statUsed;
  if (desc.includes('finesse'))                    statUsed = Math.max(strMod, dexMod);
  else if (desc.includes('range') || desc.includes('thrown')) statUsed = dexMod;
  else                                              statUsed = strMod;

  const atkBonus = prof + statUsed;
  const dmgBonus = statUsed;

  // Extract damage dice from description  e.g. "1d8 slashing"
  const diceMatch = (item.description ?? '').match(/(\d+d\d+)/);
  const dice = diceMatch ? diceMatch[1] : '—';

  const atkStr = (atkBonus >= 0 ? '+' : '') + atkBonus;
  const dmgStr = dice + (dmgBonus !== 0 ? (dmgBonus > 0 ? '+' : '') + dmgBonus : '');
  return `⚔️ <span class="weapon-atk">${atkStr} to hit</span> · <span class="weapon-dmg">${dmgStr}</span>`;
}

const STAT_NAMES = ['strength','dexterity','constitution','intelligence','wisdom','charisma'];
const STAT_ABBR  = { strength:'STR', dexterity:'DEX', constitution:'CON', intelligence:'INT', wisdom:'WIS', charisma:'CHA' };
const SAVE_STAT  = { strength:'STR', dexterity:'DEX', constitution:'CON', intelligence:'INT', wisdom:'WIS', charisma:'CHA' };

function _renderCharSheetContent(c, charId) {
  const prof     = profBonus(c.level);
  const slots    = c.spell_slots && typeof c.spell_slots === 'object' ? c.spell_slots : {};
  const maxSlots = c.max_spell_slots && typeof c.max_spell_slots === 'object' ? c.max_spell_slots : {};
  const saves    = Array.isArray(c.savingThrows) ? c.savingThrows.map(s => s.toLowerCase()) : [];
  const skills   = Array.isArray(c.skills) ? c.skills : [];
  const conds    = Array.isArray(c.conditions) ? c.conditions : [];
  const mcEntries = Array.isArray(c.multiclassEntries) ? c.multiclassEntries : [];

  const xpPct = c.nextLvXp ? Math.min(100, Math.round((c.xp / c.nextLvXp) * 100)) : 100;
  const xpBar = `<div class="cs-xp-wrap">
    <div class="cs-xp-bar"><div class="cs-xp-fill" style="width:${xpPct}%"></div></div>
    <span class="cs-xp-text">${c.xp} XP${c.nextLvXp ? ` / ${c.nextLvXp}` : ' (max level)'}</span>
  </div>`;

  const statsHtml = STAT_NAMES.map(s => {
    const val  = c[s];
    const mod  = Math.floor((val - 10) / 2);
    const modS = (mod >= 0 ? '+' : '') + mod;
    const isProfSave = saves.includes(s);
    const saveVal = isProfSave ? mod + prof : mod;
    const saveS   = (saveVal >= 0 ? '+' : '') + saveVal;
    return `<div class="cs-stat">
      <span class="cs-stat-name">${STAT_ABBR[s]}</span>
      <span class="cs-stat-val">${val}</span>
      <span class="cs-stat-mod">${modS}</span>
      <span class="cs-stat-save${isProfSave ? ' prof' : ''}" title="Saving Throw">${saveS}</span>
    </div>`;
  }).join('');

  const slotRows = Object.entries(maxSlots).map(([lv, max]) => {
    const cur  = slots[lv] ?? max;
    const pips = Array.from({ length: Number(max) }, (_, i) =>
      `<span class="slot-pip${i < Number(cur) ? ' filled' : ''}"></span>`
    ).join('');
    return `<div class="cs-slot-row"><span class="cs-slot-lv">Lv ${lv}</span>${pips}<span class="cs-slot-count">${cur}/${max}</span></div>`;
  }).join('');

  const inv = (c.inventory ?? []).map(item => {
    const canEquip = ['weapon','armor','shield','focus','ring','amulet','cloak'].includes(item.type);
    const equipBtn = canEquip
      ? `<button class="equip-btn${item.equipped ? ' unequip' : ''}" data-id="${item.id}" data-equipped="${item.equipped ? 1 : 0}">${item.equipped ? 'Unequip' : 'Equip'}</button>`
      : '';
    const wStats = (item.equipped && item.type === 'weapon')
      ? `<span class="weapon-stats">${weaponStats(item, c)}</span>` : '';
    return `<div class="cs-inv-row${item.equipped ? ' equipped' : ''}">
      <span class="cs-inv-name">${item.name}${item.equipped ? ' <span class="equipped-badge">E</span>' : ''}</span>
      <span class="cs-inv-qty">×${item.quantity}</span>
      ${equipBtn}${wStats}
      ${item.description ? `<span class="cs-inv-desc">${item.description}</span>` : ''}
    </div>`;
  }).join('') || '<div class="cs-empty">Empty</div>';

  const condsHtml = conds.length
    ? conds.map(cd => `<span class="cs-condition">${cd}</span>`).join('')
    : '';

  const skillsHtml = skills.length
    ? skills.map(s => `<span class="cs-skill-tag">${s}</span>`).join('')
    : '<span class="cs-empty">—</span>';

  $('charsheet-content').innerHTML = `
    <div class="cs-header">
      ${c.avatar
        ? `<img class="cs-avatar" src="/avatars/${encodeURIComponent(c.avatar)}" alt="${c.name}" />`
        : '<div class="cs-avatar-fallback">⚔️</div>'}
      <div class="cs-header-info">
        <div class="cs-name">${c.name}</div>
        <div class="cs-sub">${c.race} ${buildClassLabel(c, mcEntries)} · Lv ${c.level} · Prof +${prof}</div>
        <div class="cs-sub">${c.background ?? ''}</div>
        ${xpBar}
        <div class="cs-vitals">
          <span>❤️ ${c.hp}/${c.max_hp}${c.temp_hp > 0 ? ` <span class="cs-temphp">+${c.temp_hp} tmp</span>` : ''}</span>
          <span>🛡 AC ${c.ac}</span>
          <span>⚡ Init +${c.initiative_bonus ?? Math.floor((c.dexterity - 10) / 2)}</span>
          <span>🏃 ${c.speed ?? 30}ft</span>
          <span>🪙 ${c.gold}g ${c.silver}s ${c.copper}c</span>
        </div>
        ${condsHtml ? `<div class="cs-conditions">${condsHtml}</div>` : ''}
      </div>
    </div>

    <div class="cs-grid">
      <div class="cs-section">
        <div class="cs-section-title">Ability Scores <span class="cs-title-note">mod · save</span></div>
        ${statsHtml}
      </div>
      <div class="cs-section">
        ${slotRows ? `<div class="cs-section-title">Spell Slots</div>${slotRows}` : ''}
        <div class="cs-section-title" style="margin-top:${slotRows ? '14px':'0'}">Proficient Skills</div>
        <div class="cs-skills">${skillsHtml}</div>
      </div>
    </div>

    <div class="cs-section">
      <div class="cs-section-title">Inventory</div>
      <div class="cs-inventory">${inv}</div>
    </div>

    ${c.notes ? `<div class="cs-section"><div class="cs-section-title">Notes</div><div class="cs-notes">${c.notes}</div></div>` : ''}

    <div class="cs-section cs-levelup-section">
      <div class="cs-section-title">Level Up</div>
      <div class="lu-btn-row">
        <button class="levelup-btn" data-class="${c.class}">⬆ ${capitalize(c.class)} (Lv ${mcEntries.length ? c.level - mcEntries.reduce((s,e)=>s+e.level,0) : c.level})</button>
        ${mcEntries.map(e => `<button class="levelup-btn mc" data-class="${e.class}">⬆ ${capitalize(e.class)} (Lv ${e.level})</button>`).join('')}
        <button class="levelup-add-mc-btn" id="lu-add-mc-btn-${charId}">+ Multiclass</button>
      </div>
      <div class="lu-add-mc-wrap" id="lu-add-mc-${charId}" style="display:none">
        <select class="lu-mc-select" id="lu-mc-sel-${charId}">
          <option value="">Pick class…</option>
          ${['barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard']
            .filter(cl => cl !== c.class.toLowerCase() && !mcEntries.find(e=>e.class.toLowerCase()===cl))
            .map(cl=>`<option value="${cl}">${capitalize(cl)}</option>`).join('')}
        </select>
        <button class="levelup-btn mc" id="lu-mc-confirm-${charId}">⬆ Add Level</button>
      </div>
    </div>
  `;

  $('charsheet-content').querySelectorAll('.equip-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const itemId   = parseInt(btn.dataset.id);
      const equipped = btn.dataset.equipped === '1';
      await fetch(`/api/inventory/${itemId}/equip`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipped: !equipped, charId }),
      });
      openCharSheet(charId);
    });
  });

  $('charsheet-content').querySelectorAll('.levelup-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cls = btn.dataset.class;
      const isMc = btn.classList.contains('mc') && cls !== c.class.toLowerCase();
      await levelUp(charId, isMc ? cls : undefined);
    });
  });

  const addMcBtn = document.getElementById(`lu-add-mc-btn-${charId}`);
  const addMcWrap = document.getElementById(`lu-add-mc-${charId}`);
  if (addMcBtn && addMcWrap) {
    addMcBtn.addEventListener('click', () => {
      addMcWrap.style.display = addMcWrap.style.display === 'none' ? 'flex' : 'none';
    });
    const confirmBtn = document.getElementById(`lu-mc-confirm-${charId}`);
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const sel = document.getElementById(`lu-mc-sel-${charId}`);
        if (sel && sel.value) await levelUp(charId, sel.value);
      });
    }
  }
}

async function silentRefreshCharSheet() {
  if (!_openCharId || !$('charsheet-overlay').classList.contains('active')) return;
  const activeTab = document.querySelector('.cs-tab.active')?.dataset.tab ?? 'sheet';
  try {
    if (activeTab === 'abilities') {
      $('charsheet-abilities').innerHTML = '';
      loadAbilitiesTab(_openCharId);
    } else {
      const res = await fetch(`/api/character/${_openCharId}`);
      if (!res.ok) return;
      const c = await res.json();
      _renderCharSheetContent(c, _openCharId);
    }
  } catch (_) {}
}

function openCharSheet(charId) {
  _openCharId = charId;
  csActivateTab('sheet');
  $('charsheet-abilities').innerHTML = '';
  fetch(`/api/character/${charId}`)
    .then(r => r.json())
    .then(c => {
      _renderCharSheetContent(c, charId);
      $('charsheet-overlay').classList.add('active');
    })
    .catch(() => alert('Failed to load character'));
}

$('charsheet-close').addEventListener('click', () => $('charsheet-overlay').classList.remove('active'));
$('charsheet-overlay').addEventListener('click', e => { if (e.target === $('charsheet-overlay')) $('charsheet-overlay').classList.remove('active'); });

document.querySelectorAll('.cs-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    csActivateTab(tab);
    if (tab === 'abilities' && _openCharId && !$('charsheet-abilities').innerHTML) {
      loadAbilitiesTab(_openCharId);
    }
  });
});

async function loadAbilitiesTab(charId) {
  const ab = $('charsheet-abilities');
  ab.innerHTML = '<div class="cs-empty">Loading...</div>';
  try {
    const res  = await fetch(`/api/character/${charId}/abilities`);
    const data = await res.json();
    const { features = [], spells = [], prepClasses = [] } = data;

    // Local per-class prep state: { className -> Set<spellName> }
    const localPrep = {};
    prepClasses.forEach(pc => {
      localPrep[pc.className] = new Set(pc.prepared);
    });
    // Quick lookup: is a spell prepared in any class?
    const anyPrepared = name => Object.values(localPrep).some(s => s.has(name));

    // ── Group features by class ──
    const featByClass = {};
    features.forEach(f => {
      const cls = f.fromClass ?? 'unknown';
      if (!featByClass[cls]) featByClass[cls] = [];
      featByClass[cls].push(f);
    });
    const featuresHtml = Object.entries(featByClass).map(([cls, list]) => `
      <div class="ab-class-block">
        <div class="ab-class-label">${capitalize(cls)} Features</div>
        ${list.map(f => `
          <div class="ab-feature">
            <div class="ab-feature-header">
              <span class="ab-feature-name">${f.name}</span>
              <span class="ab-feature-lv">Lv ${f.level}</span>
            </div>
            <div class="ab-feature-desc">${f.description}</div>
          </div>`).join('')}
      </div>`).join('') || '<div class="cs-empty">No class features available</div>';

    // ── Deduplicate spells, group by class then level ──
    const spellsByClass = {};
    const seen = new Set();
    spells.forEach(s => {
      const key = `${s.name}|${s.level}`;
      if (seen.has(key)) return;
      seen.add(key);
      const cls = s.fromClass ?? 'unknown';
      if (!spellsByClass[cls]) spellsByClass[cls] = {};
      const lv = s.level ?? 0;
      if (!spellsByClass[cls][lv]) spellsByClass[cls][lv] = [];
      spellsByClass[cls][lv].push(s);
    });

    // Build per-class prep banners (one per preparer class, shown above that class's spells)
    const prepBannerFor = (cls) => {
      const pc = prepClasses.find(p => p.className === cls);
      if (!pc) return '';
      const count = localPrep[cls]?.size ?? 0;
      return `
        <div class="ab-prep-banner" data-prep-cls="${cls}">
          <span class="ab-prep-info">
            📖 Prepare — <strong><span class="ab-prep-count" data-prep-cls="${cls}">${count}</span> / ${pc.maxPrepared}</strong>
            <span class="ab-prep-stat">(${pc.statName.slice(0,3).toUpperCase()} mod + level)</span>
          </span>
          <button class="ab-prep-save-btn" data-prep-cls="${cls}">💾 Save</button>
        </div>`;
    };

    const spellsHtml = Object.entries(spellsByClass).map(([cls, lvMap]) => {
      const isPrepCls = !!localPrep[cls];
      const groups = Object.keys(lvMap).sort((a,b) => Number(a)-Number(b)).map(lv => {
        const label = Number(lv) === 0 ? 'Cantrips' : `Level ${lv}`;
        const isCantrip = Number(lv) === 0;
        const cards = lvMap[lv].map(s => {
          const tags = [s.school];
          if (s.ritual)        tags.push('Ritual');
          if (s.concentration) tags.push('Conc.');
          const prepped = isPrepCls && !isCantrip && localPrep[cls]?.has(s.name);
          const prepBtn = (isPrepCls && !isCantrip) ? `
            <button class="ab-prep-btn${prepped ? ' prepped' : ''}"
              data-spell="${s.name}" data-prep-cls="${cls}">
              ${prepped ? '✅ Prepared' : '⬜ Prepare'}
            </button>` : '';
          const dimmed = isPrepCls && !isCantrip && !prepped;
          return `<div class="ab-spell${dimmed ? ' ab-spell-unprepared' : ''}">
            <div class="ab-spell-header">
              <span class="ab-spell-name">${s.name}</span>
              <span class="ab-spell-tags">${tags.join(' · ')}</span>
              ${prepBtn}
            </div>
            <div class="ab-spell-meta">
              ${s.castingTime ? `⏱ ${s.castingTime}` : ''}
              ${s.range       ? ` · 🎯 ${s.range}` : ''}
              ${s.duration    ? ` · ⏳ ${s.duration}` : ''}
            </div>
            <div class="ab-spell-desc">${s.description}</div>
          </div>`;
        }).join('');
        return `<div class="ab-spell-group">
          <div class="ab-spell-level">${label}</div>
          <div class="ab-spells">${cards}</div>
        </div>`;
      }).join('');
      return `<div class="ab-class-block">
        <div class="ab-class-label">${capitalize(cls)} Spells</div>
        ${prepBannerFor(cls)}
        ${groups}
      </div>`;
    }).join('') || '<div class="cs-empty">No spells for this class/level</div>';

    ab.innerHTML = `
      <div class="ab-section">
        <div class="cs-section-title">Class Features</div>
        ${featuresHtml}
      </div>
      <div class="ab-section">
        <div class="cs-section-title">Spells</div>
        ${spellsHtml}
      </div>`;

    if (!prepClasses.length) return;

    // ── Wire up all prep toggle buttons ──
    ab.querySelectorAll('.ab-prep-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const cls  = btn.dataset.prepCls;
        const name = btn.dataset.spell;
        const pc   = prepClasses.find(p => p.className === cls);
        if (!pc) return;
        const set = localPrep[cls];
        if (set.has(name)) {
          set.delete(name);
          btn.classList.remove('prepped');
          btn.textContent = '⬜ Prepare';
          btn.closest('.ab-spell').classList.add('ab-spell-unprepared');
        } else {
          if (set.size >= pc.maxPrepared) {
            btn.classList.add('ab-prep-over');
            setTimeout(() => btn.classList.remove('ab-prep-over'), 600);
            return;
          }
          set.add(name);
          btn.classList.add('prepped');
          btn.textContent = '✅ Prepared';
          btn.closest('.ab-spell').classList.remove('ab-spell-unprepared');
        }
        // Update counter for this class
        ab.querySelectorAll(`.ab-prep-count[data-prep-cls="${cls}"]`)
          .forEach(el => { el.textContent = set.size; });
      });
    });

    // ── Wire up per-class Save buttons ──
    ab.querySelectorAll('.ab-prep-save-btn').forEach(saveBtn => {
      saveBtn.addEventListener('click', async () => {
        const cls = saveBtn.dataset.prepCls;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
          const r = await fetch(`/api/character/${charId}/prepare-spells`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ className: cls, spells: [...localPrep[cls]] }),
          });
          const result = await r.json();
          if (result.error) throw new Error(result.error);
          saveBtn.textContent = '✅ Saved!';
          setTimeout(() => { saveBtn.textContent = '💾 Save'; saveBtn.disabled = false; }, 2000);
        } catch (err) {
          saveBtn.textContent = '❌ ' + err.message;
          setTimeout(() => { saveBtn.textContent = '💾 Save'; saveBtn.disabled = false; }, 3000);
        }
      });
    });

  } catch (err) {
    $('charsheet-abilities').innerHTML = `<div class="cs-empty">Failed to load: ${err.message}</div>`;
  }
}

// ── Level Up ──────────────────────────────────────────────────────────────

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function buildClassLabel(c, mcEntries) {
  const mcSum = mcEntries.reduce((s, e) => s + e.level, 0);
  const mainLv = c.level - mcSum;
  let label = `${capitalize(c.class)}${c.subclass ? ` (${c.subclass})` : ''} ${mainLv}`;
  mcEntries.forEach(e => {
    label += ` / ${capitalize(e.class)}${e.subclass ? ` (${e.subclass})` : ''} ${e.level}`;
  });
  return label;
}

async function levelUp(charId, className) {
  try {
    const res = await fetch(`/api/character/${charId}/levelup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(className ? { className } : {}),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    showLevelUpPopup(data, charId);
    if (!data.needsSubclass) openCharSheet(charId);
  } catch (err) { alert(`Level up failed: ${err.message}`); }
}

function showLevelUpPopup(data, charId) {
  const { newLevel, hpGain, needsASI, needsSubclass, newFeatures, leveledClass,
          subclassOptions = [], subclassLabel = '' } = data;

  const featuresHtml = newFeatures && newFeatures.length
    ? `<div class="lu-features-hdr">New Features:</div>` +
      newFeatures.map(f =>
        `<div class="lu-feature">
          <span class="lu-feature-name">${f.name}</span>
          <span class="lu-feature-desc">${f.description}</span>
        </div>`
      ).join('')
    : '';

  // Subclass cards — only shown when needsSubclass is true
  const subclassHtml = (needsSubclass && subclassOptions.length)
    ? `<div class="sc-picker">
        <div class="sc-picker-title">✨ Choose Your ${subclassLabel}</div>
        <div class="sc-cards">
          ${subclassOptions.map(o =>
            `<button class="sc-card" data-id="${o.id}">
              <span class="sc-card-name">${o.name}</span>
              <span class="sc-card-desc">${o.description}</span>
            </button>`
          ).join('')}
        </div>
      </div>`
    : (needsASI
        ? '<div class="lu-notice">⬆️ Ability Score Improvement — choose +2 to one stat or +1/+1 to two</div>'
        : '');

  const popup = document.createElement('div');
  popup.className = 'levelup-popup';
  popup.innerHTML = `
    <div class="levelup-popup-inner">
      <div class="lu-sparkle">✨</div>
      <div class="lu-title">Level Up!</div>
      <div class="lu-subtitle">${capitalize(leveledClass ?? '')} · Level ${newLevel}</div>
      <div class="lu-stat-row">
        <span class="lu-stat">❤️ +${hpGain} HP</span>
        <span class="lu-stat">⭐ Lv ${newLevel}</span>
      </div>
      ${featuresHtml}
      ${subclassHtml}
      ${!needsSubclass ? `<button class="lu-ok-btn" onclick="this.closest('.levelup-popup').remove()">Continue ➜</button>` : ''}
    </div>`;
  document.body.appendChild(popup);

  // Wire up subclass card buttons
  popup.querySelectorAll('.sc-card').forEach(btn => {
    btn.addEventListener('click', async () => {
      const scId = btn.dataset.id;
      popup.querySelectorAll('.sc-card').forEach(b => b.disabled = true);
      try {
        const res  = await fetch(`/api/character/${charId}/subclass`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subclassId: scId }),
        });
        const result = await res.json();
        if (result.ok) {
          // Replace picker with confirmation
          const picker = popup.querySelector('.sc-picker');
          if (picker) {
            picker.innerHTML = `<div class="sc-confirmed">✅ ${result.subclassName} chosen!</div>`;
          }
          const inner = popup.querySelector('.levelup-popup-inner');
          const okBtn = document.createElement('button');
          okBtn.className = 'lu-ok-btn';
          okBtn.textContent = 'Continue ➜';
          okBtn.onclick = () => popup.remove();
          inner.appendChild(okBtn);
          openCharSheet(charId);
        }
      } catch { popup.querySelectorAll('.sc-card').forEach(b => b.disabled = false); }
    });
  });

  if (!needsSubclass) setTimeout(() => { if (popup.parentNode) popup.remove(); }, 12000);
}

// ── Campaign Manager Modal ────────────────────────────────────────────────

let adventuresList = [];

async function openCampaignManager() {
  await loadCampaigns();
  await loadAdventuresList();
  $('campaign-overlay').classList.add('active');
}

async function loadCampaigns() {
  const res  = await fetch('/api/campaigns');
  const data = await res.json();
  const list = $('campaigns-list');
  list.innerHTML = '';
  data.forEach(c => {
    const row = document.createElement('div');
    row.className = `camp-row${c.active ? ' active-camp' : ''}`;
    const activeBadge = c.active ? '<span class="active-badge">ACTIVE</span>' : '';
    const advLabel = c.adventure_id ? `📜 ${c.adventure_id}` : '— no adventure —';
    row.innerHTML = `
      <div class="camp-info">
        <span class="camp-name">${c.name} ${activeBadge}</span>
        <span class="camp-adv">${advLabel} · ${c.language === 'th' ? '🇹🇭' : '🇬🇧'}</span>
      </div>
      <div class="camp-actions">
        ${!c.active ? `<button class="camp-activate-btn" data-id="${c.id}">Set Active</button>` : ''}
        <select class="camp-adv-select" data-id="${c.id}">
          <option value="">Load adventure…</option>
        </select>
      </div>
    `;
    list.appendChild(row);
    // Populate adventure dropdown
    const sel = row.querySelector('.camp-adv-select');
    adventuresList.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.title || a.id;
      if (a.id === c.adventure_id) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', async () => {
      if (!sel.value) return;
      await fetch(`/api/campaign/${c.id}/adventure`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adventureId: sel.value }),
      });
      await loadCampaigns();
    });
    const activateBtn = row.querySelector('.camp-activate-btn');
    if (activateBtn) {
      activateBtn.addEventListener('click', async () => {
        await fetch(`/api/campaign/${c.id}/activate`, { method: 'POST' });
        await loadCampaigns();
        await fetchAndRefreshState();
      });
    }
  });
}

async function loadAdventuresList() {
  const res  = await fetch('/api/adventures');
  adventuresList = await res.json();
  const list = $('adventures-list');
  list.innerHTML = '';
  adventuresList.forEach(a => {
    const div = document.createElement('div');
    div.className = 'adv-row';
    div.innerHTML = `
      <div class="adv-title">📜 ${a.title || a.id}</div>
      <div class="adv-id">ID: ${a.id}</div>
      ${a.synopsis ? `<div class="adv-synopsis">${a.synopsis}</div>` : ''}
    `;
    list.appendChild(div);
  });
  if (adventuresList.length === 0) list.innerHTML = '<div class="cs-empty">No adventures found in /adventures folder</div>';
}

$('campaign-btn').addEventListener('click', openCampaignManager);
$('campaign-close').addEventListener('click', () => $('campaign-overlay').classList.remove('active'));
$('campaign-overlay').addEventListener('click', e => { if (e.target === $('campaign-overlay')) $('campaign-overlay').classList.remove('active'); });

document.querySelectorAll('.camp-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.camp-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).style.display = '';
  });
});

$('new-camp-btn').addEventListener('click', async () => {
  const name = $('new-camp-name').value.trim();
  if (!name) return;
  await fetch('/api/campaign', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description: $('new-camp-desc').value.trim(),
      language: $('new-camp-lang').value,
    }),
  });
  $('new-camp-name').value = '';
  $('new-camp-desc').value = '';
  await loadCampaigns();
});

$('chat-send-btn').addEventListener('click', sendToDM);
$('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToDM(); }
});

// ── Character Creation Wizard ─────────────────────────────────────────────

const CC_STEPS = ['info','race','class','stats','skills','personality','equipment','review'];
let cc = null;   // wizard state; null = closed

const STAT_LABELS = [
  { key:'strength',     abbr:'STR', icon:'💪' },
  { key:'dexterity',    abbr:'DEX', icon:'🏃' },
  { key:'constitution', abbr:'CON', icon:'❤️' },
  { key:'intelligence', abbr:'INT', icon:'🧠' },
  { key:'wisdom',       abbr:'WIS', icon:'👁️' },
  { key:'charisma',     abbr:'CHA', icon:'✨' },
];

async function openCharCreation() {
  if (!cc) {
    const res = await fetch('/api/game/options');
    const opts = await res.json();
    cc = {
      step: 0,
      name: '', playerName: '',
      race: '', raceOption: '',
      charClass: '',
      statMethod: 'standard',
      stats: { strength:10, dexterity:10, constitution:10, intelligence:10, wisdom:10, charisma:10 },
      statsAssigned: {},   // for standard array: { stat: value }
      background: 'Folk Hero',
      skills: [],
      personality: { traits:'', ideals:'', bonds:'', flaws:'', appearance:'', backstory:'' },
      equipChoices: [],    // index per group
      opts,
    };
  }
  $('create-char-overlay').classList.add('active');
  renderCC();
}

function closeCharCreation() {
  $('create-char-overlay').classList.remove('active');
  cc = null;
}

function renderCC() {
  // Update progress dots
  document.querySelectorAll('.cc-dot').forEach(d => {
    const s = parseInt(d.dataset.step);
    d.classList.toggle('active', s === cc.step);
    d.classList.toggle('done',   s < cc.step);
  });

  // Back / Next labels
  $('cc-back-btn').style.visibility = cc.step === 0 ? 'hidden' : 'visible';
  $('cc-next-btn').textContent = cc.step === CC_STEPS.length - 1 ? '✅ Create Character' : 'Next →';
  $('cc-error').textContent = '';

  // Render body
  const renderers = [
    renderCC_Info, renderCC_Race, renderCC_Class,
    renderCC_Stats, renderCC_Skills, renderCC_Personality, renderCC_Equipment, renderCC_Review,
  ];
  renderers[cc.step]();
}

// ── Step 0: Info ──────────────────────────────────────────────────────────
function renderCC_Info() {
  $('cc-body').innerHTML = `
    <div class="cc-step-content">
      <div class="cc-field-group">
        <label class="cc-label">Character Name</label>
        <input class="cc-input" id="cc-char-name" type="text" placeholder="Thorin Ironforge" value="${cc.name}" />
      </div>
      <div class="cc-field-group">
        <label class="cc-label">Player Name</label>
        <input class="cc-input" id="cc-player-name" type="text" placeholder="Your name" value="${cc.playerName}" />
      </div>
    </div>`;
}

function validateCC_Info() {
  cc.name = $('cc-char-name').value.trim();
  cc.playerName = $('cc-player-name').value.trim();
  if (!cc.name) return 'Character name is required.';
  if (!cc.playerName) return 'Player name is required.';
  return null;
}

// ── Step 1: Race ──────────────────────────────────────────────────────────
function renderCC_Race() {
  const cards = cc.opts.races.map(r => `
    <button class="cc-card${cc.race === r.id ? ' selected' : ''}" data-id="${r.id}">
      <div class="cc-card-title">${r.display}</div>
      <div class="cc-card-sub">${Object.entries(r.bonuses).map(([s,v])=>`+${v} ${s.slice(0,3).toUpperCase()}`).join(' · ')}</div>
      <div class="cc-card-desc">${r.traits.slice(0,2).join(' · ')}</div>
    </button>`).join('');

  // Sub-option picker (e.g. Dragonborn draconic ancestry)
  const raceOptGroup = cc.race ? (cc.opts.raceOptions?.[cc.race] ?? null) : null;
  const subPickerHtml = raceOptGroup ? `
    <div class="cc-sub-option-section">
      <div class="cc-section-label">🐉 ${raceOptGroup.label}</div>
      <div class="cc-sub-option-grid">
        ${raceOptGroup.choices.map(ch => `
          <button class="cc-sub-option-btn${cc.raceOption === ch.id ? ' selected' : ''}" data-opt="${ch.id}">
            <span class="cc-sub-opt-label">${ch.label}</span>
            <span class="cc-sub-opt-desc">${ch.desc}</span>
          </button>`).join('')}
      </div>
    </div>` : '';

  $('cc-body').innerHTML = `
    <div class="cc-step-content">
      <div class="cc-cards-grid">${cards}</div>
      ${subPickerHtml}
    </div>`;

  $('cc-body').querySelectorAll('.cc-card').forEach(btn => {
    btn.addEventListener('click', () => {
      if (cc.race !== btn.dataset.id) {
        cc.raceOption = '';   // reset sub-option when race changes
      }
      cc.race = btn.dataset.id;
      renderCC_Race();
    });
  });

  $('cc-body').querySelectorAll('.cc-sub-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cc.raceOption = btn.dataset.opt;
      renderCC_Race();
    });
  });
}

function validateCC_Race() {
  if (!cc.race) return 'Please select a race.';
  const raceOptGroup = cc.opts.raceOptions?.[cc.race] ?? null;
  if (raceOptGroup && !cc.raceOption) return `Please choose a ${raceOptGroup.label}.`;
  return null;
}

// ── Step 2: Class ─────────────────────────────────────────────────────────
function renderCC_Class() {
  const HIT_DIE_COLOR = { 6:'#8050c8', 8:'#4a70c8', 10:'#3a9a50', 12:'#c04040' };
  const cards = cc.opts.classes.map(cl => {
    const col = HIT_DIE_COLOR[cl.hitDie] ?? '#9090b8';
    return `
    <button class="cc-card${cc.charClass === cl.id ? ' selected' : ''}" data-id="${cl.id}">
      <div class="cc-card-title">${cl.name}
        <span class="cc-hit-die" style="color:${col}">d${cl.hitDie}</span>
      </div>
      <div class="cc-card-sub">${cl.level1Features.slice(0,2).join(' · ')}</div>
      ${cl.spellcaster ? `<div class="cc-spell-tag">✦ Spellcaster (${cl.spellcastingStat?.toUpperCase()})</div>` : ''}
    </button>`;
  }).join('');

  $('cc-body').innerHTML = `<div class="cc-step-content"><div class="cc-cards-grid">${cards}</div></div>`;
  $('cc-body').querySelectorAll('.cc-card').forEach(btn => {
    btn.addEventListener('click', () => {
      cc.charClass = btn.dataset.id;
      cc.equipChoices = [];  // reset equipment choices when class changes
      renderCC();
    });
  });
}

function validateCC_Class() {
  if (!cc.charClass) return 'Please select a class.';
  return null;
}

// ── Step 3: Stats ─────────────────────────────────────────────────────────
function renderCC_Stats() {
  const SA = [15,14,13,12,10,8];
  const assigned = cc.statsAssigned;
  const usedVals = Object.values(assigned);
  const available = SA.filter(v => !usedVals.includes(v) ||
    usedVals.filter(x => x === v).length < SA.filter(x => x === v).length);

  const race = cc.opts.races.find(r => r.id === cc.race);
  const bonuses = race?.bonuses ?? {};

  const rows = STAT_LABELS.map(sl => {
    const base = assigned[sl.key] ?? '—';
    const bon  = bonuses[sl.key] ?? 0;
    const total = (typeof base === 'number') ? base + bon : '—';
    const mod   = (typeof total === 'number') ? statMod(total) : '—';
    return `
      <div class="cc-stat-row" data-stat="${sl.key}">
        <span class="cc-stat-icon">${sl.icon}</span>
        <span class="cc-stat-name">${sl.abbr}</span>
        <span class="cc-stat-base">${base}</span>
        ${bon ? `<span class="cc-stat-bonus">+${bon}</span>` : '<span class="cc-stat-bonus"></span>'}
        <span class="cc-stat-total ${typeof total==='number'?'':'dim'}">${total}</span>
        <span class="cc-stat-mod ${typeof total==='number'?'':'dim'}">${mod}</span>
        ${typeof base === 'number'
          ? `<button class="cc-stat-clear" data-stat="${sl.key}">✕</button>`
          : ''}
      </div>`;
  }).join('');

  const valuePills = SA.map(v => {
    const alreadyUsed = usedVals.filter(x=>x===v).length >= SA.filter(x=>x===v).length;
    return `<button class="cc-val-pill${alreadyUsed?' used':''}${cc._pickedVal===v?' picked':''}" data-val="${v}">${v}</button>`;
  }).join('');

  $('cc-body').innerHTML = `
    <div class="cc-step-content">
      <div class="cc-stat-hint">Click a value, then click a stat to assign. Values: 15 14 13 12 10 8 (Standard Array)</div>
      <div class="cc-val-pills">${valuePills}</div>
      <div class="cc-stat-grid">${rows}</div>
      <button class="cc-roll-all-btn" id="cc-roll-btn">🎲 Roll Stats (4d6 drop lowest)</button>
    </div>`;

  // Value pill click
  $('cc-body').querySelectorAll('.cc-val-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('used')) return;
      cc._pickedVal = parseInt(btn.dataset.val);
      renderCC_Stats();
    });
  });

  // Stat row click
  $('cc-body').querySelectorAll('.cc-stat-row').forEach(row => {
    row.addEventListener('click', () => {
      if (cc._pickedVal == null) return;
      const stat = row.dataset.stat;
      const val  = cc._pickedVal;
      // Free existing assignment of this stat
      if (assigned[stat] != null) delete assigned[stat];
      assigned[stat] = val;
      cc._pickedVal = null;
      renderCC_Stats();
    });
  });

  // Clear button
  $('cc-body').querySelectorAll('.cc-stat-clear').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      delete cc.statsAssigned[btn.dataset.stat];
      cc._pickedVal = null;
      renderCC_Stats();
    });
  });

  // Roll button
  $('cc-roll-btn').addEventListener('click', () => {
    cc.statsAssigned = {};
    const roll4d6 = () => {
      const dice = Array.from({length:4}, () => Math.floor(Math.random()*6)+1);
      dice.sort((a,b)=>a-b);
      return dice.slice(1).reduce((s,x)=>s+x,0);
    };
    STAT_LABELS.forEach(sl => { cc.statsAssigned[sl.key] = roll4d6(); });
    cc._pickedVal = null;
    renderCC_Stats();
  });
}

function validateCC_Stats() {
  const allAssigned = STAT_LABELS.every(sl => cc.statsAssigned[sl.key] != null);
  if (!allAssigned) return 'Assign a value to every stat.';
  const race   = cc.opts.races.find(r => r.id === cc.race);
  const bonuses = race?.bonuses ?? {};
  STAT_LABELS.forEach(sl => {
    cc.stats[sl.key] = (cc.statsAssigned[sl.key] ?? 10) + (bonuses[sl.key] ?? 0);
  });
  return null;
}

// ── Step 4: Background & Skills ───────────────────────────────────────────
function renderCC_Skills() {
  const classSkills = cc.opts.classSkills[cc.charClass] ?? [];
  const bgSkills    = cc.opts.bgSkills[cc.background]  ?? [];
  const allProf     = [...new Set([...classSkills, ...bgSkills])];

  // Ensure all mandatory skills are in cc.skills
  allProf.forEach(s => { if (!cc.skills.includes(s)) cc.skills.push(s); });

  const bgCards = cc.opts.backgrounds.map(bg => `
    <button class="cc-card sm${cc.background === bg ? ' selected' : ''}" data-bg="${bg}">
      <div class="cc-card-title">${bg}</div>
      <div class="cc-card-sub">${(cc.opts.bgSkills[bg]??[]).join(' · ')}</div>
    </button>`).join('');

  const allSkills = cc.opts.skills.sort();
  const skillTags = allSkills.map(sk => {
    const fromClass = classSkills.includes(sk);
    const fromBg    = bgSkills.includes(sk);
    const fixed     = fromClass || fromBg;
    const checked   = cc.skills.includes(sk);
    const label     = fromClass ? '(class)' : fromBg ? '(background)' : '';
    return `
      <button class="cc-skill-tag${checked?' active':''}${fixed?' fixed':''}" data-skill="${sk}">
        ${sk} ${label ? `<em>${label}</em>` : ''}
      </button>`;
  }).join('');

  $('cc-body').innerHTML = `
    <div class="cc-step-content">
      <div class="cc-section-label">Background</div>
      <div class="cc-cards-grid sm">${bgCards}</div>
      <div class="cc-section-label" style="margin-top:16px">Skill Proficiencies <em class="cc-hint">Class &amp; background skills are automatic</em></div>
      <div class="cc-skill-wrap">${skillTags}</div>
    </div>`;

  // Background card click
  $('cc-body').querySelectorAll('[data-bg]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove old bg skills
      const oldBg = cc.opts.bgSkills[cc.background] ?? [];
      cc.skills = cc.skills.filter(s => !oldBg.includes(s) || classSkills.includes(s));
      cc.background = btn.dataset.bg;
      renderCC_Skills();
    });
  });

  // Skill tag click (only non-fixed)
  $('cc-body').querySelectorAll('.cc-skill-tag:not(.fixed)').forEach(btn => {
    btn.addEventListener('click', () => {
      const sk = btn.dataset.skill;
      if (cc.skills.includes(sk)) {
        cc.skills = cc.skills.filter(s => s !== sk);
      } else {
        cc.skills.push(sk);
      }
      renderCC_Skills();
    });
  });
}

function validateCC_Skills() {
  if (!cc.background) return 'Please select a background.';
  return null;
}

// ── Step 5: Personality ───────────────────────────────────────────────────

const PERSONALITY_FIELDS = [
  { key: 'traits',     label: '🎭 Personality Traits', placeholder: 'How does your character act? What quirks do they have?', rows: 3 },
  { key: 'ideals',     label: '⭐ Ideals',             placeholder: 'What principles guide your character\'s life?',           rows: 2 },
  { key: 'bonds',      label: '🔗 Bonds',              placeholder: 'Who or what is your character devoted to?',              rows: 2 },
  { key: 'flaws',      label: '💔 Flaws',              placeholder: 'What weakness, vice, or fear holds your character back?', rows: 2 },
  { key: 'appearance', label: '👤 Appearance',         placeholder: 'Brief physical description (height, hair, eyes, style…)', rows: 2 },
  { key: 'backstory',  label: '📖 Backstory',          placeholder: 'A sentence or two about your character\'s past.',         rows: 3 },
];

function renderCC_Personality() {
  const fieldsHtml = PERSONALITY_FIELDS.map(f => `
    <div class="cc-persona-field">
      <label class="cc-persona-label">${f.label}</label>
      <textarea class="cc-persona-input" data-key="${f.key}" rows="${f.rows}"
        placeholder="${f.placeholder}">${cc.personality[f.key] ?? ''}</textarea>
    </div>`).join('');

  $('cc-body').innerHTML = `
    <div class="cc-step-content">
      <div class="cc-persona-hint">All fields are optional — fill in as much or as little as you like.
        The DM will use this to narrate your character more authentically.</div>
      ${fieldsHtml}
    </div>`;

  $('cc-body').querySelectorAll('.cc-persona-input').forEach(ta => {
    ta.addEventListener('input', () => {
      cc.personality[ta.dataset.key] = ta.value.trim();
    });
  });
}

function validateCC_Personality() {
  // No required fields — always valid
  return null;
}

// ── Step 6: Equipment ─────────────────────────────────────────────────────
function renderCC_Equipment() {
  const groups = cc.opts.equipmentGroups[cc.charClass] ?? [];
  if (!groups.length) {
    $('cc-body').innerHTML = `<div class="cc-step-content"><div class="cc-empty">No equipment choices for this class.</div></div>`;
    return;
  }

  const groupsHtml = groups.map((grp, gi) => {
    const chosen = cc.equipChoices[gi] ?? 0;
    if (grp.fixed) {
      const items = grp.options[0].items.map(it => `
        <span class="eq-item-tag">${it.quantity > 1 ? it.quantity+'× ' : ''}${it.name}</span>`).join('');
      return `
        <div class="eq-group">
          <div class="eq-group-label">📦 ${grp.label} <span class="eq-fixed-badge">Fixed</span></div>
          <div class="eq-fixed-items">${items}</div>
        </div>`;
    }
    const optCards = grp.options.map((opt, oi) => {
      const active = chosen === oi;
      const itemList = opt.items.map(it =>
        `<span class="eq-item-tag">${it.quantity > 1 ? it.quantity+'× ' : ''}${it.name}</span>`
      ).join('');
      return `
        <button class="eq-option${active?' selected':''}" data-gi="${gi}" data-oi="${oi}">
          <div class="eq-option-label">${opt.label}</div>
          <div class="eq-option-items">${itemList}</div>
        </button>`;
    }).join('');
    return `
      <div class="eq-group">
        <div class="eq-group-label">⚔️ ${grp.label}</div>
        <div class="eq-options">${optCards}</div>
      </div>`;
  }).join('');

  $('cc-body').innerHTML = `<div class="cc-step-content">${groupsHtml}</div>`;

  $('cc-body').querySelectorAll('.eq-option').forEach(btn => {
    btn.addEventListener('click', () => {
      cc.equipChoices[parseInt(btn.dataset.gi)] = parseInt(btn.dataset.oi);
      renderCC_Equipment();
    });
  });
}

function validateCC_Equipment() {
  const groups = cc.opts.equipmentGroups[cc.charClass] ?? [];
  for (let gi = 0; gi < groups.length; gi++) {
    if (!groups[gi].fixed && cc.equipChoices[gi] == null) {
      cc.equipChoices[gi] = 0;   // auto-select first option
    }
  }
  return null;
}

// ── Step 6: Review ────────────────────────────────────────────────────────
function renderCC_Review() {
  const race  = cc.opts.races.find(r => r.id === cc.race);
  const cls   = cc.opts.classes.find(c => c.id === cc.charClass);
  const groups = cc.opts.equipmentGroups[cc.charClass] ?? [];

  const statsHtml = STAT_LABELS.map(sl => {
    const v = cc.stats[sl.key] ?? 10;
    return `<div class="rv-stat"><span>${sl.abbr}</span><strong>${v}</strong><em>${statMod(v)}</em></div>`;
  }).join('');

  const equipHtml = groups.map((grp, gi) => {
    const optIdx = cc.equipChoices[gi] ?? 0;
    const opt    = grp.options[Math.min(optIdx, grp.options.length-1)];
    const items  = opt.items.map(it => `${it.quantity > 1 ? it.quantity+'× ' : ''}${it.name}`).join(', ');
    return `<div class="rv-equip-row"><span class="rv-equip-label">${grp.label}</span><span>${items}</span></div>`;
  }).join('');

  const personaRows = PERSONALITY_FIELDS
    .filter(f => cc.personality[f.key])
    .map(f => `<div class="rv-persona-row"><span class="rv-persona-label">${f.label}</span><span>${cc.personality[f.key]}</span></div>`)
    .join('');

  $('cc-body').innerHTML = `
    <div class="cc-step-content rv-summary">
      <div class="rv-hero">
        <div class="rv-name">${cc.name}</div>
        <div class="rv-sub">${race?.display ?? cc.race}${cc.raceOption ? ` (${cc.raceOption})` : ''} · ${cls?.name ?? cc.charClass} · Lv 1</div>
        <div class="rv-sub">Player: ${cc.playerName}</div>
      </div>
      <div class="rv-section">
        <div class="rv-label">Ability Scores</div>
        <div class="rv-stats">${statsHtml}</div>
      </div>
      <div class="rv-section">
        <div class="rv-label">Background &amp; Skills</div>
        <div class="rv-text">${cc.background} · ${cc.skills.join(', ')}</div>
      </div>
      ${personaRows ? `<div class="rv-section"><div class="rv-label">Personality</div>${personaRows}</div>` : ''}
      <div class="rv-section">
        <div class="rv-label">Equipment</div>
        ${equipHtml}
      </div>
    </div>`;
}

// ── Navigation ────────────────────────────────────────────────────────────
const CC_VALIDATORS = [
  validateCC_Info, validateCC_Race, validateCC_Class,
  validateCC_Stats, validateCC_Skills, validateCC_Personality, validateCC_Equipment, () => null,
];

async function ccNext() {
  const err = CC_VALIDATORS[cc.step]?.();
  if (err) { $('cc-error').textContent = '⚠ ' + err; return; }

  if (cc.step === CC_STEPS.length - 1) {
    await submitCharacter();
    return;
  }
  cc.step++;
  renderCC();
}

function ccBack() {
  if (cc.step > 0) { cc.step--; renderCC(); }
}

async function submitCharacter() {
  $('cc-next-btn').disabled = true;
  $('cc-next-btn').textContent = 'Creating...';
  try {
    const res = await fetch('/api/characters', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cc.name,
        playerName: cc.playerName,
        charClass: cc.charClass,
        race: cc.race,
        raceOption: cc.raceOption || undefined,
        background: cc.background,
        stats: cc.stats,
        skills: cc.skills,
        personality: cc.personality,
        equipChoices: cc.equipChoices,
      }),
    });
    const data = await res.json();
    if (data.error) { $('cc-error').textContent = '❌ ' + data.error; $('cc-next-btn').disabled = false; $('cc-next-btn').textContent = '✅ Create Character'; return; }
    closeCharCreation();
    addLog('info', `✨ New character <strong>${data.name}</strong> created (HP ${data.hp}, AC ${data.ac})`);
  } catch (err) {
    $('cc-error').textContent = '❌ ' + err.message;
    $('cc-next-btn').disabled = false;
    $('cc-next-btn').textContent = '✅ Create Character';
  }
}

$('new-char-btn').addEventListener('click', openCharCreation);
$('create-char-close').addEventListener('click', closeCharCreation);
$('create-char-overlay').addEventListener('click', e => { if (e.target === $('create-char-overlay')) closeCharCreation(); });
$('cc-next-btn').addEventListener('click', ccNext);
$('cc-back-btn').addEventListener('click', ccBack);

// ── Resize Handles ────────────────────────────────────────────────────────

function initResizeHandles() {
  const root = document.documentElement;

  // Restore saved sizes
  const savedLeft  = localStorage.getItem('rh-left-w');
  const savedRight = localStorage.getItem('rh-right-w');
  const savedMapH  = localStorage.getItem('rh-map-h');
  const savedLogH  = localStorage.getItem('rh-log-h');
  if (savedLeft)  root.style.setProperty('--left-w',  savedLeft  + 'px');
  if (savedRight) root.style.setProperty('--right-w', savedRight + 'px');
  if (savedMapH)  { const v = $('map-viewport'); if (v) v.style.height = savedMapH + 'px'; }
  if (savedLogH)  { const l = $('log-section');  if (l) { l.style.flex = 'none'; l.style.maxHeight = savedLogH + 'px'; l.style.height = savedLogH + 'px'; } }

  // ── Left panel width ──
  makeDragH($('rh-left'), {
    getStart: () => parseInt(getComputedStyle(root).getPropertyValue('--left-w')) || 230,
    apply:    v  => root.style.setProperty('--left-w', v + 'px'),
    save:     v  => localStorage.setItem('rh-left-w', v),
    min: 120, max: 500, dir: 1,
  });

  // ── Right panel width ──
  makeDragH($('rh-right'), {
    getStart: () => parseInt(getComputedStyle(root).getPropertyValue('--right-w')) || 260,
    apply:    v  => root.style.setProperty('--right-w', v + 'px'),
    save:     v  => localStorage.setItem('rh-right-w', v),
    min: 140, max: 520, dir: -1,
  });

  // ── Map height ──
  makeDragV($('rh-map'), {
    getStart: () => $('map-viewport').getBoundingClientRect().height,
    apply:    v  => {
      const vp = $('map-viewport');
      vp.style.height = v + 'px';
      // Exit "expanded" mode if user is manually resizing
      const ms = $('map-section');
      if (ms.classList.contains('expanded')) {
        ms.classList.remove('expanded');
        const btn = $('map-expand-btn');
        if (btn) { btn.textContent = '⤢'; btn.title = 'Expand map'; btn.classList.remove('expanded'); }
      }
    },
    save:     v  => localStorage.setItem('rh-map-h', v),
    min: 80, max: 700,
  });

  // ── Log section height ──
  makeDragV($('rh-log'), {
    getStart: () => $('log-section').getBoundingClientRect().height,
    apply:    v  => {
      const l = $('log-section');
      l.style.flex = 'none';
      l.style.height = v + 'px';
      l.style.maxHeight = v + 'px';
    },
    save:     v  => localStorage.setItem('rh-log-h', v),
    min: 60, max: 700,
  });
}

function makeDragH(el, { getStart, apply, save, min, max, dir }) {
  if (!el) return;
  el.addEventListener('mousedown', e => {
    e.preventDefault();
    el.classList.add('rh-active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const startX = e.clientX;
    const startV = getStart();
    let lastX = startX;

    function onMove(e) {
      lastX = e.clientX;
      apply(Math.max(min, Math.min(max, startV + (lastX - startX) * dir)));
    }
    function onUp() {
      el.classList.remove('rh-active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      save(Math.max(min, Math.min(max, startV + (lastX - startX) * dir)));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function makeDragV(el, { getStart, apply, save, min, max }) {
  if (!el) return;
  el.addEventListener('mousedown', e => {
    e.preventDefault();
    el.classList.add('rh-active');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const startY = e.clientY;
    const startV = getStart();
    let lastY = startY;

    function onMove(e) {
      lastY = e.clientY;
      apply(Math.max(min, Math.min(max, startV + (lastY - startY))));
    }
    function onUp() {
      el.classList.remove('rh-active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      save(Math.max(min, Math.min(max, startV + (lastY - startY))));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

// ── Start ─────────────────────────────────────────────────────────────────
initMapControls();
initResizeHandles();
init();
