import os, subprocess, json, re

DICT = {
    "ru": {"day": "День", "title": "ПРОГРАММА ТУРА ПО АРМЕНИИ", "slogan": "Армения - страна, в которую можно влюбиться!", "start": "Дата начала тура:", "end": "Дата окончания тура:", "fIn": "Рейс прилета:", "fOut": "Рейс вылета:", "guests": "Количество участников:", "hotel": "Отель:", "contact": "Контактное лицо:", "footer": "стр."},
    "en": {"day": "Day", "title": "ARMENIA TOUR PROGRAM", "slogan": "Armenia - a country to fall in love with!", "start": "Tour start date:", "end": "Tour end date:", "fIn": "Arrival flight:", "fOut": "Departure flight:", "guests": "Number of participants:", "hotel": "Hotel:", "contact": "Contact person:", "footer": "page"}
}

def convert_to_pdf(docx_path: str, pdf_path: str, tour_data: dict = None):
    try:
        subprocess.run(["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", os.path.dirname(pdf_path), docx_path], capture_output=True, timeout=30)
        auto_pdf = docx_path.replace('.docx', '.pdf')
        if os.path.exists(auto_pdf):
            if auto_pdf != pdf_path: os.rename(auto_pdf, pdf_path)
            return pdf_path
    except: pass
    _make_pdf_reportlab(docx_path, pdf_path, tour_data)
    return pdf_path

def _make_pdf_reportlab(docx_path: str, pdf_path: str, tour_data: dict = None):
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.utils import ImageReader
    import requests
    from io import BytesIO

    if tour_data is None:
        input_json = docx_path.replace('.docx', '_input.json')
        if os.path.exists(input_json):
            with open(input_json, 'r', encoding='utf-8') as f: tour_data = json.load(f)

    lang = tour_data.get('lang', 'ru') if tour_data else 'ru'
    t = DICT.get(lang, DICT['ru'])

    font_regular, font_bold = 'Helvetica', 'Helvetica-Bold'
    for path in ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(path): pdfmetrics.registerFont(TTFont('DejaVu', path)); font_regular = 'DejaVu'; break
    for path in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"]:
        if os.path.exists(path): pdfmetrics.registerFont(TTFont('DejaVuBold', path)); font_bold = 'DejaVuBold'; break

    w, h = A4
    c = canvas.Canvas(pdf_path, pagesize=A4)

    def draw_footer(page_num):
        c.setFillColorRGB(0.8, 0, 0)
        c.setFont(font_bold, 12)
        c.drawCentredString(w / 2, 40, t["slogan"])
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.setFont(font_regular, 9)
        c.drawCentredString(w / 2, 25, f"(+374 91) 01 56 60 (Viber, WhatsApp) | info@explorearmenia.am | www.explorearmenia.am | {t['footer']} {page_num}")

    def wrap_text(text, max_chars=90):
        words = text.split(); lines, line = [], ""
        for word in words:
            if len(line + " " + word) <= max_chars: line = (line + " " + word).strip()
            else:
                if line: lines.append(line)
                line = word
        if line: lines.append(line)
        return lines

    page_num = 1
    
    # СТРАНИЦА 1
    c.setFillColorRGB(0, 0.2, 0.4)
    c.setFont(font_bold, 18)
    c.drawCentredString(w / 2, h - 3 * cm, "EXPLORE armenia.am")
    
    c.setFillColorRGB(0, 0, 0)
    c.setFont(font_bold, 16)
    c.drawCentredString(w / 2, h - 4.5 * cm, t["title"])
    
    days_count = len(tour_data.get('days', []))
    nights = days_count - 1 if days_count > 1 else 1
    c.setFillColorRGB(0.4, 0.4, 0.4)
    c.setFont(font_bold, 12)
    c.drawCentredString(w / 2, h - 5.5 * cm, f"({days_count} ДНЕЙ / {nights} НОЧЕЙ)")

    y = h - 7 * cm
    if tour_data and tour_data.get('meta'):
        meta = tour_data['meta']
        for label, key in [(t["start"], 'start'), (t["end"], 'end'), (t["fIn"], 'flight_in'), (t["fOut"], 'flight_out'), (t["guests"], 'guests'), (t["hotel"], 'hotel'), (t["contact"], 'contact')]:
            c.setFillColorRGB(0, 0, 0)
            c.setFont(font_bold, 11)
            c.drawString(2 * cm, y, label)
            c.setFont(font_regular, 11)
            c.drawString(8 * cm, y, str(meta.get(key, '')))
            y -= 22

    draw_footer(page_num)

    # ДНИ ТУРА
    if tour_data and tour_data.get('days'):
        for day in tour_data['days']:
            c.showPage(); page_num += 1; draw_footer(page_num); y = h - 3 * cm

            # Заголовок дня
            day_title = f"{t['day']} {day.get('day_number', '')} ({day.get('date_str', '')})"
            c.setFillColorRGB(0, 0.2, 0.4)
            c.setFont(font_bold, 14)
            c.drawString(2 * cm, y, day_title)
            y -= 20

            # Подзаголовок (Маршрут)
            clean_raw = re.sub(r'^(День|Day|Tag|Օր)\s*\d+\s*[-—–]+\s*', '', day.get('raw_text', ''), flags=re.IGNORECASE)
            c.setFillColorRGB(0, 0, 0)
            c.setFont(font_bold, 12)
            for line in wrap_text(clean_raw, 80):
                c.drawString(2 * cm, y, line)
                y -= 16
            y -= 10

            # Скачивание и вставка фото
            photos = [p['photo_main'] for p in day.get('places', []) if p.get('photo_main')]
            if photos:
                img_w = 6 * cm; img_h = 4 * cm
                if y - img_h < 4 * cm:
                    c.showPage(); page_num += 1; draw_footer(page_num); y = h - 3 * cm
                
                for idx, photo_url in enumerate(photos[:2]):
                    try:
                        res = requests.get(photo_url, timeout=5)
                        if res.status_code == 200:
                            img = ImageReader(BytesIO(res.content))
                            c.drawImage(img, 2 * cm + idx * (img_w + 0.5 * cm), y - img_h, width=img_w, height=img_h, preserveAspectRatio=True)
                    except: pass
                y -= (img_h + 15)

            # Описания из базы
            c.setFont(font_regular, 10)
            c.setFillColorRGB(0, 0, 0)
            for place in day.get('places', []):
                text = place.get('final_text', '')
                if text:
                    for line in wrap_text(text, 95):
                        if y < 4 * cm:
                            c.showPage(); page_num += 1; draw_footer(page_num); y = h - 3 * cm
                        c.drawString(2 * cm, y, line)
                        y -= 14
                    y -= 10
    c.save()