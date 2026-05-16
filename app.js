const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let config = {};
let listings = [];

// Загрузка конфига и данных
async function init() {
  try {
    const configRes = await fetch('config.json');
    config = await configRes.json();
   
    if (config.data.source === 'google_sheets') {
      listings = await loadFromGoogleSheets(config.data.sheetUrl);
    }
   
    applyTheme();
    renderWelcome();
    renderFilters();
    renderListings(listings.filter(l => l.active));
   
    tg.MainButton.setText(config.texts.ctaButton);
    tg.MainButton.show();
    tg.MainButton.onClick(() => {
      tg.sendData(JSON.stringify({ action: 'consult_request', source: 'spb_newbuilds' }));
    });
   
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    tg.showAlert('Не удалось загрузить данные. Попробуйте позже.');
  }
}

async function loadFromGoogleSheets(url) {
  const jsonUrl = url
    .replace('/pubhtml?', '/pub?output=csv&gid=')
    .replace('&single=true', '');
 
  const response = await fetch(jsonUrl);
  const csvText = await response.text();
 
  return parseCSV(csvText);
}

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  const result = [];
    for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
   
    const values = parseCSVLine(lines[i]);
    const obj = {};
   
    headers.forEach((header, index) => {
      let value = values[index] || '';
     
      if (value === 'TRUE') value = true;
      else if (value === 'FALSE') value = false;
      else if (!isNaN(value) && value !== '') value = Number(value);
     
      obj[header.trim()] = value;
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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
 
  return result;
}

function applyTheme() {
  document.documentElement.style.setProperty('--primary', config.brand.primaryColor || '#1a365d');
  document.documentElement.style.setProperty('--accent', config.brand.accentColor || '#d4af37');
 
  if (config.brand.welcomeImage) {
    const welcome = document.getElementById('welcomeImage');    if (welcome) welcome.src = config.brand.welcomeImage;
  }
}

function renderWelcome() {
  if (!config.features.showWelcomeScreen) return;
 
  document.getElementById('welcomeTitle').textContent = config.brand.welcomeTitle;
  document.getElementById('welcomeSubtitle').textContent = config.brand.welcomeSubtitle;
 
  document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    tg.MainButton.show();
  });
}

function renderFilters() {
  const priceFilter = document.getElementById('priceFilter');
  const priceValue = document.getElementById('priceValue');
 
  if (priceFilter && priceValue) {
    priceFilter.max = config.filters.defaults.maxPrice || 50;
    priceFilter.value = config.filters.defaults.maxPrice || 50;
    priceValue.textContent = priceFilter.value;
   
    priceFilter.addEventListener('input', (e) => {
      priceValue.textContent = e.target.value;
      filterListings();
    });
  }
}

function renderListings(data) {
  const container = document.getElementById('listingsContainer');
  container.innerHTML = '';
 
  if (data.length === 0) {
    container.innerHTML = `<div class="empty-state">${config.texts.emptyState}</div>`;
    return;
  }
 
  data.forEach(item => {
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.innerHTML = `
      <img src="${item.image_main}" alt="${item.name}" class="listing-image">
      <div class="listing-info">
        <h3>${item.name}</h3>
        <div class="listing-meta">          <span>${item.district}</span>
          <span>🚇 ${item.metro}</span>
          <span>${item.class}</span>
        </div>
        <div class="listing-price">
          от ${(item.price_from).toFixed(1)} млн ₽
          <span class="price-per-sqm">~${Math.round(item.price_per_sqm).toLocaleString()} ₽/м²</span>
        </div>
        <div class="listing-status status-${item.status}">
          ${item.status === 'Сдан' ? '✅ Сдан' : item.status === 'Строится' ? '🏗 Строится' : '🟡 Частично сдан'}
        </div>
        <div class="listing-address">📍 ${item.address}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function filterListings() {
  const maxPrice = parseFloat(document.getElementById('priceFilter').value);
 
  const filtered = listings.filter(item => {
    return item.active && item.price_from <= maxPrice;
  });
 
  renderListings(filtered);
}

init();