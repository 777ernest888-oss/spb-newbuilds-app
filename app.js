// 🛡 ИНИЦИАЛИЗАЦИЯ
let tg;
try {
  if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
  } else {
    tg = {
      ready: () => {}, expand: () => {},
      MainButton: { setText: () => {}, show: () => {}, onClick: () => {}, hide: () => {} },
      showAlert: (msg) => alert(msg), sendData: (data) => console.log('sendData:', data), close: () => {}
    };
  }
} catch (e) { console.error('TG Init Error:', e); }

let config = {};
let listings = [];
let currentModalId = null;

//  INIT
async function init() {
  try {
    const configRes = await fetch('config.json');
    config = await configRes.json();
   
    if (config.data?.source === 'google_sheets' && config.data?.sheetUrl) {
      listings = await loadFromGoogleSheets(config.data.sheetUrl);
    }
   
    applyTheme();
    renderWelcome();
    renderFilters();
    renderListings(listings.filter(l => l.active));
   
    tg.MainButton.setText(config.texts?.ctaButton || 'Отправить заявку');
    tg.MainButton.hide();
   
  } catch (error) {
    console.error('Init Error:', error);
  }
}

// 📥 GOOGLE SHEETS LOADER
async function loadFromGoogleSheets(url) {
  let csvUrl = url.replace('pubhtml', 'pub') + (url.includes('output=csv') ? '' : '&output=csv');
  const response = await fetch(csvUrl);
  const csvText = await response.text();
  return parseCSV(csvText);
}
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((header, index) => {
      let value = values[index] !== undefined ? values[index].trim() : '';
      if (value === 'TRUE') value = true;
      else if (value === 'FALSE') value = false;
      else if (!isNaN(value) && value !== '') value = Number(value);
      obj[header] = value;
    });
    result.push(obj);
  }
  return result;
}

function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += char;
  }
  result.push(current);
  return result;
}

// 🎨 THEME & WELCOME
function applyTheme() {
  if (!config.brand) return;
  document.documentElement.style.setProperty('--primary', config.brand.primaryColor || '#1a365d');
  document.documentElement.style.setProperty('--accent', config.brand.accentColor || '#d4af37');
  const img = document.getElementById('welcomeImage');
  if (img && config.brand.welcomeImage) img.src = config.brand.welcomeImage;
}

function renderWelcome() {
  if (!config.features?.showWelcomeScreen) return;
  document.getElementById('welcomeTitle').textContent = config.brand.welcomeTitle || '';
  document.getElementById('welcomeSubtitle').textContent = config.brand.welcomeSubtitle || '';
  document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');  });
}

// ✅ FILTERS
function renderFilters() {
  const districts = [...new Set(listings.map(l => l.district).filter(Boolean))].sort();
  const districtContainer = document.getElementById('districtCheckboxes');
  districtContainer.innerHTML = '';
  districts.forEach(d => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.innerHTML = `<input type="checkbox" value="${d}" class="filter-checkbox" data-filter="district"> ${d}`;
    districtContainer.appendChild(label);
  });

  const metros = [...new Set(listings.map(l => l.metro).filter(Boolean))].sort();
  const metroContainer = document.getElementById('metroCheckboxes');
  metroContainer.innerHTML = '';
  metros.forEach(m => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.innerHTML = `<input type="checkbox" value="${m}" class="filter-checkbox" data-filter="metro"> ${m}`;
    metroContainer.appendChild(label);
  });

  const priceFilter = document.getElementById('priceFilter');
  const priceValue = document.getElementById('priceValue');
  if (priceFilter) {
    priceFilter.max = config.filters?.defaults?.maxPrice || 500;
    priceFilter.value = priceFilter.max;
    priceValue.textContent = priceFilter.value;
    priceFilter.addEventListener('input', (e) => {
      priceValue.textContent = e.target.value;
      filterListings();
    });
  }

  document.querySelectorAll('.filter-checkbox').forEach(cb => {
    cb.addEventListener('change', filterListings);
  });
}

function filterListings() {
  const maxPrice = parseFloat(document.getElementById('priceFilter')?.value || 500);
  const selectedDistricts = Array.from(document.querySelectorAll('input[data-filter="district"]:checked')).map(cb => cb.value);
  const selectedMetros = Array.from(document.querySelectorAll('input[data-filter="metro"]:checked')).map(cb => cb.value);

  const filtered = listings.filter(item => {
    if (!item.active) return false;
    if (typeof item.price_from !== 'number') return false;    if (item.price_from > maxPrice) return false;
    if (selectedDistricts.length > 0 && !selectedDistricts.includes(item.district)) return false;
    if (selectedMetros.length > 0 && !selectedMetros.includes(item.metro)) return false;
    return true;
  });
  renderListings(filtered);
}

//  RENDER LISTINGS
function renderListings(data) {
  const container = document.getElementById('listingsContainer');
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state">${config.texts?.emptyState || 'Ничего не найдено'}</div>`;
    return;
  }

  data.forEach(item => {
    const price = typeof item.price_from === 'number' ? item.price_from.toFixed(1) : '?';
    const ppsqm = typeof item.price_per_sqm === 'number' ? Math.round(item.price_per_sqm).toLocaleString() : '';
    const statusKey = (item.status || 'other').toString().replace(/\s+/g, '-');
    let statusText = item.status || '';
    if (item.status === 'Сдан') statusText = '✅ Сдан';
    if (item.status === 'Строится') statusText = '🏗 Строится';
    if (item.status === 'Частично сдан') statusText = '🟡 Частично сдан';

    const card = document.createElement('div');
    card.className = 'listing-card';
    card.onclick = () => openDetails(item.id);
    card.innerHTML = `
      <img src="${item.image_main || ''}" alt="${item.name || ''}" class="listing-image" onerror="this.style.display='none'">
      <div class="listing-info">
        <h3>${item.name || 'Без названия'}</h3>
        <div class="listing-meta">
          <span>${item.district || ''}</span>
          <span>🚇 ${item.metro || ''}</span>
        </div>
        <div class="listing-price">
          от ${price} млн ₽
          ${ppsqm ? `<span class="price-per-sqm">~${ppsqm} ₽/м²</span>` : ''}
        </div>
        <div class="listing-status status-${statusKey}">${statusText}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

// 🔍 MODAL DETAILS (ОБНОВЛЕННАЯ ФУНКЦИЯ)function openDetails(id) {
  const item = listings.find(l => l.id === id);
  if (!item) return;
 
  currentModalId = id;
  document.getElementById('modalTitle').textContent = item.name;
  document.getElementById('modalPrice').innerHTML = `от <b>${item.price_from}</b> млн ₽ <span class="price-per-sqm">~${Math.round(item.price_per_sqm)} ₽/м²</span>`;
  document.getElementById('modalMeta').innerHTML = `
    <div class="meta-row"><span>📍 ${item.address || ''}</span></div>
    <div class="meta-row"><span>🚇 ${item.metro || ''}</span></div>
    <div class="meta-row"><span>🏗 ${item.class || ''} • ${item.finishing || ''}</span></div>
    <div class="meta-row"><span>📅 ${item.completion_all || item.completion_soonest}</span></div>
  `;
  document.getElementById('modalDescription').textContent = item.description || 'Описание отсутствует';
  document.getElementById('modalFeatures').innerHTML = item.features ? `<ul>${item.features.split(',').map(f => `<li>${f.trim()}</li>`).join('')}</ul>` : '';

  // ЛОГИКА ПЛАНИРОВОК (Текст + Картинки)
  const plansContainer = document.getElementById('modalFloorPlans');
  plansContainer.innerHTML = '';
 
  if (item.floor_plans_text) {
    const textDiv = document.createElement('div');
    textDiv.className = 'floor-plans-text';
    textDiv.textContent = item.floor_plans_text;
    plansContainer.appendChild(textDiv);
  }
 
  if (item.floor_plans_images) {
    const galleryDiv = document.createElement('div');
    galleryDiv.className = 'floor-plans-gallery';
    const urls = item.floor_plans_images.split(',').map(u => u.trim());
    urls.forEach(url => {
      const img = document.createElement('img');
      img.src = url;
      img.className = 'floor-plan-image';
      img.alt = 'Планировка';
      img.onclick = () => window.open(url, '_blank');
      galleryDiv.appendChild(img);
    });
    plansContainer.appendChild(galleryDiv);
  }
 
  if (!item.floor_plans_text && !item.floor_plans_images) {
    plansContainer.innerHTML = '<p style="color:#718096;">Информация уточняется</p>';
  }

  // Gallery основного ЖК
  const gallery = document.getElementById('modalGallery');
  gallery.innerHTML = '';
  if (item.image_main) {    const img = document.createElement('img');
    img.src = item.image_main;
    img.className = 'modal-main-image';
    gallery.appendChild(img);
  }
  if (item.images_gallery) {
    const urls = item.images_gallery.split(',').map(u => u.trim());
    urls.forEach(url => {
      const img = document.createElement('img');
      img.src = url;
      img.className = 'modal-thumb';
      gallery.appendChild(img);
    });
  }

  document.getElementById('detailsModal').classList.remove('hidden');
  tg.MainButton.show();
}

function closeModal() {
  document.getElementById('detailsModal').classList.add('hidden');
  tg.MainButton.hide();
  currentModalId = null;
}

function sendConsultRequest() {
  if (!currentModalId) return;
  const item = listings.find(l => l.id === currentModalId);
  tg.sendData(JSON.stringify({
    action: 'consult_request',
    objectId: item.id,
    objectName: item.name
  }));
  tg.showAlert(`Заявка по ЖК "${item.name}" отправлена!`);
  closeModal();
}

init();
