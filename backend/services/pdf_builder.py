import os, subprocess, json, re
import requests
from io import BytesIO

DICT = {
    "ru": {"day": "День", "daysStr": "ДНЕЙ", "nightsStr": "НОЧЕЙ", "title": "ПРОГРАММА ТУРА ПО АРМЕНИИ", "slogan": "Армения - страна, в которую можно влюбиться!", "start": "Дата начала тура:", "end": "Дата окончания тура:", "fIn": "Рейс прилета:", "fOut": "Рейс вылета:", "guests": "Количество участников:", "hotel": "Отель:", "contact": "Контактное лицо:", "footer": "стр."},
    # Добавьте другие языки по аналогии
}

def convert_to_pdf(docx_path: str, pdf_path: str, tour_data: dict = None):
    # Пытаемся использовать LibreOffice для идеальной конвертации 1 в 1
    try:
        subprocess.run(["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", os.path.dirname(pdf_path), docx_path], capture_output=True, timeout=30)
        auto_pdf = docx_path.replace('.docx', '.pdf')
        if os.path.exists(auto_pdf):
            if auto_pdf != pdf_path: os.rename(auto_pdf, pdf_path)
            return pdf_path
    except: pass
    
    # Резервный метод через ReportLab
    _make_pdf_reportlab(docx_path, pdf_path, tour_data)
    return pdf_path

def _make_pdf_reportlab(docx_path: str, pdf_path: str, tour_data: dict = None):
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.utils import ImageReader

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

    def draw_header():
        days_count = len(tour_data.get('days', []))
        nights = days_count - 1 if days_count > 1 else 1
        c.setFillColorRGB(0, 0.615, 0.768)
        c.setFont(font_bold, 18)
        c.drawCentredString(w / 2, h - 1.5 * cm, "EXPLORE armenia.am")
        c.setFillColorRGB(0, 0, 0)
        c.setFont(font_bold, 14)
        c.drawCentredString(w / 2, h - 2.2 * cm, t["title"])
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.setFont(font_bold, 11)
        c.drawCentredString(w / 2, h - 2.8 * cm, f"({days_count} {t['daysStr']} / {nights} {t['nightsStr']})")

    def draw_footer(page_num):
        c.setFillColorRGB(0.8, 0, 0)
        c.setFont(font_bold, 11)
        c.drawCentredString(w / 2, 1.8 * cm, t["slogan"])
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.setFont(font_regular, 8)
        c.drawCentredString(w / 2, 1 * cm, f"(+374 91) 01 56 60 (Viber, WhatsApp) | info@explorearmenia.am | www.explorearmenia.am | {t['footer']} {page_num}")

    def wrap_text(text, max_chars=65):
        words = text.split(); lines, line = [], ""
        for word in words:
            if len(line + " " + word) <= max_chars: line = (line + " " + word).strip()
            else:
                if line: lines.append(line)
                line = word
        if line: lines.append(line)
        return lines

    page_num = 1
    draw_header()
    draw_footer(page_num)
    y = h - 4.5 * cm

    # СТРАНИЦА 1: Метаданные
    if tour_data and tour_data.get('meta'):
        meta = tour_data['meta']
        for label, key in [(t["start"], 'start'), (t["end"], 'end'), (t["fIn"], 'flight_in'), (t["fOut"], 'flight_out'), (t["guests"], 'guests'), (t["hotel"], 'hotel'), (t["contact"], 'contact')]:
            c.setFillColorRGB(0, 0, 0)
            c.setFont(font_bold, 11)
            c.drawString(2 * cm, y, label)
            c.setFont(font_regular, 11)
            c.drawString(7.5 * cm, y, str(meta.get(key, '')))
            y -= 22

    # ДНИ ТУРА (Двухколоночный макет)
    if tour_data and tour_data.get('days'):
        for day in tour_data['days']:
            c.showPage(); page_num += 1; draw_header(); draw_footer(page_num); y = h - 4.5 * cm

            # Левая колонка - Картинки
            photos = [p['photo_main'] for p in day.get('places', []) if p.get('photo_main')]
            img_y = y
            for photo_url in photos[:3]:
                try:
                    res = requests.get(photo_url, timeout=5)
                    if res.status_code == 200:
                        img = ImageReader(BytesIO(res.content))
                        c.drawImage(img, 1.5 * cm, img_y - 4 * cm, width=6 * cm, height=4 * cm, preserveAspectRatio=True)
                        img_y -= 4.5 * cm
                except: pass

            # Правая колонка - Текст
            text_x = 8 * cm
            day_title = f"{t['day']} {day.get('day_number', '')} ({day.get('date_str', '')})"
            c.setFillColorRGB(0, 0.615, 0.768)
            c.setFont(font_bold, 13)
            c.drawString(text_x, y, day_title)
            y -= 18

            clean_raw = re.sub(r'^(День|Day|Tag|Օր)\s*\d+\s*[-—–]+\s*', '', day.get('raw_text', ''), flags=re.IGNORECASE)
            c.setFillColorRGB(0, 0, 0)
            c.setFont(font_bold, 11)
            for line in wrap_text(clean_raw, 65):
                c.drawString(text_x, y, line)
                y -= 14
            y -= 10

            c.setFont(font_regular, 10)
            for place in day.get('places', []):
                text = place.get('final_text', '')
                if text:
                    for line in wrap_text(text, 70):
                        if y < 3 * cm: c.showPage(); page_num += 1; draw_header(); draw_footer(page_num); y = h - 4.5 * cm
                        c.drawString(text_x, y, line)
                        y -= 14
                    y -= 10

    c.save()