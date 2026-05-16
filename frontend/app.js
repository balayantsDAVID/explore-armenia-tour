// ============================================================
// ExploreArmenia — Фронтенд логика
// ============================================================
// Этот файл лежит на Бегете (статика).
// Он вызывает API на Render через fetch().
//
// ВАЖНО: После деплоя на Render замени RENDER_API_URL
// на реальный адрес твоего сервиса.
// ============================================================

// ← ЗАМЕНИ ЭТО после деплоя на Render
const RENDER_API_URL = "https://explore-armenia-tour.onrender.com";


// ============================================================
// ГЕНЕРАЦИЯ ТУРА
// ============================================================
async function generateTour() {
  const btn = document.getElementById('gen_btn');
  const resultArea = document.getElementById('result_area');
  const errorArea = document.getElementById('error_area');
  const statusArea = document.getElementById('status_area');
  const statusText = document.getElementById('status_text');

  resultArea.classList.add('hidden');
  errorArea.classList.add('hidden');
  document.getElementById('not_found_warning').classList.add('hidden');

  const setStatus = (msg) => {
    statusArea.classList.remove('hidden');
    statusText.innerHTML = msg;
  };

  btn.innerText = "⏳ Генерирую...";
  btn.disabled = true;
  setStatus('🔄 Отправляем запрос на сервер...');

  const payload = {
    prompt: document.getElementById('route_prompt').value.trim(),
    lang: document.getElementById('lang').value,
    meta: {
      start: document.getElementById('start_date').value.trim(),
      end: document.getElementById('end_date').value.trim(),
      flight_in: document.getElementById('flight_in').value.trim(),
      flight_out: document.getElementById('flight_out').value.trim(),
      guests: document.getElementById('participants').value.trim(),
      hotel: document.getElementById('hotel').value.trim(),
      contact: document.getElementById('contact').value.trim(),
    }
  };

  if (!payload.prompt) {
    showError("Введите маршрут тура");
    statusArea.classList.add('hidden');
    return;
  }

  try {
    setStatus('🤖 ИИ анализирует маршрут и ищет места в базе...<br>⏳ Это займёт 20-60 секунд, пожалуйста подождите');

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

    setStatus(`✅ Документ готов! Дней: ${data.days_processed} | Мест найдено: ${data.places_found}`);

    resultArea.classList.remove('hidden');
    document.getElementById('link_docx').href = data.docx_url;
    document.getElementById('link_pdf').href = data.pdf_url;
    document.getElementById('result_info').innerText =
      `Дней: ${data.days_processed} | Мест найдено: ${data.places_found}`;

    if (data.places_not_found && data.places_not_found.length > 0) {
      document.getElementById('not_found_warning').classList.remove('hidden');
      document.getElementById('not_found_list').innerText = data.places_not_found.join(', ');
    }

  } catch (e) {
    if (e.message.includes('fetch') || e.message.includes('Failed') || e.message.includes('network')) {
      showError("Сервер просыпается. Подождите 30 секунд и попробуйте снова.");
      setStatus('😴 Сервер засыпает после простоя — первый запрос всегда медленнее');
    } else {
      showError(e.message);
      statusArea.classList.add('hidden');
    }
  } finally {
    btn.innerText = "СГЕНЕРИРОВАТЬ ПРОГРАММУ";
    btn.disabled = false;
  }
}

function showError(msg) {
  const errorArea = document.getElementById('error_area');
  errorArea.classList.remove('hidden');
  errorArea.innerText = `⚠️ ${msg}`;
  document.getElementById('gen_btn').innerText = "СГЕНЕРИРОВАТЬ ПРОГРАММУ";
  document.getElementById('gen_btn').disabled = false;
}


// ============================================================
// ADMIN: Загрузка списка мест
// ============================================================

async function loadPlaces() {
  const search = document.getElementById('search_input')?.value || '';
  const category = document.getElementById('filter_cat')?.value || '';

  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);

    const res = await fetch(`${RENDER_API_URL}/places?${params}`);
    const data = await res.json();

    renderPlacesList(data.places);

    const counter = document.getElementById('places_counter');
    if (counter) counter.innerText = `Всего мест: ${data.total}`;

  } catch (e) {
    console.error('Ошибка загрузки мест:', e);
  }
}

function renderPlacesList(places) {
  const container = document.getElementById('places_list');
  if (!container) return;

  if (places.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-center py-8">Мест не найдено</p>';
    return;
  }

  container.innerHTML = places.map(p => `
    <div class="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-4">
      ${p.photo_main
      ? `<img src="${p.photo_main}" class="w-20 h-16 object-cover rounded" onerror="this.style.display='none'">`
      : `<div class="w-20 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">нет фото</div>`
    }
      <div class="flex-1">
        <div class="flex justify-between items-start">
          <div>
            <span class="font-bold text-gray-800">${p.name_ru || '—'}</span>
            ${p.name_en ? `<span class="text-gray-400 text-sm ml-2">${p.name_en}</span>` : ''}
          </div>
          <span class="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">${p.category}</span>
        </div>
        <p class="text-sm text-gray-500 mt-1 line-clamp-2">${p.promo_ru || p.desc_ru || 'Нет описания'}</p>
        <div class="flex gap-2 mt-2">
          <button onclick="editPlace(${p.id})" class="text-xs text-blue-600 hover:underline">Редактировать</button>
          <button onclick="deletePlace(${p.id})" class="text-xs text-red-500 hover:underline">Удалить</button>
        </div>
      </div>
    </div>
  `).join('');
}


// ============================================================
// ADMIN: Сохранение нового места
// ============================================================

async function savePlace() {
  const aliasesRaw = document.getElementById('p_aliases')?.value || '';
  const aliases = aliasesRaw.split(',').map(a => a.trim()).filter(Boolean);

  const data = {
    name_ru: document.getElementById('p_name_ru').value.trim(),
    name_en: document.getElementById('p_name_en')?.value.trim() || '',
    slug: document.getElementById('p_slug').value.trim(),
    category: document.getElementById('p_cat').value,
    region: document.getElementById('p_region')?.value.trim() || '',
    desc_ru: document.getElementById('p_desc_ru')?.value.trim() || '',
    promo_ru: document.getElementById('p_promo').value.trim(),
    promo_en: document.getElementById('p_promo_en')?.value.trim() || '',
    photo_main: document.getElementById('p_img1').value.trim(),
    photo_secondary: document.getElementById('p_img2')?.value.trim() || '',
    aliases: aliases
  };

  if (!data.name_ru || !data.slug) {
    alert("Заполните название и slug");
    return;
  }

  const editingId = document.getElementById('editing_id')?.value;
  const method = editingId ? 'PUT' : 'POST';
  const url = editingId
    ? `${RENDER_API_URL}/places/${editingId}`
    : `${RENDER_API_URL}/places`;

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      alert(editingId ? "Место обновлено!" : "Место добавлено!");
      resetForm();
      loadPlaces();
    } else {
      const err = await res.json();
      alert(`Ошибка: ${err.detail}`);
    }
  } catch (e) {
    alert(`Ошибка сети: ${e.message}`);
  }
}


// ============================================================
// ADMIN: Редактирование и удаление
// ============================================================

async function editPlace(id) {
  try {
    const res = await fetch(`${RENDER_API_URL}/places?search=&category=`);
    const data = await res.json();
    const place = data.places.find(p => p.id === id);

    if (!place) return;

    // Заполняем форму данными места
    document.getElementById('p_name_ru').value = place.name_ru || '';
    if (document.getElementById('p_name_en')) document.getElementById('p_name_en').value = place.name_en || '';
    document.getElementById('p_slug').value = place.slug || '';
    document.getElementById('p_cat').value = place.category || 'monastery';
    if (document.getElementById('p_region')) document.getElementById('p_region').value = place.region || '';
    if (document.getElementById('p_desc_ru')) document.getElementById('p_desc_ru').value = place.desc_ru || '';
    document.getElementById('p_promo').value = place.promo_ru || '';
    document.getElementById('p_img1').value = place.photo_main || '';
    if (document.getElementById('p_img2')) document.getElementById('p_img2').value = place.photo_secondary || '';

    // Помечаем что редактируем
    if (document.getElementById('editing_id')) {
      document.getElementById('editing_id').value = id;
    }

    // Скроллим к форме
    document.getElementById('place_form').scrollIntoView({ behavior: 'smooth' });
    document.querySelector('#place_form h3').innerText = `Редактировать: ${place.name_ru}`;

  } catch (e) {
    console.error(e);
  }
}

async function deletePlace(id) {
  if (!confirm("Удалить это место? (оно скроется, данные сохранятся)")) return;

  try {
    const res = await fetch(`${RENDER_API_URL}/places/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadPlaces();
    }
  } catch (e) {
    alert(`Ошибка: ${e.message}`);
  }
}

function resetForm() {
  ['p_name_ru', 'p_name_en', 'p_slug', 'p_region', 'p_desc_ru',
    'p_promo', 'p_promo_en', 'p_img1', 'p_img2', 'p_aliases'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  if (document.getElementById('editing_id')) {
    document.getElementById('editing_id').value = '';
  }
  const h3 = document.querySelector('#place_form h3');
  if (h3) h3.innerText = 'Добавить новое место';
}

// Автоматически загружаем места если мы на странице admin
if (document.getElementById('places_list')) {
  loadPlaces();
}
