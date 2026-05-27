// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let tg = null;
let config = {};
let listings = [];
let currentModalId = null;
let map = null;
let markers = [];

// === НАСТРОЙКИ ===
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxiuUMeslxZOUBC2Y4sg2QqJe_Iy5u8qA3WE7j3sWfuvWmzXz8P807FK9m7Q5YFiWs2/exec';
const SECRET_KEY = 'SecretParol999';
const PROJECT_ID = 'novozhilov';

// === TELEGRAM ===
try {
  if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
  }
} catch (e) {
  console.log('TG Error', e);
}

if (!tg) {
  tg = {
    ready: function() {},
    expand: function() {},
    MainButton: { setText: function() {}, show: function() {}, hide: function() {} },
    showAlert: function(msg) { alert(msg); },
    openLink: function(url) { window.open(url, '_blank'); },
    close: function() {}
  };
}

// === НАВИГАЦИЯ ===
function showBack() {
  const btn = document.getElementById('customBackBtn');
  if (btn) btn.classList.remove('hidden');
}

function hideBack() {
  const btn = document.getElementById('customBackBtn');
  if (btn) btn.classList.add('hidden');
}

// УМНАЯ КНОПКА НАЗАД: закрывает модалки, карту или закрывает приложение
function appBack() {
  const consult = document.getElementById('consultModal');
  const details = document.getElementById('detailsModal');  const mapCont = document.getElementById('mapContainer');

  if (consult && !consult.classList.contains('hidden')) {
    closeConsultModal();
    return;
  }
  if (details && !details.classList.contains('hidden')) {
    closeModal();
    return;
  }
  if (mapCont && !mapCont.classList.contains('hidden')) {
    switchView('list'); // Возврат с карты на список
    return;
  }
  if (tg && tg.close) {
    tg.close();
  }
}

function startApp() {
  const welcome = document.getElementById('welcomeScreen');
  const main = document.getElementById('mainContent');

  if (welcome) welcome.classList.add('hidden');
  if (main) main.classList.remove('hidden');

  window.scrollTo(0, 0);
  hideBack();
}

function toggleFilters() {
  const block = document.getElementById('filtersBlock');
  const btn = document.querySelector('.filters-toggle-btn');
  if (block && btn) {
    block.classList.toggle('hidden');
    btn.textContent = block.classList.contains('hidden') ? '🔽 Фильтры' : '🔼 Скрыть фильтры';
  }
}

function switchView(view) {
  const listBtn = document.getElementById('listViewBtn');
  const mapBtn = document.getElementById('mapViewBtn');
  const listCont = document.getElementById('listingsContainer');
  const mapCont = document.getElementById('mapContainer');

  if (view === 'list') {
    if (listBtn) listBtn.classList.add('active');
    if (mapBtn) mapBtn.classList.remove('active');
    if (listCont) listCont.classList.remove('hidden');
    if (mapCont) mapCont.classList.add('hidden');    hideBack();
  } else {
    if (listBtn) listBtn.classList.remove('active');
    if (mapBtn) mapBtn.classList.add('active');
    if (listCont) listCont.classList.add('hidden');
    if (mapCont) mapCont.classList.remove('hidden');
    showBack();
    initMap();
    const filtered = getFilteredItems();
    updateMarkers(filtered);
    setTimeout(function() { map.invalidateSize(); }, 150);
  }
}

function getFilteredItems() {
  const activeBtn = document.querySelector('.price-btn.active');
  const maxPrice = activeBtn ? parseFloat(activeBtn.dataset.price) : Infinity;

  const getChecked = function(id) {
    return Array.from(document.querySelectorAll('#' + id + ' input:checked')).map(function(cb) { return cb.value; });
  };
  const districts = getChecked('districtCheckboxes');
  const metros = getChecked('metroCheckboxes');
  const rooms = getChecked('roomsCheckboxes');

  return listings.filter(function(item) {
    if (typeof item.price_from !== 'number' || item.price_from > maxPrice) return false;
    if (districts.length && !districts.includes(item.district)) return false;
    if (metros.length && !metros.includes(item.metro)) return false;
    if (rooms.length && item.rooms) {
      const itemRooms = String(item.rooms).split(',').map(function(r) { return r.trim(); });
      if (!rooms.some(function(r) { return itemRooms.includes(r); })) return false;
    }
    return true;
  });
}

async function init() {
  const loader = document.getElementById('loadingScreen');
  const welcome = document.getElementById('welcomeScreen');
  const main = document.getElementById('mainContent');

  try {
    const res = await fetch('config.json?v=' + Date.now());
    if (!res.ok) throw new Error('Config error');
    config = await res.json();
  
    if (config.data && config.data.sheetUrl) {
      listings = await loadFromGoogleSheets(config.data.sheetUrl);
      console.log('Objects:', listings.length);    }
  
    applyTheme();
    applyBranding();
    initFilters();
    initPhoneMask();
    initTelegramMask();
  
    if (loader) loader.classList.add('hidden');
    if (welcome) welcome.classList.remove('hidden');
    if (main) main.classList.add('hidden');
  
    renderListings(listings);
  
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.onclick = startApp;
    }
  
  } catch (err) {
    console.error(err);
    if (loader) loader.classList.add('hidden');
    if (welcome) welcome.classList.remove('hidden');
    if (main) main.classList.add('hidden');
  }
}

function applyTheme() {
  if (!config.brand) return;
  if (config.brand.primaryColor) document.documentElement.style.setProperty('--primary', config.brand.primaryColor);
  if (config.brand.accentColor) document.documentElement.style.setProperty('--accent', config.brand.accentColor);
}

function applyBranding() {
  if (!config.brand) return;
  const img = document.getElementById('welcomeImage');
  if (config.brand.welcomeImage && img) {
    img.src = config.brand.welcomeImage + '?v=' + Date.now();
    img.classList.remove('hidden');
  }
}

function initFilters() {
  const priceCont = document.getElementById('priceButtons');
  if (priceCont) {
    [5, 10, 20, 50, 100].forEach(function(price) {
      const btn = document.createElement('button');
      btn.className = 'price-btn';
      btn.dataset.price = price;
      btn.textContent = 'До ' + price + ' млн';      btn.onclick = function() {
        if (this.classList.contains('active')) {
           this.classList.remove('active');
        } else {
           document.querySelectorAll('.price-btn').forEach(function(b) { b.classList.remove('active'); });
           this.classList.add('active');
        }
        filterListings();
      };
      priceCont.appendChild(btn);
    });
  }

  if (listings.length) {
    fillCheckboxes('districtCheckboxes', 'district');
    fillCheckboxes('metroCheckboxes', 'metro');
    fillCheckboxes('roomsCheckboxes', 'rooms', true);
  }
}

function fillCheckboxes(id, field, isMulti) {
  const cont = document.getElementById(id);
  if (!cont) return;

  const values = [];
  listings.forEach(function(l) {
    if (isMulti && l[field]) {
      String(l[field]).split(',').forEach(function(x) {
        const trimmed = x.trim();
        if (trimmed && !values.includes(trimmed)) values.push(trimmed);
      });
    } else if (l[field] && !values.includes(l[field])) {
      values.push(l[field]);
    }
  });
  values.sort();

  cont.innerHTML = '';
  values.forEach(function(v) {
    const lbl = document.createElement('label');
    lbl.className = 'checkbox-label';
    lbl.innerHTML = '<input type="checkbox" value="' + escapeHtml(v) + '" data-filter="' + field + '"><span>' + escapeHtml(v) + '</span>';
    cont.appendChild(lbl);
  });

  cont.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
    cb.addEventListener('change', filterListings);
  });
}
function filterListings() {
  const filtered = getFilteredItems();
  renderListings(filtered);

  const mapCont = document.getElementById('mapContainer');
  if (mapCont && !mapCont.classList.contains('hidden')) {
    updateMarkers(filtered);
  }
}

async function loadFromGoogleSheets(url) {
  let csvUrl = url.trim();
  csvUrl = csvUrl.replace('/pubhtml', '/pub').replace('/edit', '/pub');
  if (csvUrl.indexOf('output=csv') === -1) {
    csvUrl += (csvUrl.indexOf('?') !== -1 ? '&' : '?') + 'output=csv';
  }
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error('Sheet Error');
  return parseCSV(await res.text());
}

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map(function(h) { return h.trim(); });
  return lines.slice(1).filter(function(l) { return l.trim(); }).map(function(line) {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach(function(h, i) {
      let v = vals[i] !== undefined ? vals[i].trim() : '';
      if (v === 'TRUE') v = true;
      else if (v === 'FALSE') v = false;
      else if (!isNaN(v) && v !== '') v = Number(v);
      obj[h] = v;
    });
    return obj;
  });
}

function parseLine(line) {
  const res = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { res.push(cur); cur = ''; }
    else cur += c;
  }
  res.push(cur);  return res;
}

function renderListings(data) {
  const cont = document.getElementById('listingsContainer');
  if (!cont) return;
  cont.innerHTML = '';

  if (!data || data.length === 0) {
    cont.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
    return;
  }

  data.forEach(function(item, i) {
    let price = '?';
    if (typeof item.price_from === 'number') {
      price = item.price_from < 1000 ? item.price_from.toFixed(1) : (item.price_from / 1000000).toFixed(1);
    }
    const ppsqm = typeof item.price_per_sqm === 'number' ? Math.round(item.price_per_sqm).toLocaleString('ru-RU') : '';
    const area = (typeof item.area_min === 'number' && typeof item.area_max === 'number') ? item.area_min + '–' + item.area_max + ' м²' : '';
    const statusKey = (item.status || 'other').toString().replace(/\s+/g, '-');
    const statusTxt = item.status === 'Сдан' ? '✅ Сдан' : item.status === 'Строится' ? ' 🏗 Строится' : '🟡 Частично сдан';
  
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.style.animationDelay = (i * 0.05) + 's';
    card.onclick = function(e) {
      if (!e.target.closest('.consult-btn-inline')) openDetails(item.id);
    };
  
    let html = '<img src="' + (item.image_main || '') + '" class="listing-image" onerror="this.style.display=\'none\'">';
    html += '<div class="listing-info">';
    html += '<h3>' + (item.name || 'Без названия') + '</h3>';
    html += '<div class="listing-meta">';
    if (item.district) html += '<span>' + item.district + '</span>';
    if (item.metro) html += '<span>🚇 ' + item.metro + '</span>';
    if (item.rooms) html += '<span> 🚪 ' + item.rooms + '</span>';
    if (area) html += '<span> 📏 ' + area + '</span>';
    html += '</div>';
    html += '<div class="listing-price">от ' + price + ' млн ₽';
    if (ppsqm) html += ' <span class="price-per-sqm">~' + ppsqm + ' ₽/м²</span>';
    html += '</div>';
    html += '<div class="listing-status status-' + statusKey + '">' + statusTxt + '</div>';
    html += '<button class="tg-btn consult-btn-inline" onclick="openConsultForm(\'' + item.id + '\', event)">📍 Получить консультацию</button>';
    html += '</div>';
  
    card.innerHTML = html;
    cont.appendChild(card);
  });
}
function initMap() {
  if (typeof L === 'undefined') return;
  const cont = document.getElementById('mapContainer');
  if (!cont) return;
  if (!map) {
    map = L.map('mapContainer').setView([59.9343, 30.3351], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
  }
}

function updateMarkers(items) {
  if (!map) return;
  markers.forEach(function(m) { map.removeLayer(m); });
  markers = [];
  items.forEach(function(item) {
    if (!item.lat || !item.lng) return;
    let p = '?';
    if (typeof item.price_from === 'number') {
      p = item.price_from < 1000 ? item.price_from.toFixed(1) : (item.price_from / 1000000).toFixed(1);
    }
    const m = L.marker([item.lat, item.lng]).addTo(map).bindPopup('<b>' + item.name + '</b><br>от ' + p + ' млн ₽');
    markers.push(m);
  });
  if (markers.length) map.fitBounds(new L.featureGroup(markers).getBounds().pad(0.1));
}

function openDetails(id) {
  const item = listings.find(function(l) { return l.id === id; });
  if (!item) return;
  currentModalId = id;

  document.getElementById('modalTitle').textContent = item.name || '';

  let price = '?';
  if (typeof item.price_from === 'number') {
    price = item.price_from < 1000 ? item.price_from.toFixed(1) : (item.price_from / 1000000).toFixed(1);
  }
  const ppsqm = typeof item.price_per_sqm === 'number' ? Math.round(item.price_per_sqm).toLocaleString('ru-RU') : '';

  document.getElementById('modalPrice').innerHTML = 'от <b>' + price + '</b> млн ₽' + (ppsqm ? ' <span class="price-per-sqm">~' + ppsqm + ' ₽/м²</span>' : '');

  document.getElementById('modalMeta').innerHTML =
    '<div class="meta-row"><span>📍 ' + (item.address || '') + '</span></div>' +
    '<div class="meta-row"><span>🚇 ' + (item.metro || '') + '</span></div>' +
    (item.class ? '<div class="meta-row"><span>🌟 Класс: ' + item.class + '</span></div>' : '') +
    (item.finishing ? '<div class="meta-row"><span>🔨 Отделка: ' + item.finishing + '</span></div>' : '') +
    '<div class="meta-row"><span>' + (item.completion_soonest || item.completion_all || '') + '</span></div>';

  document.getElementById('modalDescription').textContent = item.description || 'Описание отсутствует';
  const featuresEl = document.getElementById('modalFeatures');
  if (item.features) {
    featuresEl.innerHTML = '<ul>' + item.features.split(',').map(function(f) { return '<li>' + f.trim() + '</li>'; }).join('') + '</ul>';
  } else {
    featuresEl.innerHTML = '<p style="color:var(--text-secondary)">Информация уточняется</p>';
  }

  const plansEl = document.getElementById('modalFloorPlans');
  plansEl.innerHTML = '';
  if (item.floor_plans_text) {
    const t = document.createElement('div');
    t.className = 'floor-plans-text';
    t.textContent = item.floor_plans_text;
    plansEl.appendChild(t);
  }
  if (item.floor_plans_images) {
    const g = document.createElement('div');
    g.className = 'floor-plans-gallery';
    item.floor_plans_images.split(',').map(function(u) { return u.trim(); }).filter(Boolean).forEach(function(url) {
      const img = document.createElement('img');
      img.src = url;
      img.className = 'floor-plan-image';
      img.onclick = function() { window.open(url, '_blank'); };
      g.appendChild(img);
    });
    plansEl.appendChild(g);
  }
  if (!item.floor_plans_text && !item.floor_plans_images) {
    plansEl.innerHTML = '<p style="color:var(--text-secondary)">Информация уточняется</p>';
  }

  const gallery = document.getElementById('modalGallery');
  gallery.innerHTML = '';
  if (item.image_main) {
    const img = document.createElement('img');
    img.src = item.image_main;
    img.className = 'modal-main-image';
    gallery.appendChild(img);
  }
  if (item.images_gallery) {
    item.images_gallery.split(',').map(function(u) { return u.trim(); }).filter(Boolean).forEach(function(url) {
      const img = document.createElement('img');
      img.src = url;
      img.className = 'modal-thumb';
      img.onclick = function() { window.open(url, '_blank'); };
      gallery.appendChild(img);
    });
  }
    // === ИСПРАВЛЕННАЯ КНОПКА КОНСУЛЬТАЦИИ ===
  setTimeout(function() {
    const btn = document.getElementById('modalConsultBtn');
    if (btn) {
      // Удаляем все старые обработчики
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
     
      // Добавляем новый обработчик
      newBtn.addEventListener('click', function() {
        openConsultForm(currentModalId);
      });
    }
  }, 100);

  document.getElementById('detailsModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  showBack();
}

function closeModal() {
  document.getElementById('detailsModal').classList.add('hidden');
  document.body.style.overflow = '';
  currentModalId = null;
  const mapCont = document.getElementById('mapContainer');
  if (mapCont && mapCont.classList.contains('hidden')) hideBack();
}

function openConsultForm(id, e) {
  if (e) e.stopPropagation();
  currentModalId = id;
  const item = listings.find(function(l) { return l.id === id; });
  if (!item) return;
  document.getElementById('consultObjectName').textContent = '🏢 ' + item.name;
  document.getElementById('consultName').value = '';
  document.getElementById('consultPhone').value = '+7 (';
  document.getElementById('consultTelegram').value = '';
  document.getElementById('consultModal').classList.remove('hidden');
  showBack();
}

function closeConsultModal() {
  document.getElementById('consultModal').classList.add('hidden');
  const form = document.getElementById('consultForm');
  if (form) form.reset();
  const details = document.getElementById('detailsModal');
  const mapCont = document.getElementById('mapContainer');
  if (details && details.classList.contains('hidden') && mapCont && mapCont.classList.contains('hidden')) {
    hideBack();
  }}

function initPhoneMask() {
  const inp = document.getElementById('consultPhone');
  if (!inp) return;
  inp.addEventListener('input', function(e) {
    let x = e.target.value.replace(/\D/g, '').match(/(\d{0,1})(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
    if (!x) return;
    e.target.value = !x[2] ? '+7 (' : '+7 (' + x[2] + (x[3] ? ') ' + x[3] : '') + (x[4] ? '-' + x[4] : '') + (x[5] ? '-' + x[5] : '');
  });
  inp.addEventListener('focus', function(e) {
    if (e.target.value === '' || e.target.value === '+7 ') {
      e.target.value = '+7 (';
    }
  });
}

function initTelegramMask() {
  const inp = document.getElementById('consultTelegram');
  if (!inp) return;

  inp.addEventListener('input', function(e) {
    let val = e.target.value;
    val = val.replace(/[^a-zA-Z0-9_]/g, '');
    if (val && val.charAt(0) !== '@') {
      val = '@' + val;
    }
    e.target.value = val;
  });

  inp.addEventListener('blur', function(e) {
    if (e.target.value && e.target.value.charAt(0) !== '@') {
      e.target.value = '@' + e.target.value;
    }
  });
}

function submitConsultForm(e) {
  e.preventDefault();

  const item = listings.find(function(l) { return l.id === currentModalId; });
  if (!item) return;

  const name = document.getElementById('consultName').value.trim();
  const phone = document.getElementById('consultPhone').value.trim();
  const telegram = document.getElementById('consultTelegram').value.trim();

  if (name.length < 2) {
    if (tg && tg.showAlert) tg.showAlert('❌ Введите имя (мин. 2 символа)');
    return;  }
  if (phone.replace(/\D/g, '').length < 10) {
    if (tg && tg.showAlert) tg.showAlert('❌ Введите корректный номер телефона');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const orig = btn.textContent;
  btn.textContent = 'Отправка...';
  btn.disabled = true;

  // === ФОРМАТ КАК В SPB_NEWBUILDS (только объект, имя, телефон, телеграм) ===
  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({
      secret: SECRET_KEY,
      projectId: PROJECT_ID,
      title: item.name,
      // Поля price и city НЕ отправляем, чтобы скрипт не показывал их в сообщении
      leadName: name,
      leadPhone: phone,
      leadTelegram: telegram || 'Не указан'
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.success) {
      closeConsultModal();
      if (tg && tg.showAlert) tg.showAlert('✅ Заявка отправлена!');
      e.target.reset();
    } else {
      throw new Error(d.error || 'Ошибка отправки');
    }
  })
  .catch(function(err) {
    console.error('Send error:', err);
    if (tg && tg.showAlert) tg.showAlert('⚠️ ' + err.message);
  })
  .finally(function() {
    btn.textContent = orig;
    btn.disabled = false;
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}
// === ЗАПУСК ПРИ ЗАГРУЗКЕ ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
