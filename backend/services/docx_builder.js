// ============================================================
// ExploreArmenia — DOCX Builder v6 (STABLE)
// ============================================================
// ИСПРАВЛЕНО: логотип через ImageRun floating (НЕ VML base64).
// VML base64 внутри <w:pict> ломал DOCX структуру в Word.
//
// HEADER — слои (снизу вверх):
//   VML rect  #deebf7  21.06×3.48 cm  top=0    left=0      z=-4  фон
//   VML rect  #36c6f5  17.21×3.48 cm  top=0    left=3.85   z=-3  синяя полоса
//   VML oval  #FFFFFF   3.35×3.35 cm  top=0.065 left=0.25  z=-2  белый круг
//   ImageRun  logo.png  3.35×3.35 cm  floating anchor       z=10  логотип
//   Paragraph (inline)  26pt белый, indent left=3.85cm       —    заголовок
//
// FOOTER — слои:
//   VML rect  #deebf7  21.06×2.49 cm  top=0    left=0      z=-1  фон
//   Paragraph (inline)  18pt #c10000  слоган
//   Paragraph (inline)  10pt #800000  контакты
//
// РАЗДЕЛИТЕЛЬ ДНЯ:
//   VML rect (inline, без page-relative) #36c6f5  11.53×0.15 cm
// ============================================================

'use strict';

const {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell,
  ImageRun, Header, Footer,
  AlignmentType, BorderStyle, WidthType,
  LevelFormat, VerticalAlign,
  ImportedXmlComponent
} = require('docx');

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ═══════════════════════════════════════════════════════════
// КОНСТАНТЫ
// ═══════════════════════════════════════════════════════════
const FONT = 'Cambria';

const C_LIGHTBLUE = 'deebf7';
const C_CYAN = '36c6f5';
const C_WHITE = 'FFFFFF';
const C_SLOGAN = 'c10000';
const C_CONTACTS = '800000';
const C_BLACK = '000000';

const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 851;
const CONTENT_W = PAGE_W - MARGIN * 2;   // 10204

const COL_PHOTO = Math.round(CONTENT_W * 0.35);   // 3571
const COL_GAP = 200;
const COL_TEXT = CONTENT_W - COL_PHOTO - COL_GAP; // 6433

// ═══════════════════════════════════════════════════════════
// СЛОВАРИ
// ═══════════════════════════════════════════════════════════
const DICT = {
  ru: {
    day: 'День', title: 'ПРОГРАММА ТУРА ПО АРМЕНИИ',
    slogan: 'Армения - страна, в которую можно влюбиться!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp),  info@explorearmenia.am,  www.explorearmenia.am',
    start: 'Дата начала тура:', end: 'Дата окончания тура:',
    fIn: 'Рейсы прилета:', fOut: 'Рейсы вылета:',
    guests: 'Количество участников:', hotel: 'Отель:', contact: 'Контактное лицо:'
  },
  en: {
    day: 'Day', title: 'ARMENIA TOUR PROGRAM',
    slogan: 'Armenia - a country to fall in love with!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp),  info@explorearmenia.am,  www.explorearmenia.am',
    start: 'Tour start date:', end: 'Tour end date:',
    fIn: 'Arrival flight:', fOut: 'Departure flight:',
    guests: 'Number of participants:', hotel: 'Hotel:', contact: 'Contact person:'
  },
  de: {
    day: 'Tag', title: 'ARMENIEN TOURPROGRAMM',
    slogan: 'Armenien - ein Land, in das man sich verlieben kann!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp),  info@explorearmenia.am,  www.explorearmenia.am',
    start: 'Beginn der Tour:', end: 'Ende der Tour:',
    fIn: 'Anflug:', fOut: 'Abflug:',
    guests: 'Teilnehmerzahl:', hotel: 'Hotel:', contact: 'Kontaktperson:'
  },
  hy: {
    day: 'Օր', title: 'ՀԱՅԱUТАНԻ ТУRԻ ԾPAGRAM',
    slogan: 'Հայаuтан - mի երкir, orp kаrелi ek sirayel!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp),  info@explorearmenia.am,  www.explorearmenia.am',
    start: 'Tur meknarкutyan amsativ:', end: 'Turi аvаrtіn аmsatіv:',
    fIn: 'Ժаmanum рейs:', fOut: 'Маекnum рейs:',
    guests: 'Mrtsаkіtsner:', hotel: 'Хndrаnос:', contact: 'Кontaktnayin аndzn:'
  }
};

// ═══════════════════════════════════════════════════════════
// VML ФИГУРЫ (только rect и oval — БЕЗ base64)
// ═══════════════════════════════════════════════════════════

/** VML прямоугольник с абсолютной позицией от края страницы */
function vmlRect(wCm, hCm, color, topCm, leftCm, zIndex) {
  const style = [
    'position:absolute',
    `left:${leftCm}cm`, `top:${topCm}cm`,
    `width:${wCm}cm`, `height:${hCm}cm`,
    `z-index:${zIndex}`,
    'mso-position-horizontal-relative:page',
    'mso-position-vertical-relative:page',
  ].join(';');
  return new ImportedXmlComponent(
    '<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
    ' xmlns:v="urn:schemas-microsoft-com:vml">' +
    '<w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>' +
    '<w:r><w:rPr/><w:pict>' +
    `<v:rect style="${style}" fillcolor="#${color}" stroked="f">` +
    '<v:fill type="solid"/></v:rect>' +
    '</w:pict></w:r></w:p>'
  );
}

/** VML круг с абсолютной позицией от края страницы */
function vmlCircle(dCm, color, topCm, leftCm, zIndex) {
  const style = [
    'position:absolute',
    `left:${leftCm}cm`, `top:${topCm}cm`,
    `width:${dCm}cm`, `height:${dCm}cm`,
    `z-index:${zIndex}`,
    'mso-position-horizontal-relative:page',
    'mso-position-vertical-relative:page',
  ].join(';');
  return new ImportedXmlComponent(
    '<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
    ' xmlns:v="urn:schemas-microsoft-com:vml">' +
    '<w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>' +
    '<w:r><w:rPr/><w:pict>' +
    `<v:oval style="${style}" fillcolor="#${color}" stroked="f">` +
    '<v:fill type="solid"/></v:oval>' +
    '</w:pict></w:r></w:p>'
  );
}

/** VML inline прямоугольник — позиция относительно текста (для разделителя дня) */
function vmlRectInline(wCm, hCm, color) {
  return new ImportedXmlComponent(
    '<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
    ' xmlns:v="urn:schemas-microsoft-com:vml">' +
    '<w:pPr>' +
    '  <w:jc w:val="right"/>' +
    '  <w:spacing w:before="0" w:after="60"/>' +
    '</w:pPr>' +
    '<w:r><w:rPr/><w:pict>' +
    `<v:rect style="width:${wCm}cm;height:${hCm}cm" fillcolor="#${color}" stroked="f">` +
    '<v:fill type="solid"/></v:rect>' +
    '</w:pict></w:r></w:p>'
  );
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF', space: 0 };
const NO_BORDERS_CELL = { top: NB, bottom: NB, left: NB, right: NB };
const NO_BORDERS_TABLE = { top: NB, bottom: NB, left: NB, right: NB, insideH: NB, insideV: NB };

function daysNightsStr(days, lang) {
  const n = days.length, m = Math.max(n - 1, 0);
  if (lang === 'ru') return `(${n} ДНЕЙ / ${m} НОЧЕЙ)`;
  if (lang === 'en') return `(${n} DAYS / ${m} NIGHTS)`;
  if (lang === 'de') return `(${n} TAGE / ${m} NÄCHTE)`;
  return `(${n} / ${m})`;
}

// ═══════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════
function createHeader(t, logoPath, daysNights) {
  const children = [];

  // Фигуры (VML, только цвет — без base64)
  children.push(vmlRect(21.06, 3.48, C_LIGHTBLUE, 0, 0, -4));        // фон
  children.push(vmlRect(17.21, 3.48, C_CYAN, 0, 3.85, -3));     // синяя полоса
  children.push(vmlCircle(3.35, C_WHITE, 0.065, 0.25, -2));          // белый круг

  // Логотип через ImageRun floating (НЕ VML base64 — это было причиной краша)
  if (fs.existsSync(logoPath)) {
    const logoData = fs.readFileSync(logoPath);
    children.push(new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new ImageRun({
          type: 'png',
          data: logoData,
          transformation: { width: 95, height: 95 },   // 3.35 cm = 95 pt
          floating: {
            // 1 cm = 360000 EMU
            horizontalPosition: { offset: 90000 },    // 0.25 cm от левого края
            verticalPosition: { offset: 23400 },    // 0.065 cm от верха
            wrap: { type: 'none' },
            allowOverlap: true,
            lockAnchor: false,
            behindDocument: false,
            zIndex: 10,
          }
        })
      ]
    }));
  }

  // Текст поверх фигур
  // Отступ слева = 3.85 cm ≈ 2183 DXA (ширина зоны логотипа)
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 40 },
    indent: { left: 2183 },
    children: [
      new TextRun({ text: t.title, bold: true, size: 52, font: FONT, color: C_WHITE })
    ]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    indent: { left: 2183 },
    children: [
      new TextRun({ text: daysNights, bold: true, size: 44, font: FONT, color: C_WHITE })
    ]
  }));

  return new Header({ children });
}

// ═══════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════
function createFooter(t) {
  const children = [];

  children.push(vmlRect(21.06, 2.49, C_LIGHTBLUE, 0, 0, -1));  // фон

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 60 },
    children: [
      new TextRun({ text: t.slogan, bold: true, size: 36, font: FONT, color: C_SLOGAN })
    ]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [
      new TextRun({ text: t.contacts, size: 20, font: FONT, color: C_CONTACTS })
    ]
  }));

  return new Footer({ children });
}

// ═══════════════════════════════════════════════════════════
// МЕТАДАННЫЕ
// ═══════════════════════════════════════════════════════════
function buildMetaBlock(meta, t) {
  const fields = [
    [t.start, meta.start],
    [t.end, meta.end],
    [t.fIn, meta.flight_in],
    [t.fOut, meta.flight_out],
    [t.guests, meta.guests],
    [t.hotel, meta.hotel],
    [t.contact, meta.contact],
  ];
  return fields
    .filter(([, v]) => v && String(v).trim())
    .map(([label, val]) => {
      const isHotel = label === t.hotel;
      return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 80 },
        children: [
          new TextRun({ text: label + ' ', bold: true, size: 24, font: FONT, color: C_BLACK }),
          new TextRun({
            text: String(val), bold: isHotel, size: 24, font: FONT,
            color: isHotel ? C_CONTACTS : C_BLACK
          }),
        ]
      });
    });
}

// ═══════════════════════════════════════════════════════════
// СКАЧАТЬ ИЗОБРАЖЕНИЕ
// ═══════════════════════════════════════════════════════════
async function downloadImage(url, destPath) {
  if (!url || !url.trim()) return null;
  return new Promise((resolve) => {
    const proto = url.trim().startsWith('https') ? https : http;
    const req = proto.get(url.trim(), (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => resolve(destPath));
      file.on('error', () => resolve(null));
    });
    req.setTimeout(7000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// ═══════════════════════════════════════════════════════════
// БЛОК ДНЯ
// ═══════════════════════════════════════════════════════════
async function buildDayBlock(day, dayIdx, t, tempDir) {
  const dayNum = day.day_number || (dayIdx + 1);
  const dateStr = day.date_str || '';
  const places = day.places || [];
  const cleanRoute = (day.raw_text || '')
    .replace(/^(День|Day|Tag|Օr)\s*\d+\s*[-—–]+\s*/i, '').trim();

  // ── Правая колонка ──────────────────────────────────────
  const textParas = [];

  // Заголовок: 18pt #800000 RIGHT
  textParas.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 160, after: 60 },
    children: [
      new TextRun({
        text: `${t.day} ${dayNum} (${dateStr})`, bold: true,
        size: 36, font: FONT, color: C_CONTACTS
      })
    ]
  }));

  // Синяя линия-разделитель: VML rect inline 11.53 × 0.15 cm
  textParas.push(vmlRectInline(11.53, 0.15, C_CYAN));

  // Маршрут: 18pt жирный #800000 RIGHT
  textParas.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 60, after: 140 },
    children: [
      new TextRun({
        text: cleanRoute, bold: true,
        size: 36, font: FONT, color: C_CONTACTS
      })
    ]
  }));

  // Буллиты: первое слово жирное, 12pt justified
  for (const place of places) {
    const text = (place.final_text || '').trim();
    if (!text) continue;
    const sp = text.indexOf(' ');
    const fw = sp > -1 ? text.slice(0, sp) : text;
    const rt = sp > -1 ? text.slice(sp + 1) : '';
    textParas.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 100 },
      numbering: { reference: 'bullets', level: 0 },
      children: [
        new TextRun({ text: fw + (rt ? ' ' : ''), bold: true, size: 24, font: FONT, color: C_BLACK }),
        ...(rt ? [new TextRun({ text: rt, bold: false, size: 24, font: FONT, color: C_BLACK })] : [])
      ]
    }));
  }
  if (textParas.length <= 3) {
    textParas.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  // ── Левая колонка: фото ──────────────────────────────────
  const photoParas = [];
  let photoCount = 0;
  for (const place of places) {
    if (photoCount >= 4) break;
    const url = (place.photo_main || '').trim();
    if (!url) continue;
    const fname = `photo_d${dayIdx}_p${photoCount}_${Date.now()}.jpg`;
    const fpath = path.join(tempDir, fname);
    if (await downloadImage(url, fpath) && fs.existsSync(fpath)) {
      const imgPt = Math.round(COL_PHOTO / 20);
      photoParas.push(new Paragraph({
        spacing: { before: 0, after: 120 },
        alignment: AlignmentType.LEFT,
        children: [
          new ImageRun({
            type: 'jpg', data: fs.readFileSync(fpath),
            transformation: { width: imgPt, height: Math.round(imgPt * 0.70) }
          })
        ]
      }));
      photoCount++;
    }
  }
  if (!photoParas.length) {
    photoParas.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  // ── Двухколоночная таблица ───────────────────────────────
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [COL_PHOTO, COL_TEXT],
    borders: NO_BORDERS_TABLE,
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: COL_PHOTO, type: WidthType.DXA }, borders: NO_BORDERS_CELL,
          margins: { top: 0, bottom: 0, left: 0, right: COL_GAP },
          verticalAlign: VerticalAlign.TOP, children: photoParas
        }),
        new TableCell({
          width: { size: COL_TEXT, type: WidthType.DXA }, borders: NO_BORDERS_CELL,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          verticalAlign: VerticalAlign.TOP, children: textParas
        }),
      ]
    })]
  });
}

// ═══════════════════════════════════════════════════════════
// ГЛАВНАЯ ФУНКЦИЯ
// ═══════════════════════════════════════════════════════════
async function buildDocument(inputJsonPath, outputDocxPath) {
  const raw = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const lang = raw.lang || 'ru';
  const t = DICT[lang] || DICT.ru;
  const meta = raw.meta || {};
  const days = raw.days || [];
  const tempDir = path.dirname(outputDocxPath);
  const logoPath = path.join(__dirname, 'logo.png');

  const docChildren = [];
  docChildren.push(...buildMetaBlock(meta, t));
  docChildren.push(new Paragraph({ spacing: { before: 240, after: 240 }, children: [] }));

  for (let i = 0; i < days.length; i++) {
    docChildren.push(await buildDayBlock(days[i], i, t, tempDir));
    docChildren.push(new Paragraph({ spacing: { before: 120, after: 120 }, children: [] }));
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullets', levels: [{
          level: 0, format: LevelFormat.BULLET, text: '\u2022',
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 360, hanging: 360 }, spacing: { after: 80 } },
            run: { font: FONT, size: 24 }
          }
        }]
      }]
    },
    styles: { default: { document: { run: { font: FONT, size: 24, color: C_BLACK } } } },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: {
            top: 2200,   // 3.48 cm header + gap
            bottom: 1700,   // 2.49 cm footer + gap
            left: MARGIN,
            right: MARGIN,
            header: 0,      // прибить к краю
            footer: 0,      // прибить к краю
          }
        }
      },
      headers: { default: createHeader(t, logoPath, daysNightsStr(days, lang)) },
      footers: { default: createFooter(t) },
      children: docChildren,
    }]
  });

  fs.writeFileSync(outputDocxPath, await Packer.toBuffer(doc));
  console.log(`✅ DOCX создан: ${outputDocxPath}`);
}

// ═══════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════
const [, , inputPath, outputPath] = process.argv;
if (inputPath && outputPath) {
  buildDocument(inputPath, outputPath)
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
} else {
  console.error('Использование: node docx_builder.js <input.json> <output.docx>');
  process.exit(1);
}