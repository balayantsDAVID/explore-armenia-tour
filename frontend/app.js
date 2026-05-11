const RAILWAY_API = "https://твой-проект.railway.app"; // ЗАМЕНИ НА СВОЙ

// ГЕНЕРАЦИЯ ТУРА
async function generateTour() {
    const btn = document.getElementById('gen_btn');
    btn.innerText = "ГЕНЕРИРУЮ...";
    btn.disabled = true;

    const payload = {
        prompt: document.getElementById('route_prompt').value,
        lang: document.getElementById('lang').value,
        meta: {
            start: document.getElementById('start_date').value,
            end: document.getElementById('end_date').value,
            flight_in: document.getElementById('flight_in').value,
            flight_out: document.getElementById('flight_out').value,
            guests: document.getElementById('participants').value,
            hotel: document.getElementById('hotel').value,
            contact: document.getElementById('contact').value
        }
    };

    try {
        const response = await fetch(`${RAILWAY_API}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        document.getElementById('result_area').classList.remove('hidden');
        document.getElementById('link_docx').href = data.docx_url;
        document.getElementById('link_pdf').href = data.pdf_url;
    } catch (e) {
        alert("Ошибка связи с сервером Railway");
    } finally {
        btn.innerText = "СГЕНЕРИРОВАТЬ ПРОГРАММУ";
        btn.disabled = false;
    }
}

// СОХРАНЕНИЕ МЕСТА (Admin)
async function savePlace() {
    const data = {
        name: document.getElementById('p_name').value,
        slug: document.getElementById('p_slug').value,
        category: document.getElementById('p_cat').value,
        promo: document.getElementById('p_promo').value,
        images: [document.getElementById('p_img1').value, document.getElementById('p_img2').value]
    };

    const res = await fetch(`${RAILWAY_API}/places`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        alert("Место сохранено!");
        location.reload();
    }
}