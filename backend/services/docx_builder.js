// ============================================================
// ExploreArmenia — DOCX Builder v4 (Двухколоночный макет)
// ============================================================
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  VerticalAlign, PageNumber, PageBreak, LevelFormat
} = require('docx');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const COLORS = {
  red: "CC0000", darkBlue: "003366", cyan: "009DC4",
  black: "000000", gray: "555555", lightGray: "888888",
};

// Словари переводов
const DICT = {
  ru: {
    day: "День", daysStr: "ДНЕЙ", nightsStr: "НОЧЕЙ", title: "ПРОГРАММА ТУРА ПО АРМЕНИИ", slogan: "Армения - страна, в которую можно влюбиться!",
    start: "Дата начала тура:", end: "Дата окончания тура:", fIn: "Рейс прилета:", fOut: "Рейс вылета:",
    guests: "Количество участников:", hotel: "Отель:", contact: "Контактное лицо:",
    incTitle: "Стоимость тура включает:", excTitle: "Стоимость тура не включает:",
    incList: ["трансферы аэропорт-отель-аэропорт", "проживание в отеле с завтраками", "комфортабельное транспортное обслуживание", "услуги сопровождающего гида", "входные билеты в историко-культурные центры", "бутилированная вода в транспорте", "круглосуточная поддержка туристов по телефону"],
    excList: ["авиабилеты", "медицинская страховка"]
  },
  en: {
    day: "Day", daysStr: "DAYS", nightsStr: "NIGHTS", title: "ARMENIA TOUR PROGRAM", slogan: "Armenia - a country to fall in love with!",
    start: "Tour start date:", end: "Tour end date:", fIn: "Arrival flight:", fOut: "Departure flight:",
    guests: "Number of participants:", hotel: "Hotel:", contact: "Contact person:",
    incTitle: "The tour price includes:", excTitle: "The tour price does not include:",
    incList: ["airport-hotel-airport transfers", "hotel accommodation with breakfast", "comfortable transportation", "professional guide services", "entrance tickets", "bottled water in transport", "24/7 tourist support"],
    excList: ["air tickets", "medical insurance"]
  }
  // Добавьте de и hy по аналогии
};

async function downloadImage(url, destPath) {
  if (!url || !url.trim()) return null;
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => resolve(destPath));
    });
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

function createHeader(t, daysCount) {
  const nights = daysCount > 1 ? daysCount - 1 : 1;
  return new Header({
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "EXPLORE ", bold: true, size: 36, color: COLORS.cyan, font: "Arial" }), new TextRun({ text: "armenia.am", bold: true, size: 36, color: COLORS.gray, font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 }, children: [new TextRun({ text: t.title, bold: true, size: 28, font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 50, after: 300 }, children: [new TextRun({ text: `(${daysCount} ${t.daysStr} / ${nights} ${t.nightsStr})`, bold: true, size: 22, color: COLORS.gray, font: "Arial" })] })
    ]
  });
}

function createFooter(t) {
  return new Footer({
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 60 }, children: [new TextRun({ text: t.slogan, color: COLORS.red, bold: true, size: 22, font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `(+374 91) 01 56 60 (Viber, WhatsApp) | info@explorearmenia.am | www.explorearmenia.am | стр. `, color: COLORS.gray, size: 16, font: "Arial" }), new TextRun({ children: [PageNumber.CURRENT], color: COLORS.gray, size: 16, font: "Arial" })] })
    ]
  });
}

async function buildDayBlock(day, tempDir, t) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  // Левая колонка (Фотографии)
  const photoParagraphs = [];
  let photoCount = 0;
  for (const place of day.places || []) {
    if (place.photo_main && photoCount < 3) {
      const fpath = path.join(tempDir, `photo_${day.day_number}_${photoCount}_${Date.now()}.jpg`);
      if (await downloadImage(place.photo_main, fpath)) {
        photoParagraphs.push(new Paragraph({ spacing: { after: 120 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(fpath), transformation: { width: 220, height: 150 } })] }));
        photoCount++;
      }
    }
  }
  if (photoParagraphs.length === 0) photoParagraphs.push(new Paragraph({ text: " " }));
  const leftCell = new TableCell({ width: { size: 3000, type: WidthType.DXA }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: photoParagraphs, margins: { right: 200 } });

  // Правая колонка (Текст)
  const textParagraphs = [];
  const dayTitle = `${t.day} ${day.day_number} (${day.date_str || ''})`;
  textParagraphs.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: dayTitle, color: COLORS.cyan, bold: true, size: 26, font: "Arial" })] }));

  const cleanRawText = (day.raw_text || '').replace(/^(День|Day|Tag|Օր)\s*\d+\s*[-—–]+\s*/i, '').trim();
  textParagraphs.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: cleanRawText, bold: true, size: 24, font: "Arial" })] }));

  for (const place of day.places || []) {
    const text = place.final_text || '';
    if (!text.trim()) continue;

    const words = text.split(' ');
    const firstWord = words.shift(); // Выделяем первое слово/название жирным

    textParagraphs.push(new Paragraph({
      spacing: { after: 120 },
      alignment: AlignmentType.JUSTIFIED,
      children: [
        new TextRun({ text: `• ${firstWord} `, bold: true, size: 20, font: "Arial" }),
        new TextRun({ text: words.join(' '), size: 20, font: "Arial" })
      ]
    }));
  }
  const rightCell = new TableCell({ width: { size: 7000, type: WidthType.DXA }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: textParagraphs });

  // Возвращаем таблицу для одного дня
  return [
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
      rows: [new TableRow({ children: [leftCell, rightCell] })]
    }),
    new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }) // Отступ между днями
  ];
}

async function buildDocument(inputJsonPath, outputDocxPath) {
  const raw = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const t = DICT[raw.lang] || DICT.ru;
  const tempDir = path.dirname(outputDocxPath);

  // Страница 1 (Метаданные)
  const metaParagraphs = [];
  const lines = [
    [t.start, raw.meta.start], [t.end, raw.meta.end], [t.fIn, raw.meta.flight_in], [t.fOut, raw.meta.flight_out],
    [t.guests, raw.meta.guests], [t.hotel, raw.meta.hotel], [t.contact, raw.meta.contact]
  ];
  lines.forEach(([label, val]) => {
    metaParagraphs.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: `${label} `, bold: true, size: 22, font: "Arial" }), new TextRun({ text: val || "—", size: 22, font: "Arial" })]
    }));
  });

  // Дни тура
  const dayBlocks = [];
  for (const day of raw.days) dayBlocks.push(...(await buildDayBlock(day, tempDir, t)));

  // Финансовый блок
  const costBlock = [
    new Paragraph({ spacing: { before: 400, after: 100 }, children: [new TextRun({ text: t.incTitle, bold: true, size: 22, color: COLORS.cyan, font: "Arial" })] }),
    ...t.incList.map(item => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `- ${item};`, size: 20, font: "Arial" })] })),
    new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: t.excTitle, bold: true, size: 22, color: COLORS.red, font: "Arial" })] }),
    ...t.excList.map(item => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `- ${item};`, size: 20, font: "Arial" })] }))
  ];

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
      headers: { default: createHeader(t, raw.days.length) },
      footers: { default: createFooter(t) },
      children: [...metaParagraphs, new Paragraph({ children: [new PageBreak()] }), ...dayBlocks, ...costBlock]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocxPath, buffer);
}

const [, , inputPath, outputPath] = process.argv;
buildDocument(inputPath, outputPath).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });