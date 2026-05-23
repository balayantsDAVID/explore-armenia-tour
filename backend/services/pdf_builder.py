import os, json, re, requests
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors

DICT = {
    "ru": {"day": "День", "title": "ПРОГРАММА ТУРА ПО АРМЕНИИ", "slogan": "Армения - страна, в которую можно влюбиться!", "start": "Дата начала тура:", "end": "Дата окончания тура:", "fIn": "Рейс прилета:", "fOut": "Рейс вылета:", "guests": "Количество участников:", "hotel": "Отель:", "contact": "Контактное лицо:"},
    "en": {"day": "Day", "title": "ARMENIA TOUR PROGRAM", "slogan": "Armenia - a country to fall in love with!", "start": "Tour start date:", "end": "Tour end date:", "fIn": "Arrival flight:", "fOut": "Departure flight:", "guests": "Number of participants:", "hotel": "Hotel:", "contact": "Contact person:"},
}

# ВАЖНО: Эта функция вызывает сборщик. Из-за ее отсутствия была ошибка 500.
def convert_to_pdf(docx_path: str, pdf_path: str, tour_data: dict = None):
    _make_pdf_reportlab(docx_path, pdf_path, tour_data)
    return pdf_path

def _make_pdf_reportlab(docx_path: str, pdf_path: str, tour_data: dict = None):
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

    # Стили текста (размеры 12 и 18)
    styles = getSampleStyleSheet()
    style_main = ParagraphStyle('Main', fontName=font_regular, fontSize=12, leading=16, alignment=0)
    style_bold = ParagraphStyle('MainBold', fontName=font_bold, fontSize=12, leading=16)
    style_title = ParagraphStyle('Title', fontName=font_bold, fontSize=18, leading=22, alignment=1, textColor=colors.HexColor('#003366'))
    style_day = ParagraphStyle('DayTitle', fontName=font_bold, fontSize=14, leading=18, textColor=colors.HexColor('#003366'))
    
    doc = SimpleDocTemplate(pdf_path, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=3*cm, bottomMargin=3*cm)
    story = []

    # ЛОГОТИП И ШАПКА
    if os.path.exists('logo.png'):
        story.append(RLImage('logo.png', width=6*cm, height=2*cm))
    story.append(Paragraph(t["title"], style_title))
    story.append(Spacer(1, 0.5*cm))

    # БЛОК МЕТАДАННЫХ (идет сплошным потоком, без разрыва страницы)
    if tour_data and tour_data.get('meta'):
        meta = tour_data['meta']
        for label, key in [(t["start"], 'start'), (t["end"], 'end'), (t["fIn"], 'flight_in'), (t["fOut"], 'flight_out'), (t["guests"], 'guests'), (t["hotel"], 'hotel'), (t["contact"], 'contact')]:
            val = meta.get(key, '')
            story.append(Paragraph(f"<b>{label}</b> {val}", style_main))
        story.append(Spacer(1, 1*cm))

    # ДНИ ТУРА (Двухколоночный макет)
    if tour_data and tour_data.get('days'):
        for day in tour_data['days']:
            day_title = f"{t['day']} {day.get('day_number', '')} ({day.get('date_str', '')})"
            clean_raw = re.sub(r'^(День|Day|Tag|Օր)\s*\d+\s*[-—–]+\s*', '', day.get('raw_text', ''), flags=re.IGNORECASE)
            
            # Левая колонка (фотографии)
            left_col = []
            photos = [p['photo_main'] for p in day.get('places', []) if p.get('photo_main')]
            for photo_url in photos[:3]:
                try:
                    res = requests.get(photo_url, timeout=5)
                    if res.status_code == 200:
                        img = RLImage(BytesIO(res.content), width=5.5*cm, height=3.5*cm)
                        left_col.append(img)
                        left_col.append(Spacer(1, 0.3*cm))
                except: pass

            # Правая колонка (текст)
            right_col = [Paragraph(day_title, style_day), Spacer(1, 0.2*cm), Paragraph(f"<b>{clean_raw}</b>", style_bold), Spacer(1, 0.3*cm)]
            for place in day.get('places', []):
                text = place.get('final_text', '')
                if text:
                    # Выделяем первое слово жирным
                    words = text.split(' ')
                    first_word = words.pop(0)
                    rest_text = ' '.join(words)
                    right_col.append(Paragraph(f"• <b>{first_word}</b> {rest_text}", style_main))
                    right_col.append(Spacer(1, 0.2*cm))

            table_data = [[left_col, right_col]]
            t_style = TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('LEFTPADDING', (0,0), (-1,-1), 0), ('RIGHTPADDING', (0,0), (-1,-1), 0)])
            story.append(Table(table_data, colWidths=[6*cm, 12*cm], style=t_style))
            story.append(Spacer(1, 0.7*cm))

    # КОЛОНТИТУЛЫ (на каждой странице)
    def add_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(font_bold, 11)
        canvas.setFillColorRGB(0.8, 0, 0)
        canvas.drawCentredString(A4[0]/2, 1.8*cm, t["slogan"])
        canvas.setFont(font_regular, 9)
        canvas.setFillColorRGB(0.4, 0.4, 0.4)
        canvas.drawCentredString(A4[0]/2, 1*cm, f"(+374 91) 01 56 60 (Viber, WhatsApp) | info@explorearmenia.am | www.explorearmenia.am | стр. {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)