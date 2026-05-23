const RENDER_API_URL = "https://explore-armenia-tour.onrender.com";

async function wakeUpRender() {
  try { await fetch(`${RENDER_API_URL}/health`); await new Promise(r => setTimeout(r, 1000)); } catch (e) { }
}

async function generateTour() {
  const btn = document.getElementById('gen_btn');
  const resultArea = document.getElementById('result_area');
  const errorArea = document.getElementById('error_area');
  const statusArea = document.getElementById('status_area');
  const statusText = document.getElementById('status_text');

  resultArea?.classList.add('hidden'); errorArea?.classList.add('hidden');
  document.getElementById('not_found_warning')?.classList.add('hidden');

  const setStatus = (msg) => {
    if (statusArea) statusArea.classList.remove('hidden');
    if (statusText) statusText.innerHTML = msg;
  };

  btn.innerText = "⏳ Генерирую..."; btn.disabled = true;
  setStatus('🔄 Отправляем запрос на сервер...');

  const getDate = (id, hid) => document.getElementById(hid)?.value || document.getElementById(id)?.value?.trim() || '';

  const payload = {
    prompt: document.getElementById('route_prompt').value.trim(),
    lang: document.getElementById('lang').value,
    meta: {
      start: getDate('start_date', 'start_date_display'), end: getDate('end_date', 'end_date_display'),
      flight_in: document.getElementById('flight_in').value.trim(), flight_out: document.getElementById('flight_out').value.trim(),
      guests: document.getElementById('participants').value.trim() + ' человека',
      hotel: document.getElementById('hotel').value.trim(), contact: document.getElementById('contact').value.trim(),
    }
  };

  if (!payload.prompt) { btn.innerText = "СГЕНЕРИРОВАТЬ ПРОГРАММУ"; btn.disabled = false; return; }

  try {
    const res = await fetch(`${RENDER_API_URL}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error("Ошибка сервера");
    const data = await res.json();
    setStatus(`✅ Документ готов!`); resultArea?.classList.remove('hidden');
    document.getElementById('link_docx').href = data.docx_url;
    document.getElementById('link_pdf').href = data.pdf_url;
    document.getElementById('result_info').innerText = `Дней: ${data.days_processed} | Найдено мест: ${data.places_found}`;
  } catch (e) {
    if (errorArea) { errorArea.classList.remove('hidden'); errorArea.innerText = "⚠️ Сервер просыпается, попробуйте еще раз."; }
  } finally { btn.innerText = "СГЕНЕРИРОВАТЬ ПРОГРАММУ"; btn.disabled = false; }
}

async function loadPlaces() {
  const search = document.getElementById('search_input')?.value || '';
  try {
    const res = await fetch(`${RENDER_API_URL}/places?search=${encodeURIComponent(search)}`);
    const data = await res.json();
    if (typeof renderPlacesList === 'function') renderPlacesList(data.places);
    const counter = document.getElementById('places_counter');
    if (counter) counter.innerText = `Всего мест в базе: ${data.total}`;
  } catch (e) { }
}

async function savePlace() {
  const btn = document.querySelector('button[onclick="savePlace()"]');
  const orig = btn?.innerText;
  const aliasesRaw = document.getElementById('p_aliases')?.value || '';
  const data = {
    slug: document.getElementById('p_slug')?.value.trim() || '', name_ru: document.getElementById('p_name_ru')?.value.trim() || '',
    name_en: document.getElementById('p_name_en')?.value.trim() || '', name_de: document.getElementById('p_name_de')?.value.trim() || '',
    name_hy: document.getElementById('p_name_hy')?.value.trim() || '', desc_ru: document.getElementById('p_desc_ru')?.value.trim() || '',
    desc_en: document.getElementById('p_desc_en')?.value.trim() || '', desc_de: document.getElementById('p_desc_de')?.value.trim() || '',
    desc_hy: document.getElementById('p_desc_hy')?.value.trim() || '', photo_main: document.getElementById('p_img1')?.value.trim() || '',
    aliases: aliasesRaw.split(',').map(a => a.trim()).filter(Boolean)
  };
  if (!data.name_ru || !data.slug) { alert("Заполните Название RU и Slug"); return; }

  btn.disabled = true; btn.innerText = '⏳ Сохраняем...';
  await wakeUpRender();

  const editingId = document.getElementById('editing_id')?.value;
  const url = editingId ? `${RENDER_API_URL}/places/${editingId}` : `${RENDER_API_URL}/places`;

  try {
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) {
      alert("✅ Сохранено!"); if (typeof resetForm === 'function') resetForm(); loadPlaces();
    } else alert("Ошибка сохранения");
  } catch (e) { alert("Сервер недоступен"); }
  btn.disabled = false; btn.innerText = orig;
}

// ДОБАВЛЯЕМ ПСЕВДОНИМЫ ПРИ РЕДАКТИРОВАНИИ
async function editPlace(id) {
  try {
    const res = await fetch(`${RENDER_API_URL}/places`);
    const data = await res.json();
    const place = data.places.find(p => p.id === id);
    if (!place) return;

    document.getElementById('p_slug').value = place.slug || '';
    document.getElementById('p_name_ru').value = place.name_ru || '';
    document.getElementById('p_name_en').value = place.name_en || '';
    document.getElementById('p_name_de').value = place.name_de || '';
    document.getElementById('p_name_hy').value = place.name_hy || '';
    document.getElementById('p_desc_ru').value = place.desc_ru || '';
    document.getElementById('p_desc_en').value = place.desc_en || '';
    document.getElementById('p_desc_de').value = place.desc_de || '';
    document.getElementById('p_desc_hy').value = place.desc_hy || '';

    // ВОТ ТУТ ПСЕВДОНИМЫ СВЯЗЫВАЮТСЯ С ТЕКСТОВЫМ ПОЛЕМ
    document.getElementById('p_aliases').value = place.aliases_str || '';
    document.getElementById('editing_id').value = id;

    if (place.photo_main) {
      document.getElementById('p_img1').value = place.photo_main;
      document.getElementById('img1_url').textContent = place.photo_main;
      document.getElementById('preview_container_1').innerHTML = `<img src="${place.photo_main}" class="photo-preview">`;
    }

    document.querySelector('#place_form h3').textContent = `✏️ Редактировать: ${place.name_ru}`;
    document.getElementById('place_form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { alert(e.message); }
}

async function deletePlace(id) {
  if (!confirm("Вы уверены? Место будет полностью удалено!")) return;
  try {
    const res = await fetch(`${RENDER_API_URL}/places/${id}`, { method: 'DELETE' });
    if (res.ok) loadPlaces();
  } catch (e) { }
}

// Аналитика графиков (Chart.js)
let chartInstance = null;
async function loadAnalytics() {
  try {
    const res = await fetch(`${RENDER_API_URL}/analytics/generations`);
    const data = await res.json();
    if (data.analytics) { window.analyticsData = data.analytics; renderChart(); }
  } catch (e) { }
}

function renderChart() {
  const ctx = document.getElementById('generationsChart');
  if (!ctx || !window.analyticsData) return;
  const filter = document.getElementById('chartFilter')?.value || '30';
  let data = [...window.analyticsData];
  if (filter !== 'all') data = data.slice(-parseInt(filter));

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => { const p = d.date.split('-'); return `${p[2]}.${p[1]}`; }),
      datasets: [{ label: 'Генераций', data: data.map(d => d.count), backgroundColor: '#0891b2', borderRadius: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}
if (typeof Chart !== 'undefined') loadAnalytics();