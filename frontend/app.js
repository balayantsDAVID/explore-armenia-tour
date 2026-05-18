const RENDER_API_URL = "https://explore-armenia-tour.onrender.com";

// Пробуждаем Render перед важными запросами
async function wakeUpRender() {
  try {
    await fetch(`${RENDER_API_URL}/health`, { method: 'GET' });
    await new Promise(r => setTimeout(r, 2000));
  } catch (e) { }
}

// ============================================================
// ГЕНЕРАЦИЯ ТУРА (Для index.html)
// ============================================================
async function generateTour() {
  const btn = document.getElementById('gen_btn');
  const resultArea = document.getElementById('result_area');
  const errorArea = document.getElementById('error_area');
  const statusArea = document.getElementById('status_area');
  const statusText = document.getElementById('status_text');

  resultArea?.classList.add('hidden');
  errorArea?.classList.add('hidden');
  document.getElementById('not_found_warning')?.classList.add('hidden');

  const setStatus = (msg) => {
    if (statusArea) statusArea.classList.remove('hidden');
    if (statusText) statusText.innerHTML = msg;
  };

  btn.innerText = "⏳ Генерирую...";
  btn.disabled = true;
  setStatus('🔄 Отправляем запрос на сервер...');

  const getDate = (inputId, hiddenId) => {
    const hidden = document.getElementById(hiddenId);
    if (hidden && hidden.value) return hidden.value;
    const input = document.getElementById(inputId);
    return input ? input.value.trim() : '';
  };

  const payload = {
    prompt: document.getElementById('route_prompt').value.trim(),
    lang: document.getElementById('lang').value,
    meta: {
      start: getDate('start_date', 'start_date_display'),
      end: getDate('end_date', 'end_date_display'),
      flight_in: document.getElementById('flight_in').value.trim(),
      flight_out: document.getElementById('flight_out').value.trim(),
      guests: document.getElementById('participants').value.trim() + ' человека',
      hotel: document.getElementById('hotel').value.trim(),
      contact: document.getElementById('contact').value.trim(),
    }
  };

  if (!payload.prompt) {
    showError("Введите маршрут тура");
    statusArea?.classList.add('hidden');
    btn.innerText = "СГЕНЕРИРОВАТЬ ПРОГРАММУ";
    btn.disabled = false;
    return;
  }

  try {
    setStatus('🤖 ИИ анализирует маршрут и ищет места в базе...<br><span class="text-xs text-gray-400">⏳ Это займёт 20-60 секунд, пожалуйста подождите</span>');
    const response = await fetch(`${RENDER_API_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setStatus('📄 Сервер ответил — собираем документ...');

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || `Ошибка сервера: ${response.status}`);
    }

    const data = await response.json();
    setStatus(`✅ Документ готов!`);
    resultArea?.classList.remove('hidden');

    document.getElementById('link_docx').href = `${RENDER_API_URL}/download/${data.file_id}/docx`;
    document.getElementById('link_pdf').href = `${RENDER_API_URL}/download/${data.file_id}/pdf`;
    document.getElementById('result_info').innerText = `Дней: ${data.days_processed} | Найдено мест: ${data.places_found}`;

    if (data.places_not_found && data.places_not_found.length > 0) {
      document.getElementById('not_found_warning')?.classList.remove('hidden');
      if (document.getElementById('not_found_list')) {
        document.getElementById('not_found_list').innerText = data.places_not_found.join(', ');
      }
    }
  } catch (e) {
    if (e.message.includes('fetch') || e.message.includes('Failed') || e.message.includes('network')) {
      showError("Сервер просыпается (~30 сек). Подождите и попробуйте снова.");
      setStatus('😴 Сервер засыпает после простоя — первый запрос всегда медленнее');
    } else {
      showError(e.message.substring(0, 200));
      statusArea?.classList.add('hidden');
    }
  } finally {
    btn.innerText = "СГЕНЕРИРОВАТЬ ПРОГРАММУ";
    btn.disabled = false;
  }
}

function showError(msg) {
  const errorArea = document.getElementById('error_area');
  if (errorArea) {
    errorArea.classList.remove('hidden');
    errorArea.innerText = `⚠️ ${msg}`;
  }
}

// ============================================================
// ADMIN: Загрузка и рендер списка мест (БЕЗ КАТЕГОРИЙ)
// ============================================================
async function loadPlaces() {
  const search = document.getElementById('search_input')?.value || '';
  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);

    const res = await fetch(`${RENDER_API_URL}/places?${params}`);
    const data = await res.json();

    if (typeof renderPlacesList === 'function') {
      renderPlacesList(data.places);
    }

    const counter = document.getElementById('places_counter');
    if (counter) counter.innerText = `Всего мест в базе: ${data.total}`;
  } catch (e) {
    console.error('Ошибка загрузки мест:', e);
    const container = document.getElementById('places_list');
    if (container) container.innerHTML = '<p class="text-red-400 text-center py-4">Ошибка загрузки данных</p>';
  }
}

// ============================================================
// ADMIN: Сохранение места (4 ЯЗЫКА)
// ============================================================
async function savePlace() {
  const btn = document.querySelector('button[onclick="savePlace()"]');
  const orig = btn?.innerText;

  const aliasesRaw = document.getElementById('p_aliases')?.value || '';
  const aliases = aliasesRaw.split(',').map(a => a.trim()).filter(Boolean);

  const data = {
    slug: document.getElementById('p_slug')?.value.trim() || '',
    name_ru: document.getElementById('p_name_ru')?.value.trim() || '',
    name_en: document.getElementById('p_name_en')?.value.trim() || '',
    name_de: document.getElementById('p_name_de')?.value.trim() || '',
    name_hy: document.getElementById('p_name_hy')?.value.trim() || '',
    desc_ru: document.getElementById('p_desc_ru')?.value.trim() || '',
    desc_en: document.getElementById('p_desc_en')?.value.trim() || '',
    desc_de: document.getElementById('p_desc_de')?.value.trim() || '',
    desc_hy: document.getElementById('p_desc_hy')?.value.trim() || '',
    photo_main: document.getElementById('p_img1')?.value.trim() || '',
    aliases: aliases
  };

  if (!data.name_ru || !data.slug) {
    alert("Обязательно заполните Название RU и Slug");
    return;
  }

  if (btn) { btn.disabled = true; btn.innerText = '⏳ Подключаемся...'; }
  await wakeUpRender();

  const editingId = document.getElementById('editing_id')?.value;
  const method = editingId ? 'PUT' : 'POST';
  const url = editingId ? `${RENDER_API_URL}/places/${editingId}` : `${RENDER_API_URL}/places`;

  if (btn) btn.innerText = '⏳ Сохраняем...';

  const tryFetch = async (attempt) => {
    if (attempt > 1) {
      if (btn) btn.innerText = `⏳ Попытка ${attempt}/3 (сервер просыпается...)`;
      await new Promise(r => setTimeout(r, 8000));
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 50000);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: ctrl.signal
      });
      clearTimeout(t);
      return res;
    } catch (e) {
      clearTimeout(t);
      throw e;
    }
  };

  for (let i = 1; i <= 3; i++) {
    try {
      const res = await tryFetch(i);
      if (res.ok) {
        alert(editingId ? "✅ Место успешно обновлено!" : "✅ Место успешно добавлено!");
        if (typeof resetForm === 'function') resetForm();
        loadPlaces();
        break;
      } else {
        const err = await res.json();
        alert(`Ошибка: ${err.detail || 'Не удалось сохранить'}`);
        break;
      }
    } catch (e) {
      if (i === 3) alert('Сервер не отвечает. Подождите 30 секунд и попробуйте снова.');
    }
  }

  if (btn) { btn.disabled = false; btn.innerText = orig; }
}

// ============================================================
// ADMIN: Удаление
// ============================================================
async function deletePlace(id) {
  if (!confirm("Вы уверены? Место и все его ИИ-псевдонимы будут навсегда удалены из базы данных!")) return;

  try {
    const res = await fetch(`${RENDER_API_URL}/places/${id}`, { method: 'DELETE' });
    if (res.ok) loadPlaces();
  } catch (e) {
    alert(`Ошибка: ${e.message}`);
  }
}

// ============================================================
// ADMIN: Аналитика генераций (Chart.js)
// ============================================================
let chartInstance = null;
let analyticsData = [];

async function loadAnalytics() {
  try {
    const res = await fetch(`${RENDER_API_URL}/analytics/generations`);
    const data = await res.json();
    if (data.analytics) {
      analyticsData = data.analytics;
      renderChart();
    }
  } catch (e) {
    console.error("Ошибка загрузки аналитики:", e);
  }
}

function renderChart() {
  const ctx = document.getElementById('generationsChart');
  if (!ctx) return;

  const filterValue = document.getElementById('chartFilter').value;
  let filteredData = [...analyticsData];

  // Фильтрация по дням
  if (filterValue !== 'all') {
    const days = parseInt(filterValue);
    filteredData = filteredData.slice(-days); // Берем последние N записей
  }

  // Формируем массивы для осей X и Y
  const labels = filteredData.map(d => {
    // Делаем дату красивой (например, 18.05)
    const [year, month, day] = d.date.split('-');
    return `${day}.${month}`;
  });
  const counts = filteredData.map(d => d.count);

  // Если график уже существует, удаляем его перед перерисовкой
  if (chartInstance) {
    chartInstance.destroy();
  }

  // Рисуем гистограмму
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Сгенерировано документов',
        data: counts,
        backgroundColor: '#0891b2', // cyan-600 из Tailwind
        borderRadius: 4,
        hoverBackgroundColor: '#0e7490' // cyan-700
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false } // Скрываем лишнюю легенду
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 } // Чтобы не было дробных генераций (0.5 туров)
        }
      }
    }
  });
}

// Запускаем загрузку аналитики при старте страницы
loadAnalytics();