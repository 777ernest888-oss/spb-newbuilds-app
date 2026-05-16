// 🛡 1. БЕЗОПАСНАЯ ИНИЦИАЛИЗАЦИЯ TELEGRAM WEBAPP
let tg;
try {
  if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand(); // Раскрываем на весь экран
  } else {
    // Заглушка для браузера (чтобы не падало при тесте в Chrome)
    tg = {
      ready: () => {},
      expand: () => {},
      MainButton: { setText: () => {}, show: () => {}, onClick: () => {} },
      showAlert: (msg) => alert(msg),
      sendData: (data) => console.log('sendData:', data),
      close: () => {}
    };
    console.warn('️ Запущено вне Telegram. SDK эмулируется.');
  }
} catch (e) {
  console.error('Ошибка инициализации TG SDK:', e);
}

let config = {};
let listings = [];

// 🚀 2. ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА
async function init() {
  try {
    // А. Загружаем конфиг
    const configRes = await fetch('config.json');
    if (!configRes.ok) throw new Error('Не найден config.json');
    config = await configRes.json();

    // Б. Загружаем данные из таблицы
    if (config.data?.source === 'google_sheets' && config.data?.sheetUrl) {
      listings = await loadFromGoogleSheets(config.data.sheetUrl);
      console.log(`✅ Загружено объектов: ${listings.length}`);
    } else {
      console.warn('⚠️ Ссылка на таблицу не настроена в config.json');
    }

    // В. Отрисовываем интерфейс
    applyTheme();
    renderWelcome();
    renderFilters();
    renderListings(listings.filter(l => l.active));

    // Г. Настраиваем кнопку Telegram
    tg.MainButton.setText(config.texts?.ctaButton || 'Отправить заявку');    tg.MainButton.show();
    tg.MainButton.onClick(() => {
      // Здесь можно добавить логику открытия формы
      tg.showAlert('Спасибо! Заявка будет отправлена (демо-режим).');
    });

  } catch (error) {
    console.error('Критическая ошибка запуска:', error);
    document.body.innerHTML = `<div style="padding:20px; text-align:center; color:red;">
      <h3>Ошибка загрузки</h3>
      <p>${error.message}</p>
      <button onclick="location.reload()">Обновить</button>
    </div>`;
  }
}

//  3. УМНАЯ ЗАГРУЗКА GOOGLE SHEETS
async function loadFromGoogleSheets(url) {
  try {
    // Превращаем ссылку pubhtml в ссылку на CSV
    // Было: .../pubhtml?gid=0&single=true
    // Стало: .../pub?gid=0&output=csv&single=true
    let csvUrl = url.replace('pubhtml', 'pub');
    if (!csvUrl.includes('output=csv')) {
      csvUrl += (csvUrl.includes('?') ? '&' : '?') + 'output=csv';
    }

    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);
   
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('Ошибка чтения таблицы:', error);
    return []; // Возвращаем пустой массив, чтобы приложение не упало
  }
}

// 🔍 4. НАДЕЖНЫЙ ПАРСЕР CSV
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  // Чистим заголовки от лишних пробелов и кавычек
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
        const values = parseCSVLine(lines[i]);
    const obj = {};
   
    headers.forEach((header, index) => {
      let value = values[index] !== undefined ? values[index].trim() : '';
     
      // Конвертация типов данных
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
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// 🎨 5. ПРИМЕНЕНИЕ ТЕМЫ
function applyTheme() {
  if (!config.brand) return;
  document.documentElement.style.setProperty('--primary', config.brand.primaryColor || '#1a365d');
  document.documentElement.style.setProperty('--accent', config.brand.accentColor || '#d4af37');

  const img = document.getElementById('welcomeImage');
  if (img && config.brand.welcomeImage) img.src = config.brand.welcomeImage;
}

// 🖼 6. РЕНДЕР WELCOME
function renderWelcome() {
  if (!config.features?.showWelcomeScreen) return; 
  document.getElementById('welcomeTitle').textContent = config.brand.welcomeTitle || '';
  document.getElementById('welcomeSubtitle').textContent = config.brand.welcomeSubtitle || '';

  document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    tg.MainButton.show();
  });
}

//  7. РЕНДЕР ФИЛЬТРОВ
function renderFilters() {
  const priceInput = document.getElementById('priceFilter');
  const priceLabel = document.getElementById('priceValue');
 
  if (priceInput && priceLabel) {
    const max = config.filters?.defaults?.maxPrice || 500;
    priceInput.max = max;
    priceInput.value = max;
    priceLabel.textContent = max;

    priceInput.addEventListener('input', (e) => {
      priceLabel.textContent = e.target.value;
      filterListings();
    });
  }
}

//  8. РЕНДЕР КАРТОЧЕК (с защитой от ошибок)
function renderListings(data) {
  const container = document.getElementById('listingsContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state">${config.texts?.emptyState || 'Ничего не найдено'}</div>`;
    return;
  }

  data.forEach(item => {
    // Защита от отсутствующих данных
    const price = typeof item.price_from === 'number' ? item.price_from.toFixed(1) : '?';
    const ppsqm = typeof item.price_per_sqm === 'number' ? Math.round(item.price_per_sqm).toLocaleString() : '';
   
    // Исправление пробелов в CSS классе статуса
    const statusKey = (item.status || 'other').toString().replace(/\s+/g, '-');
    let statusBadge = item.status || '';
    if (item.status === 'Сдан') statusBadge = '✅ Сдан';
    if (item.status === 'Строится') statusBadge = '🏗 Строится';    if (item.status === 'Частично сдан') statusBadge = '🟡 Частично сдан';

    const card = document.createElement('div');
    card.className = 'listing-card';
    card.innerHTML = `
      <img src="${item.image_main || ''}" alt="${item.name || ''}" class="listing-image" onerror="this.style.display='none'">
      <div class="listing-info">
        <h3>${item.name || 'Без названия'}</h3>
        <div class="listing-meta">
          <span>${item.district || ''}</span>
          <span>🚇 ${item.metro || ''}</span>
          <span>${item.class || ''}</span>
        </div>
        <div class="listing-price">
          от ${price} млн ₽
          ${ppsqm ? `<span class="price-per-sqm">~${ppsqm} ₽/м²</span>` : ''}
        </div>
        <div class="listing-status status-${statusKey}">${statusBadge}</div>
        <div class="listing-address">📍 ${item.address || ''}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

// 🔎 9. ФИЛЬТРАЦИЯ
function filterListings() {
  const maxPrice = parseFloat(document.getElementById('priceFilter')?.value || 500);
 
  const filtered = listings.filter(item => {
    // Показываем только активные объекты, у которых есть цена и она входит в диапазон
    return item.active && typeof item.price_from === 'number' && item.price_from <= maxPrice;
  });
 
  renderListings(filtered);
}

// ▶️ ЗАПУСК
init();
