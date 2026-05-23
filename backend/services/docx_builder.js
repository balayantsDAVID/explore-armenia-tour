const {
  Document, Packer, Paragraph, TextRun, ImageRun, Footer, AlignmentType, PageNumber, PageBreak
} = require('docx');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const COLORS = {
  red: "CC0000", darkBlue: "003366", black: "000000", gray: "555555"
};

const DICT = {
  ru: {
    day: "День", title: "ПРОГРАММА ТУРА ПО АРМЕНИИ", slogan: "Армения - страна, в которую можно влюбиться!",
    footer: "стр.", start: "Дата начала тура:", end: "Дата окончания тура:", fIn: "Рейс прилета:", fOut: "Рейс вылета:",
    guests: "Количество участников:", hotel: "Отель:", contact: "Контактное лицо:",
    incTitle: "Стоимость тура включает:", excTitle: "Стоимость тура не включает:",
    incList: ["трансферы аэропорт-отель-аэропорт", "комфортабельное транспортное обслуживание", "услуги сопровождающего гида", "входные билеты в историко-культурные центры", "бутилированная вода в транспорте", "круглосуточная поддержка туристов по телефону"],
    excList: ["авиабилеты", "медицинская страховка"]
  }
  // Остальные языки (EN, DE, HY) работают аналогично, можете скопировать их из прошлого шага
};

async function downloadImage(url, destPath) {
  if (!url || !url.trim()) return null;
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { headers: { 'User-Agent': 'ExploreArmenia' } }, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => resolve(destPath));
    });
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

function createFooter(t) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { before: 200, after: 40 },
        children: [new TextRun({ text: t.slogan, color: COLORS.red, bold: true, size: 24, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `(+374 91) 01 56 60 (Viber, WhatsApp) | info@explorearmenia.am | www.explorearmenia.am | ${t.footer} `, color: COLORS.gray, size: 18, font: "Arial" }),
          new TextRun({ children: [PageNumber.CURRENT], color: COLORS.gray, size: 18, font: "Arial" })
        ]
      })
    ]
  });
}

function buildTourInfoPage(meta, t, daysCount) {
  const items = [];

  items.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: "EXPLORE armenia.am", bold: true, size: 36, color: COLORS.darkBlue, font: "Arial" })]
  }));

  items.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 100 },
    children: [new TextRun({ text: t.title, bold: true, size: 32, font: "Arial" })]
  }));

  const nights = daysCount > 1 ? daysCount - 1 : 1;
  items.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 400 },
    children: [new TextRun({ text: `(${daysCount} ДНЕЙ / ${nights} НОЧЕЙ)`, bold: true, size: 24, font: "Arial", color: COLORS.gray })]
  }));

  const lines = [
    [t.start, meta.start], [t.end, meta.end, 160], [t.fIn, meta.flight_in], [t.fOut, meta.flight_out, 160],
    [t.guests, meta.guests, 160], [t.hotel, meta.hotel, 160], [t.contact, meta.contact, 160]
  ];

  lines.forEach(([label, val, afterSpace]) => {
    items.push(new Paragraph({
      spacing: { before: 40, after: afterSpace || 40 },
      children: [
        new TextRun({ text: `${label} `, bold: true, size: 24, font: "Arial" }),
        new TextRun({ text: val || "—", size: 24, font: "Arial" })
      ]
    }));
  });

  return items;
}

async function buildDayBlock(day, tempDir, t) {
  const elements = [];

  // 1. Заголовок Дня
  const dayTitle = `${t.day} ${day.day_number} (${day.date_str || ''})`;
  elements.push(new Paragraph({
    spacing: { before: 300, after: 80 },
    children: [new TextRun({ text: dayTitle, color: COLORS.darkBlue, bold: true, size: 28, font: "Arial" })]
  }));

  // 2. Подзаголовок (Маршрут)
  const cleanRawText = (day.raw_text || '').replace(/^(День|Day|Tag|Օր)\s*\d+\s*[-—–]+\s*/i, '').trim();
  elements.push(new Paragraph({
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: cleanRawText, color: COLORS.black, bold: true, size: 24, font: "Arial" })]
  }));

  // 3. Фотографии (в одну линию)
  const photos = [];
  for (const place of day.places || []) {
    if (place.photo_main && photos.length < 2) {
      const fpath = path.join(tempDir, `photo_${day.day_number}_${photos.length}_${Date.now()}.jpg`);
      if (await downloadImage(place.photo_main, fpath)) photos.push(fpath);
    }
  }

  if (photos.length > 0) {
    const imageRuns = [];
    for (const p of photos) {
      imageRuns.push(new ImageRun({ type: 'jpg', data: fs.readFileSync(p), transformation: { width: 300, height: 200 } }));
      imageRuns.push(new TextRun({ text: "   " }));
    }
    elements.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 200 }, children: imageRuns }));
  }

  // 4. Текст из базы данных
  for (const place of day.places || []) {
    const text = place.final_text || '';
    if (!text.trim()) continue;
    elements.push(new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [new TextRun({ text: text, size: 22, font: "Arial", color: COLORS.black })]
    }));
  }

  return elements;
}

function buildCostBlock(t) {
  return [
    new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: t.incTitle, bold: true, size: 22, font: "Arial" })] }),
    ...t.incList.map(item => new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: `• ${item}`, size: 22, font: "Arial" })] })),
    new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text: t.excTitle, bold: true, size: 22, color: COLORS.red, font: "Arial" })] }),
    ...t.excList.map(item => new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: `• ${item}`, size: 22, font: "Arial" })] }))
  ];
}

async function buildDocument(inputJsonPath, outputDocxPath) {
  const raw = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const t = DICT[raw.lang] || DICT.ru;
  const tempDir = path.dirname(outputDocxPath);

  const page1 = buildTourInfoPage(raw.meta, t, raw.days.length);
  const dayBlocks = [];
  for (const day of raw.days) dayBlocks.push(...(await buildDayBlock(day, tempDir, t)));
  const costBlock = buildCostBlock(t);

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: createFooter(t) },
      children: [...page1, new Paragraph({ children: [new PageBreak()] }), ...dayBlocks, ...costBlock]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocxPath, buffer);
}

const [, , inputPath, outputPath] = process.argv;
buildDocument(inputPath, outputPath).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });