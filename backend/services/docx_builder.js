// ============================================================
// ExploreArmenia — DOCX Builder (Final Version)
// ============================================================

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType, PageNumber
} = require('docx');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ============================================================
// Константы и настройки
// ============================================================
const COLORS = {
  red: "CC0000",
  cyan: "009DC4",
  black: "000000",
  gray: "555555",
  darkBlue: "003366"
};
const FONT = "Cambria";

// Размеры A4 в формате DXA
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 851; // ~1.5cm

const DICT = {
  ru: {
    day: "День", title: "ПРОГРАММА ТУРА ПО АРМЕНИИ", slogan: "Армения - страна, в которую можно влюбиться!",
    start: "Дата начала тура:", end: "Дата окончания тура:", fIn: "Рейс прилета:", fOut: "Рейс вылета:",
    guests: "Количество участников:", hotel: "Отель:", contact: "Контактное лицо:",
    incTitle: "Стоимость тура включает:", excTitle: "Стоимость тура не включает:"
  },
  en: {
    day: "Day", title: "ARMENIA TOUR PROGRAM", slogan: "Armenia - a country to fall in love with!",
    start: "Tour start date:", end: "Tour end date:", fIn: "Arrival flight:", fOut: "Departure flight:",
    guests: "Number of participants:", hotel: "Hotel:", contact: "Contact person:",
    incTitle: "Tour price includes:", excTitle: "Tour price excludes:"
  }
};

// ============================================================
// Вспомогательные функции
// ============================================================
async function downloadImage(url, destPath) {
  if (!url || !url.trim()) return null;
  return new Promise((resolve) => {
    const req = (url.startsWith('https') ? https : http).get(url, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => resolve(destPath));
    });
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

// ============================================================
// Шапка и Подвал
// ============================================================
function createHeader(t) {
  const headerChildren = [];
  const logoPath = path.join(__dirname, 'logo.png');

  // Добавляем логотип, если он есть в папке
  if (fs.existsSync(logoPath)) {
    headerChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new ImageRun({
          data: fs.readFileSync(logoPath),
          transformation: { width: 170, height: 56 }
        })
      ]
    }));
  }

  // Заголовок программы
  headerChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({
        text: t.title,
        bold: true,
        size: 36, // 18pt
        font: FONT,
        color: COLORS.darkBlue
      })
    ]
  }));

  return new Header({ children: headerChildren });
}

function createFooter(t) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: t.slogan, color: COLORS.red, bold: true, size: 24, font: FONT })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "(+374 91) 01 56 60 (Viber, WhatsApp) | info@explorearmenia.am | www.explorearmenia.am | стр. ", color: COLORS.gray, size: 18, font: FONT }),
          new TextRun({ children: [PageNumber.CURRENT], color: COLORS.gray, size: 18, font: FONT })
        ]
      })
    ]
  });
}

// ============================================================
// Основная сборка документа
// ============================================================
async function buildDocument(inputJsonPath, outputDocxPath) {
  const raw = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const lang = raw.lang || 'ru';
  const t = DICT[lang] || DICT.ru;
  const tempDir = path.dirname(outputDocxPath);

  const docContent = [];

  // 1. Метаданные (Размер шрифта 24 = 12pt)
  if (raw.meta) {
    const lines = [
      [t.start, raw.meta.start], [t.end, raw.meta.end], [t.fIn, raw.meta.flight_in], [t.fOut, raw.meta.flight_out],
      [t.guests, raw.meta.guests], [t.hotel, raw.meta.hotel], [t.contact, raw.meta.contact]
    ];

    lines.forEach(([label, val]) => {
      if (val) {
        docContent.push(new Paragraph({
          spacing: { after: 80 },
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({ text: `${label} `, bold: true, size: 24, font: FONT }),
            new TextRun({ text: val, size: 24, font: FONT })
          ]
        }));
      }
    });
  }

  // Отступ после метаданных вместо разрыва страницы
  docContent.push(new Paragraph({ spacing: { before: 200, after: 400 }, children: [] }));

  // 2. Дни тура (Двухколоночный макет)
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  for (let i = 0; i < (raw.days || []).length; i++) {
    const day = raw.days[i];

    // --- Левая ячейка (Фото) ---
    const photoParagraphs = [];
    let photoCount = 0;
    for (const place of day.places || []) {
      if (place.photo_main && photoCount < 3) {
        const fpath = path.join(tempDir, `photo_${Date.now()}_${photoCount}.jpg`);
        if (await downloadImage(place.photo_main, fpath)) {
          photoParagraphs.push(new Paragraph({
            spacing: { after: 120 },
            children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(fpath), transformation: { width: 160, height: 115 } })]
          }));
          photoCount++;
        }
      }
    }
    if (photoParagraphs.length === 0) photoParagraphs.push(new Paragraph({ text: " " }));

    const leftCell = new TableCell({
      width: { size: 3000, type: WidthType.DXA },
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
      children: photoParagraphs,
      margins: { right: 200 }
    });

    // --- Правая ячейка (Текст) ---
    const textParagraphs = [];
    const dayNum = day.day_number || (i + 1);
    const dayTitle = `${t.day} ${dayNum} (${day.date_str || ''})`;

    // Заголовок дня
    textParagraphs.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: dayTitle, color: COLORS.darkBlue, bold: true, size: 28, font: FONT })]
    }));

    // Краткое описание маршрута
    const cleanRawText = (day.raw_text || '').replace(/^(День|Day|Tag|Օր)\s*\d+\s*[-—–]+\s*/i, '').trim();
    textParagraphs.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: cleanRawText, bold: true, size: 24, font: FONT })]
    }));

    // Локации (Bullet Points)
    for (const place of day.places || []) {
      const text = place.final_text || '';
      if (!text.trim()) continue;

      const words = text.split(' ');
      const firstWord = words.shift() || '';

      textParagraphs.push(new Paragraph({
        spacing: { after: 120 },
        alignment: AlignmentType.JUSTIFIED,
        children: [
          new TextRun({ text: `• ${firstWord} `, bold: true, size: 24, font: FONT }),
          new TextRun({ text: words.join(' '), size: 24, font: FONT })
        ]
      }));
    }

    const rightCell = new TableCell({
      width: { size: 7000, type: WidthType.DXA },
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
      children: textParagraphs
    });

    // Собираем день в таблицу
    docContent.push(new Table({
      width: { size: 10000, type: WidthType.DXA },
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
      rows: [new TableRow({ children: [leftCell, rightCell] })]
    }));

    // Отступ между днями
    docContent.push(new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }));
  }

  // 3. Создание инстанса документа
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 24 } } // 12pt по умолчанию
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 300, footer: 400 }
        }
      },
      headers: { default: createHeader(t) },
      footers: { default: createFooter(t) },
      children: docContent
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocxPath, buffer);
}

// ============================================================
// CLI Запуск
// ============================================================
const [, , inputPath, outputPath] = process.argv;

if (inputPath && outputPath) {
  buildDocument(inputPath, outputPath).then(() => {
    console.log(`✅ DOCX создан: ${outputPath}`);
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.error("Использование: node docx_builder.js <input.json> <output.docx>");
  process.exit(1);
}