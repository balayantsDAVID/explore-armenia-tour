// ============================================================
// ExploreArmenia — DOCX Builder v4
// ============================================================
// ТОЧНЫЕ РАЗМЕРЫ (по ТЗ):
//
// HEADER (1 строка таблицы на всю ширину A4 = 11906 DXA):
//   Высота строки:       3.48 cm = 1973 DXA    фон: #deebf7
//   Левая ячейка:        3.85 cm = 2183 DXA    фон: #deebf7  — логотип 3.35cm×3.35cm оригинал
//   Правая ячейка:       остаток = 9723 DXA    фон: #36c6f5  — текст 26pt белый
//
// РАЗДЕЛИТЕЛЬ ДНЯ:
//   Высота: 0.15 cm, ширина = правая колонка (~11.35 cm), цвет: #36c6f5
//
// FOOTER (таблица на всю ширину A4):
//   Высота: 2.49 cm = 1412 DXA    фон: #deebf7
//   Слоган: 18pt, цвет #c10000
//   Контакты: 10pt, цвет #800000  (без номера страницы)
// ============================================================

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, LevelFormat, VerticalAlign, TableRowHeight, HeightRule
} = require('docx');

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─────────────────────────────────────────────
// ШРИФТ
// ─────────────────────────────────────────────
const FONT = 'Cambria';

// ─────────────────────────────────────────────
// ЦВЕТА (HEX без #)
// ─────────────────────────────────────────────
const C_LIGHTBLUE = 'deebf7';  // фон хедера и футера
const C_CYAN = '36c6f5';  // фон правой части хедера + линия дня
const C_SLOGAN = 'c10000';  // слоган в футере
const C_CONTACTS = '800000';  // контакты в футере + заголовки дней
const C_WHITE = 'FFFFFF';
const C_BLACK = '000000';

// ─────────────────────────────────────────────
// РАЗМЕРЫ (DXA: 1 дюйм = 1440 DXA, 1 cm ≈ 567 DXA)
// ─────────────────────────────────────────────
const PAGE_W = 11906;  // A4 ширина
const PAGE_H = 16838;  // A4 высота
const MARGIN = 851;    // поля ~1.5 cm

// Контентная ширина (с полями)
const CONTENT_W = PAGE_W - MARGIN * 2;  // 10204 DXA

// HEADER
const HDR_ROW_H = 1973;   // 3.48 cm — высота всей строки хедера
const HDR_LOGO_W = 2183;   // 3.85 cm — ширина ячейки с логотипом (круг 3.35 + padding)
const HDR_TITLE_W = PAGE_W - HDR_LOGO_W;  // 9723 DXA — ширина ячейки с заголовком
const LOGO_SIZE = 95;     // 3.35 cm = 95 pt — размер логотипа

// Колонки дней: 35% фото / 65% текст
const COL_PHOTO = Math.round(CONTENT_W * 0.35);   // 3571 DXA
const GAP = 200;                              // разрыв между колонками
const COL_TEXT_W = CONTENT_W - COL_PHOTO - GAP;    // 6433 DXA

// FOOTER
const FTR_ROW_H = 1412;   // 2.49 cm

// ─────────────────────────────────────────────
// СЛОВАРЬ
// ─────────────────────────────────────────────
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
    day: 'Օր', title: 'ՀԱՅԱUТАНԻ TUРԻ ԾPAGRAM',
    slogan: 'Հայաuтан - mի երкir, orp kаrелi ek sirayel!',
    contacts: '(+374 91) 01 56 60 (Viber, WhatsApp),  info@explorearmenia.am,  www.explorearmenia.am',
    start: 'Tuри meknarкutyan аmsatіv:', end: 'Turi аvаrtіn аmsatіv:',
    fIn: 'Ժаmanum рейs:', fOut: 'Маекnum рейs:',
    guests: 'Mrtsаkіtsner:', hotel: 'Хndrаnос:', contact: 'Кontaktnayin аndzn:'
  }
};

// ─────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ─────────────────────────────────────────────

/** Невидимая граница */
function nb() {
  return { style: BorderStyle.NONE, size: 0, color: 'FFFFFF', space: 0 };
}

/** Все 4 границы ячейки — невидимые */
function noBorders() {
  return { top: nb(), bottom: nb(), left: nb(), right: nb() };
}

/** Все 6 границ таблицы — невидимые */
function noTableBorders() {
  return { top: nb(), bottom: nb(), left: nb(), right: nb(), insideH: nb(), insideV: nb() };
}

/** Скачать изображение по URL */
async function downloadImage(url, destPath) {
  if (!url || !url.trim()) return null;
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http;
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

/** «N ДНЕЙ / M НОЧЕЙ» по языку */
function daysNightsStr(days, lang) {
  const n = days.length, m = Math.max(n - 1, 0);
  if (lang === 'ru') return `(${n} ДНЕЙ / ${m} НОЧЕЙ)`;
  if (lang === 'en') return `(${n} DAYS / ${m} NIGHTS)`;
  if (lang === 'de') return `(${n} TAGE / ${m} NÄCHTE)`;
  return `(${n} / ${m})`;
}

// ─────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────
// Структура: таблица на ПОЛНУЮ ширину страницы (PAGE_W = 11906 DXA),
// 1 строка фиксированной высоты HDR_ROW_H:
//   Левая ячейка  (HDR_LOGO_W):  фон #deebf7, логотип 95×95pt по центру
//   Правая ячейка (HDR_TITLE_W): фон #36c6f5, текст 26pt белый по центру
//
function createHeader(t, logoPath, daysNights) {
  const logoExists = fs.existsSync(logoPath);

  // ── Левая ячейка: логотип ──────────────────────────────────────
  const logoContent = logoExists
    ? new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [
        new ImageRun({
          type: 'png',
          data: fs.readFileSync(logoPath),
          // Вставляем оригинал 3.35 cm × 3.35 cm = 95 pt × 95 pt
          transformation: { width: LOGO_SIZE, height: LOGO_SIZE }
        })
      ]
    })
    : new Paragraph({ children: [new TextRun({ text: '' })] });

  const leftCell = new TableCell({
    width: { size: HDR_LOGO_W, type: WidthType.DXA },
    borders: noBorders(),
    shading: { fill: C_LIGHTBLUE, type: ShadingType.CLEAR },
    margins: { top: 40, bottom: 40, left: 160, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [logoContent],
  });

  // ── Правая ячейка: заголовок ───────────────────────────────────
  const titlePara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 20 },
    children: [
      new TextRun({
        text: t.title,
        bold: true,
        size: 52,   // 26pt (в DOCX size = half-points, 26*2=52)
        font: FONT,
        color: C_WHITE,
      })
    ]
  });

  const subtitlePara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 40 },
    children: [
      new TextRun({
        text: daysNights,
        bold: true,
        size: 44,   // 22pt
        font: FONT,
        color: C_WHITE,
      })
    ]
  });

  const rightCell = new TableCell({
    width: { size: HDR_TITLE_W, type: WidthType.DXA },
    borders: noBorders(),
    shading: { fill: C_CYAN, type: ShadingType.CLEAR },
    margins: { top: 40, bottom: 40, left: 240, right: 160 },
    verticalAlign: VerticalAlign.CENTER,
    children: [titlePara, subtitlePara],
  });

  // ── Таблица-шапка ──────────────────────────────────────────────
  const headerTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [HDR_LOGO_W, HDR_TITLE_W],
    borders: noTableBorders(),
    rows: [
      new TableRow({
        // Фиксированная высота строки 3.48 cm
        height: { value: HDR_ROW_H, rule: HeightRule.EXACT },
        children: [leftCell, rightCell],
      })
    ]
  });

  return new Header({
    children: [
      new Paragraph({ spacing: { before: 0, after: 0 }, children: [] }),
      headerTable,
    ]
  });
}

// ─────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────
// Таблица на полную ширину, 1 строка высотой 2.49 cm, фон #deebf7.
// Внутри по центру:
//   Слоган:   18pt, цвет #c10000
//   Контакты: 10pt, цвет #800000  (без номера страницы)
//
function createFooter(t) {
  const sloganPara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 30 },
    children: [
      new TextRun({
        text: t.slogan,
        bold: true,
        size: 36,   // 18pt
        font: FONT,
        color: C_SLOGAN,
      })
    ]
  });

  const contactsPara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60 },
    children: [
      new TextRun({
        text: t.contacts,
        size: 20,   // 10pt
        font: FONT,
        color: C_CONTACTS,
      })
    ]
  });

  const footerCell = new TableCell({
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: noBorders(),
    shading: { fill: C_LIGHTBLUE, type: ShadingType.CLEAR },
    margins: { top: 40, bottom: 40, left: 200, right: 200 },
    verticalAlign: VerticalAlign.CENTER,
    children: [sloganPara, contactsPara],
  });

  const footerTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [PAGE_W],
    borders: noTableBorders(),
    rows: [
      new TableRow({
        height: { value: FTR_ROW_H, rule: HeightRule.ATLEAST },
        children: [footerCell],
      })
    ]
  });

  return new Footer({
    children: [
      new Paragraph({ spacing: { before: 0, after: 0 }, children: [] }),
      footerTable,
    ]
  });
}

// ─────────────────────────────────────────────
// БЛОК МЕТАДАННЫХ
// ─────────────────────────────────────────────
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

  const paras = [];
  for (const [label, val] of fields) {
    if (!val || !String(val).trim()) continue;

    const valueRun = (label === t.hotel)
      // Отель: жирный, тёмно-красный
      ? new TextRun({ text: String(val), bold: true, size: 24, font: FONT, color: C_CONTACTS })
      : new TextRun({ text: String(val), size: 24, font: FONT, color: C_BLACK });

    paras.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({ text: label + ' ', bold: true, size: 24, font: FONT, color: C_BLACK }),
        valueRun,
      ]
    }));
  }
  return paras;
}

// ─────────────────────────────────────────────
// БЛОК ОДНОГО ДНЯ
// ─────────────────────────────────────────────
// Правая колонка:
//   Заголовок «День N (дд.мм, день)»: 18pt, #800000, RIGHT
//   Линия #36c6f5: 0.15cm × ширина правой колонки
//   Маршрут: 18pt жирный, #800000, RIGHT
//   Буллиты: 12pt, Cambria, justified
// Левая колонка: фотографии
//
async function buildDayBlock(day, dayIndex, t, tempDir) {
  const dayNum = day.day_number || (dayIndex + 1);
  const dateStr = day.date_str || '';
  const rawText = day.raw_text || '';
  const places = day.places || [];

  const cleanRoute = rawText
    .replace(/^(День|Day|Tag|Օr)\s*\d+\s*[-—–]+\s*/i, '')
    .trim();

  // ── Правая колонка: текст ──────────────────────────────────────
  const textParas = [];

  // Заголовок дня: 18pt, #800000, RIGHT
  textParas.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 160, after: 40 },
    children: [
      new TextRun({
        text: `${t.day} ${dayNum} (${dateStr})`,
        bold: true,
        size: 36,   // 18pt
        font: FONT,
        color: C_CONTACTS,  // #800000
      })
    ]
  }));

  // Линия-разделитель #36c6f5: высота 0.15cm через border bottom параграфа
  // Ширина = ширина правой колонки (параграф занимает всю ячейку)
  textParas.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 0, after: 40 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 12,         // 12 eighths-of-pt ≈ 1.5pt ≈ 0.05cm — используем толстую линию
        color: C_CYAN,    // #36c6f5
        space: 1,
      }
    },
    children: [new TextRun({ text: '', size: 4 })]   // пустой, только линия
  }));

  // Маршрут: 18pt жирный, #800000, RIGHT
  textParas.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 40, after: 120 },
    children: [
      new TextRun({
        text: cleanRoute,
        bold: true,
        size: 36,   // 18pt
        font: FONT,
        color: C_CONTACTS,  // #800000
      })
    ]
  }));

  // Буллиты: первое слово жирное, остальное обычное, 12pt
  for (const place of places) {
    const text = (place.final_text || '').trim();
    if (!text) continue;

    const spaceIdx = text.indexOf(' ');
    const firstWord = spaceIdx > -1 ? text.slice(0, spaceIdx) : text;
    const restText = spaceIdx > -1 ? text.slice(spaceIdx + 1) : '';

    textParas.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 100 },
      numbering: { reference: 'bullets', level: 0 },
      children: [
        new TextRun({ text: firstWord + ' ', bold: true, size: 24, font: FONT, color: C_BLACK }),
        ...(restText ? [new TextRun({ text: restText, size: 24, font: FONT, color: C_BLACK })] : [])
      ]
    }));
  }

  if (textParas.length <= 3) {
    textParas.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  // ── Левая колонка: фотографии ──────────────────────────────────
  const photoParas = [];
  let photoCount = 0;

  for (const place of places) {
    if (photoCount >= 4) break;
    const url = (place.photo_main || '').trim();
    if (!url) continue;

    const fname = `photo_d${dayIndex}_p${photoCount}_${Date.now()}.jpg`;
    const fpath = path.join(tempDir, fname);
    const ok = await downloadImage(url, fpath);

    if (ok && fs.existsSync(fpath)) {
      const imgPt = Math.round(COL_PHOTO / 20);       // pt (DXA/20 ≈ pt)
      const imgHeightPt = Math.round(imgPt * 0.70);       // 3:2 пропорция

      photoParas.push(new Paragraph({
        spacing: { before: 0, after: 120 },
        alignment: AlignmentType.LEFT,
        children: [
          new ImageRun({
            type: 'jpg',
            data: fs.readFileSync(fpath),
            transformation: { width: imgPt, height: imgHeightPt }
          })
        ]
      }));
      photoCount++;
    }
  }

  if (photoParas.length === 0) {
    photoParas.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  // ── Двухколоночная таблица ─────────────────────────────────────
  const leftCell = new TableCell({
    width: { size: COL_PHOTO, type: WidthType.DXA },
    borders: noBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: GAP },
    verticalAlign: VerticalAlign.TOP,
    children: photoParas,
  });

  const rightCell = new TableCell({
    width: { size: COL_TEXT_W, type: WidthType.DXA },
    borders: noBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlign.TOP,
    children: textParas,
  });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [COL_PHOTO, COL_TEXT_W],
    borders: noTableBorders(),
    rows: [new TableRow({ children: [leftCell, rightCell] })]
  });
}

// ─────────────────────────────────────────────
// ГЛАВНАЯ ФУНКЦИЯ
// ─────────────────────────────────────────────
async function buildDocument(inputJsonPath, outputDocxPath) {
  const raw = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const lang = raw.lang || 'ru';
  const t = DICT[lang] || DICT.ru;
  const meta = raw.meta || {};
  const days = raw.days || [];
  const tempDir = path.dirname(outputDocxPath);

  // Логотип рядом со скриптом
  const logoPath = path.join(__dirname, 'logo.png');

  const daysNights = daysNightsStr(days, lang);

  // ── Собираем контент документа ─────────────────────────────────
  const docChildren = [];

  // 1. Метаданные тура (без разрыва страниц)
  docChildren.push(...buildMetaBlock(meta, t));
  docChildren.push(new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }));

  // 2. Дни
  for (let i = 0; i < days.length; i++) {
    const dayTable = await buildDayBlock(days[i], i, t, tempDir);
    docChildren.push(dayTable);
    docChildren.push(new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }));
  }

  // ── Создаём документ ──────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 360, hanging: 360 }, spacing: { after: 80 } },
              run: { font: FONT, size: 24 }
            }
          }]
        }
      ]
    },
    styles: {
      default: {
        document: { run: { font: FONT, size: 24, color: C_BLACK } }
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: {
            top: MARGIN,
            bottom: 1800,   // ~3.2cm место под футер
            left: MARGIN,
            right: MARGIN,
            header: 0,
            footer: 300,
          }
        }
      },
      headers: { default: createHeader(t, logoPath, daysNights) },
      footers: { default: createFooter(t) },
      children: docChildren,
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocxPath, buffer);
  console.log(`✅ DOCX создан: ${outputDocxPath}`);
}

// ─────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────
const [, , inputPath, outputPath] = process.argv;

if (inputPath && outputPath) {
  buildDocument(inputPath, outputPath)
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
} else {
  console.error('Использование: node docx_builder.js <input.json> <output.docx>');
  process.exit(1);
}