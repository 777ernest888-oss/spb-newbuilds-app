// 🛡 ИНИЦИАЛИЗАЦИЯ TELEGRAM WEBAPP
let tg;
try {
  if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
  } else {
    tg = {
      ready: () => {},
      expand: () => {},
      MainButton: { setText: () => {}, show: () => {}, onClick: () => {}, hide: () => {} },
      showAlert: (msg) => alert(msg),
      sendData: (data) => console.log('sendData:', data),
      close: () => {}
    };
  }
} catch (e) {
  console.error('TG Init Error:', e);
}

let config = {};
let listings = [];
let currentModalId = null;

// ✅ ГЛОБАЛЬНАЯ ФУНКЦИЯ ПЕРЕХОДА
function startApp() {
  const welcome = document.getElementById('welcomeScreen');
  const main = document.getElementById('mainContent');
 
  if (welcome) welcome.classList.add('hidden');
  if (main) main.classList.remove('hidden');
 
  if (tg && tg.MainButton) {
    tg.MainButton.show();
  }
 
  window.scrollTo(0, 0);
}

// 🔽 СВЕРНУТЬ/РАЗВЕРНУТЬ ФИЛЬТРЫ
function toggleFilters() {
  const block = document.getElementById('filtersBlock');
  const btn = document.querySelector('.filters-toggle-btn');
 
  if (block && btn) {
    block.classList.toggle('hidden');
    if (block.classList.contains('hidden')) {
      btn.textContent = '🔽 Фильтры';
    } else {      btn.textContent = '🔼 Скрыть фильтры';
    }
  }
}

// 🔄 ПЕРЕКЛЮЧЕНИЕ ВИДА
function switchView(view) {
  const listBtn = document.getElementById('listViewBtn');
  const mapBtn = document.getElementById('mapViewBtn');
  const listContainer = document.getElementById('listingsContainer');
  const mapContainer = document.getElementById('mapContainer');
 
  if (view === 'list') {
    listBtn.classList.add('active');
    mapBtn.classList.remove('active');
    listContainer.classList.remove('hidden');
    mapContainer.classList.add('hidden');
  } else {
    listBtn.classList.remove('active');
    mapBtn.classList.add('active');
    listContainer.classList.add('hidden');
    mapContainer.classList.remove('hidden');
    initMap();
  }
}

// 🚀 ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ
async function init() {
  try {
    const configRes = await fetch('config.json');
    if (!configRes.ok) throw new Error('Не удалось загрузить config.json');
    config = await configRes.json();
   
    if (config.data?.source === 'google_sheets' && config.data?.sheetUrl) {
      listings = await loadFromGoogleSheets(config.data.sheetUrl);
      console.log(`✅ Загружено объектов: ${listings.length}`);
    }
   
    applyTheme();
    renderWelcome();
    renderFilters();
    renderListings(listings.filter(l => l.active));
   
    if (tg && tg.MainButton) {
      tg.MainButton.setText(config.texts?.ctaButton || 'Получить консультацию');
      tg.MainButton.hide();
      tg.MainButton.onClick(() => {
        if (currentModalId) {
          sendConsultRequest();
        }      });
    }
   
  } catch (error) {
    console.error('Init Error:', error);
  }
}

// 📥 ЗАГРУЗКА ДАННЫХ
async function loadFromGoogleSheets(url) {
  let csvUrl = url.replace('pubhtml', 'pub');
  if (!csvUrl.includes('output=csv')) {
    csvUrl += (csvUrl.includes('?') ? '&' : '?') + 'output=csv';
  }
 
  const response = await fetch(csvUrl);
  const csvText = await response.text();
  return parseCSV(csvText);
}

// 🔍 ПАРСИНГ CSV
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
  const result = [];
  let current = '';
  let inQuotes = false;
 
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
   
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
 
  return result;
}

// 🎨 ТЕМЫ И WELCOME
function applyTheme() {
  if (!config.brand) return;
 
  document.documentElement.style.setProperty('--primary', config.brand.primaryColor || '#1a365d');
  document.documentElement.style.setProperty('--accent', config.brand.accentColor || '#d4af37');
 
  const img = document.getElementById('welcomeImage');
  if (img && config.brand.welcomeImage) {
    img.src = config.brand.welcomeImage;
  }
}

function renderWelcome() {
  if (!config.features?.showWelcomeScreen) {
    document.getElementById('welcomeScreen')?.classList.add('hidden');
    document.getElementById('mainContent')?.classList.remove('hidden');
    return;
  }
 
  const titleEl = document.getElementById('welcomeTitle');
  const subEl = document.getElementById('welcomeSubtitle');
 
  if (titleEl) titleEl.textContent = config.brand.welcomeTitle || '';
  if (subEl) subEl.textContent = config.brand.welcomeSubtitle || '';
}

// ✅ ФИЛЬТРЫ (ПРОВЕРЕНО ВРУЧНУЮ!)function renderFilters() {
  const districts = [...new Set(listings.map(l => l.district).filter(Boolean))].sort();
  const districtContainer = document.getElementById('districtCheckboxes');
 
  if (districtContainer) {
    districtContainer.innerHTML = '';
    districts.forEach(d => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      label.innerHTML = `
        <input type="checkbox" value="${escapeHtml(d)}" class="filter-checkbox" data-filter="district">
        <span>${escapeHtml(d)}</span>
      `;
      districtContainer.appendChild(label);
    });
  }
 
  const metros = [...new Set(listings.map(l => l.metro).filter(Boolean))].sort();
  const metroContainer = document.getElementById('metroCheckboxes');
 
  if (metroContainer) {
    metroContainer.innerHTML = '';
    metros.forEach(m => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      label.innerHTML = `
        <input type="checkbox" value="${escapeHtml(m)}" class="filter-checkbox" data-filter="metro">
        <span>${escapeHtml(m)}</span>
      `;
      metroContainer.appendChild(label);
    });
  }
 
  const priceFilter = document.getElementById('priceFilter');
  const priceValue = document.getElementById('priceValue');
 
  if (priceFilter && priceValue) {
    const maxP = config.filters?.defaults?.maxPrice || 500;
    priceFilter.max = maxP;
    priceFilter.value = maxP;
    priceValue.textContent = maxP;
   
    priceFilter.addEventListener('input', (e) => {
      priceValue.textContent = e.target.value;
      filterListings();
    });
  }
 
  document.querySelectorAll('.filter-checkbox').forEach(cb => {
    cb.addEventListener('change', filterListings);  });
}

// 🔍 ФИЛЬТРАЦИЯ
function filterListings() {
  const maxPrice = parseFloat(document.getElementById('priceFilter')?.value || 500);
 
  const selectedDistricts = Array.from(
    document.querySelectorAll('input[data-filter="district"]:checked')
  ).map(cb => cb.value);
 
  const selectedMetros = Array.from(
    document.querySelectorAll('input[data-filter="metro"]:checked')
  ).map(cb => cb.value);
 
  const filtered = listings.filter(item => {
    if (!item.active) return false;
    if (typeof item.price_from !== 'number') return false;
    if (item.price_from > maxPrice) return false;
    if (selectedDistricts.length > 0 && !selectedDistricts.includes(item.district)) return false;
    if (selectedMetros.length > 0 && !selectedMetros.includes(item.metro)) return false;
    return true;
  });
 
  renderListings(filtered);
}

// 🏠 РЕНДЕР СПИСКА
function renderListings(data) {
  const container = document.getElementById('listingsContainer');
  if (!container) return;
 
  container.innerHTML = '';
 
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        ${config.texts?.emptyState || 'Нет объектов по заданным фильтрам'}
      </div>
    `;
    return;
  }
 
  data.forEach(item => {
    const price = typeof item.price_from === 'number' ? item.price_from.toFixed(1) : '?';
    const ppsqm = typeof item.price_per_sqm === 'number'
      ? Math.round(item.price_per_sqm).toLocaleString('ru-RU')
      : '';
   
    const statusKey = (item.status || 'other').toString().replace(/\s+/g, '-');    let statusText = item.status || '';
   
    if (item.status === 'Сдан') statusText = '✅ Сдан';
    else if (item.status === 'Строится') statusText = '🏗 Строится';
    else if (item.status === 'Частично сдан') statusText = '🟡 Частично сдан';
   
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.onclick = () => openDetails(item.id);
   
    card.innerHTML = `
      <img src="${escapeHtml(item.image_main) || ''}"
           alt="${escapeHtml(item.name) || ''}"
           class="listing-image"
           onerror="this.style.display='none'">
      <div class="listing-info">
        <h3>${escapeHtml(item.name) || 'Без названия'}</h3>
        <div class="listing-meta">
          <span>${escapeHtml(item.district) || ''}</span>
          <span>🚇 ${escapeHtml(item.metro) || ''}</span>
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

// 🔍 ДЕТАЛИ ОБЪЕКТА
function openDetails(id) {
  const item = listings.find(l => l.id === id);
  if (!item) return;
 
  currentModalId = id;
 
  document.getElementById('modalTitle').textContent = item.name || '';
 
  const price = typeof item.price_from === 'number' ? item.price_from.toFixed(1) : '?';
  const ppsqm = typeof item.price_per_sqm === 'number'
    ? Math.round(item.price_per_sqm).toLocaleString('ru-RU')
    : '';
 
  document.getElementById('modalPrice').innerHTML = `
    от <b>${price}</b> млн ₽
    ${ppsqm ? `<span class="price-per-sqm">~${ppsqm} ₽/м²</span>` : ''}  `;
 
  document.getElementById('modalMeta').innerHTML = `
    <div class="meta-row"><span>📍 ${escapeHtml(item.address) || ''}</span></div>
    <div class="meta-row"><span>🚇 ${escapeHtml(item.metro) || ''}</span></div>
    <div class="meta-row"><span>🏗 ${escapeHtml(item.class) || ''} • ${escapeHtml(item.finishing) || ''}</span></div>
    <div class="meta-row"><span>📅 ${escapeHtml(item.completion_all || item.completion_soonest) || ''}</span></div>
  `;
 
  document.getElementById('modalDescription').textContent = item.description || 'Описание отсутствует';
 
  const featuresDiv = document.getElementById('modalFeatures');
  if (item.features) {
    const featuresList = item.features.split(',').map(f => f.trim()).filter(Boolean);
    featuresDiv.innerHTML = `<ul>${featuresList.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`;
  } else {
    featuresDiv.innerHTML = '<p style="color: var(--text-secondary)">Информация уточняется</p>';
  }
 
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
    const urls = item.floor_plans_images.split(',').map(u => u.trim()).filter(Boolean);
   
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
    plansContainer.innerHTML = '<p style="color: var(--text-secondary)">Информация уточняется</p>';
  }
    const gallery = document.getElementById('modalGallery');
  gallery.innerHTML = '';
 
  if (item.image_main) {
    const mainImg = document.createElement('img');
    mainImg.src = item.image_main;
    mainImg.className = 'modal-main-image';
    gallery.appendChild(mainImg);
  }
 
  if (item.images_gallery) {
    const urls = item.images_gallery.split(',').map(u => u.trim()).filter(Boolean);
    urls.forEach(url => {
      const img = document.createElement('img');
      img.src = url;
      img.className = 'modal-thumb';
      img.onclick = () => window.open(url, '_blank');
      gallery.appendChild(img);
    });
  }
 
  document.getElementById('detailsModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
 
  if (tg && tg.MainButton) {
    tg.MainButton.show();
  }
}

function closeModal() {
  document.getElementById('detailsModal').classList.add('hidden');
  document.body.style.overflow = '';
  currentModalId = null;
 
  if (tg && tg.MainButton) {
    tg.MainButton.hide();
  }
}

function sendConsultRequest() {
  if (!currentModalId) return;
 
  const item = listings.find(l => l.id === currentModalId);
  if (!item) return;
 
  const message = {
    action: 'consult_request',
    objectId: item.id,
    objectName: item.name,
    timestamp: new Date().toISOString()  };
 
  tg.sendData(JSON.stringify(message));
  tg.showAlert(`✅ Заявка по ЖК "${item.name}" отправлена!`);
 
  closeModal();
}

function initMap() {
  const mapContainer = document.getElementById('mapContainer');
  if (mapContainer) {
    mapContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary)">🗺 Карта будет добавлена</div>';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 🚀 ЗАПУСК
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
