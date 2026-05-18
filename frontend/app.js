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
// ADMIN: Сохранение места (4 ЯЗЫКА + ИСПРАВЛЕН БАГ КНОПКИ)
// ============================================================
async function savePlace() {
  const btn = document.querySelector('button[onclick="savePlace()"]');
  const orig = btn?.innerText;

  const aliasesRaw = document.getElementById('p_aliases')?.value || '';
  const aliases = aliasesRaw.split(',').map(a => a.trim()).filter(Boolean);

  // Собираем новый мультиязычный объект данных
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