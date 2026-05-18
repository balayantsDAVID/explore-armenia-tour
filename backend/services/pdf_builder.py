import os, subprocess, json, re

DICT = {
    "ru": {"day": "День", "title": "ПРОГРАММА ТУРА ПО АРМЕНИИ", "slogan": "Армения - страна, в которую можно влюбиться!", "start": "Дата начала тура:", "end": "Дата окончания тура:", "fIn": "Рейс прилета:", "fOut": "Рейс вылета:", "guests": "Количество участников:", "hotel": "Отель:", "contact": "Контактное лицо:"},
    "en": {"day": "Day", "title": "ARMENIA TOUR PROGRAM", "slogan": "Armenia - a country to fall in love with!", "start": "Tour start date:", "end": "Tour end date:", "fIn": "Arrival flight:", "fOut": "Departure flight:", "guests": "Number of participants:", "hotel": "Hotel:", "contact": "Contact person:"},
    "de": {"day": "Tag", "title": "TOURPROGRAMM IN ARMENIEN", "slogan": "Armenien - ein Land zum Verlieben!", "start": "Tourstartdatum:", "end": "Tourenddatum:", "fIn": "Ankunftsflug:", "fOut": "Abflug:", "guests": "Teilnehmerzahl:", "hotel": "Hotel:", "contact": "Ansprechpartner:"},
    "hy": {"day": "Օր", "title": "ՏՈՒՐԻ ԾՐԱԳԻՐ ՀԱՅԱՍՏԱՆՈՒՄ", "slogan": "Հայաստան՝ երկիր, որին կարելի է սիրահարվել։", "start": "Տուրի սկիզբ՝", "end": "Տուրի ավարտ՝", "fIn": "Ժամանման չվերթ՝", "fOut": "Մեկնման չվերթ՝", "guests": "Մասնակիցների քանակ՝", "hotel": "Հյուրանոց՝", "contact": "Կոնտակտային անձ՝"}
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
        c.setFillColorRGB(0, 0.667, 0.8)
        c.rect(0, h - 55, w, 55, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.setFont(font_bold, 15)
        c.drawCentredString(w / 2, h - 36, t["title"])

    def draw_footer():
        c.setFillColorRGB(0.8, 0, 0)
        c.setFont(font_bold, 10)
        c.drawCentredString(w / 2, 28, t["slogan"])
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.setFont(font_regular, 8)
        c.drawCentredString(w / 2, 16, "(+374 91) 01 56 60 | info@explorearmenia.am | www.explorearmenia.am")

    def wrap_text(text, max_chars=90):
        words = text.split(); lines, line = [], ""
        for word in words:
            if len(line + " " + word) <= max_chars: line = (line + " " + word).strip()
            else:
                if line: lines.append(line)
                line = word
        if line: lines.append(line)
        return lines

    draw_header()
    draw_footer()
    y = h - 80

    if tour_data and tour_data.get('meta'):
        meta = tour_data['meta']
        for label, key in [(t["start"], 'start'), (t["end"], 'end'), (t["fIn"], 'flight_in'), (t["fOut"], 'flight_out'), (t["guests"], 'guests'), (t["hotel"], 'hotel'), (t["contact"], 'contact')]:
            c.setFillColorRGB(0, 0, 0)
            c.setFont(font_bold, 11)
            c.drawString(2 * cm, y, label)
            c.setFont(font_regular, 11)
            c.drawString(8 * cm, y, str(meta.get(key, '')))
            y -= 22

    if tour_data and tour_data.get('days'):
        for day in tour_data['days']:
            c.showPage()
            draw_header(); draw_footer(); y = h - 72

            day_title = f"{t['day']} {day.get('day_number', '')} ({day.get('date_str', '')})"
            c.setFillColorRGB(0, 0.2, 0.4)
            c.setFont(font_bold, 14)
            c.drawCentredString(w / 2, y, day_title)
            y -= 18

            clean_raw = re.sub(r'^(День|Day|Tag|Օր)\s*\d+\s*[-—–]+\s*', '', day.get('raw_text', ''), flags=re.IGNORECASE)
            c.setFillColorRGB(0, 0.615, 0.768)
            c.setFont(font_bold, 12)
            for line in wrap_text(clean_raw, 80):
                c.drawCentredString(w / 2, y, line)
                y -= 14
            y -= 10

            for place in day.get('places', []):
                text = place.get('final_text', '')
                if text and text.strip():
                    if y < 50: c.showPage(); draw_header(); draw_footer(); y = h - 72
                    c.setFillColorRGB(0.15, 0.15, 0.15)
                    c.setFont(font_regular, 9)
                    for line in wrap_text(text, 95):
                        if y < 50: c.showPage(); draw_header(); draw_footer(); y = h - 72
                        c.drawString(1.5 * cm, y, line)
                        y -= 12
                    y -= 8
    c.save()