// ============================================================
// ExploreArmenia — Сборка Word документа
// ============================================================
// Использует библиотеку 'docx' (Node.js)
// Запускается из Python через subprocess
// 
// Входные данные: JSON файл с днями и мета-данными тура
// Выходной файл: tour_XXXXXX.docx
//
// Структура документа:
// - Хедер: логотип + "ПРОГРАММА ТУРА ПО АРМЕНИИ" (на каждой странице)
// - Страница 1: данные тура (даты, рейсы, отель, контакт)
// - Страницы 2+: каждый день = фото слева + текст справа
// - Футер: "Армения - страна, в которую можно влюбиться!" (на каждой странице)
// ============================================================

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  HeadingLevel
} = require('docx');

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ============================================================
// Цвета бренда ExploreArmenia (из макета)
// ============================================================
const COLORS = {
  blue: "00AACC",       // голубой — хедер, заголовки дней
  red: "CC0000",        // красный — слоган в футере
  white: "FFFFFF",
  black: "000000",
  gray: "666666",
  lightBlue: "E8F7FC",  // светло-голубой фон для блоков
};

// A4 страница в DXA (1440 DXA = 1 дюйм = 2.54 см)
// A4: 210мм × 297мм = 11906 × 16838 DXA
// Поля: 1.5см = ~851 DXA
const PAGE = {
  width: 11906,
  height: 16838,
  marginTop: 851,
  marginBottom: 851,
  marginLeft: 851,
  marginRight: 851,
};

// Ширина контента = страница - левое поле - правое поле
const CONTENT_WIDTH = PAGE.width - PAGE.marginLeft - PAGE.marginRight; // ~10204 DXA

// Ширина колонок для макета "фото | текст"
const COL_PHOTO = Math.round(CONTENT_WIDTH * 0.35);   // 35% — фото
const COL_TEXT  = Math.round(CONTENT_WIDTH * 0.65);   // 65% — текст


// ============================================================
// Скачивание фото по URL во временный файл
// ============================================================
async function downloadImage(url, destPath) {
  if (!url || url.trim() === '') return null;

  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ExploreArmenia/1.0)'
      }
    };

    const req = protocol.get(url, options, (response) => {
      // Обрабатываем редиректы
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImage(response.headers.location, destPath).then(resolve);
        return;
      }
      if (response.statusCode !== 200) {
        resolve(null);
        return;
      }
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
      file.on('error', () => resolve(null));
    });

    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}


// ============================================================
// Создание хедера (повторяется на каждой странице)
// ============================================================
function createHeader(logoPath) {
  const headerChildren = [];
  
  // Таблица 1×2: логотип | заголовок
  const headerTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [2000, CONTENT_WIDTH - 2000],
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideH: { style: BorderStyle.NONE },
      insideV: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          // Левая ячейка: логотип
          new TableCell({
            width: { size: 2000, type: WidthType.DXA },
            shading: { fill: COLORS.blue, type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              logoPath && fs.existsSync(logoPath)
                ? new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({
                      type: "png",
                      data: fs.readFileSync(logoPath),
                      transformation: { width: 100, height: 60 },
                      altText: { title: "Logo", description: "ExploreArmenia", name: "logo" }
                    })]
                  })
                : new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({
                      text: "EXPLORE\narmenia.am",
                      color: COLORS.white,
                      bold: true,
                      size: 18
                    })]
                  })
            ]
          }),
          // Правая ячейка: заголовок тура
          new TableCell({
            width: { size: CONTENT_WIDTH - 2000, type: WidthType.DXA },
            shading: { fill: COLORS.blue, type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 200, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({
                  text: "ПРОГРАММА ТУРА ПО АРМЕНИИ",
                  color: COLORS.white,
                  bold: true,
                  size: 32,
                  font: "Arial"
                })]
              })
            ]
          })
        ]
      })
    ]
  });
  
  headerChildren.push(headerTable);
  
  return new Header({ children: headerChildren });
}


// ============================================================
// Создание футера (повторяется на каждой странице)
// ============================================================
function createFooter() {
  return new Footer({
    children: [
      // Разделительная линия
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.blue } },
        children: []
      }),
      // Слоган — красным
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: "Армения - страна, в которую можно влюбиться!",
          color: COLORS.red,
          bold: true,
          size: 22,
          font: "Arial"
        })]
      }),
      // Контакты + номер страницы
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "(+374 91) 01 56 60 (Viber, WhatsApp)  |  info@explorearmenia.am  |  www.explorearmenia.am  |  стр. ",
            color: COLORS.gray,
            size: 16,
            font: "Arial"
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            color: COLORS.gray,
            size: 16
          })
        ]
      })
    ]
  });
}


// ============================================================
// Первая страница: данные тура
// ============================================================
function createTourInfoPage(meta) {
  const fields = [
    { label: "Дата начала тура:",     value: meta.start },
    { label: "Дата окончания тура:",  value: meta.end },
    { label: "Рейс прилета:",         value: meta.flight_in },
    { label: "Рейс вылета:",          value: meta.flight_out },
    { label: "Количество участников:", value: meta.guests },
    { label: "Отель:",                value: meta.hotel },
    { label: "Контактное лицо:",      value: meta.contact },
  ];
  
  const paragraphs = [];
  
  // Отступ сверху
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
  
  for (const field of fields) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({ text: `${field.label} `, bold: true, size: 24, font: "Arial" }),
          new TextRun({ text: field.value || "—", size: 24, font: "Arial" })
        ]
      })
    );
  }
  
  return paragraphs;
}


// ============================================================
// Блок одного дня: фото слева + текст справа
// ============================================================
async function createDayBlock(day, tempDir) {
  const elements = [];
  
  // Собираем фото для этого дня
  const photos = [];
  for (const place of day.places) {
    if (place.photo_main && place.photo_main.trim()) {
      const imgPath = path.join(tempDir, `img_${place.id || Math.random()}_1.jpg`);
      const downloaded = await downloadImage(place.photo_main, imgPath);
      if (downloaded) photos.push(downloaded);
    }
    if (place.photo_secondary && place.photo_secondary.trim() && photos.length < 2) {
      const imgPath = path.join(tempDir, `img_${place.id || Math.random()}_2.jpg`);
      const downloaded = await downloadImage(place.photo_secondary, imgPath);
      if (downloaded) photos.push(downloaded);
    }
    if (photos.length >= 2) break;
  }
  
  // Левая колонка: фото (1 или 2 штуки)
  const photoCell_children = [];
  
  if (photos.length > 0) {
    for (const photoPath of photos.slice(0, 2)) {
      photoCell_children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [new ImageRun({
            type: "jpg",
            data: fs.readFileSync(photoPath),
            transformation: { width: 180, height: 130 },
            altText: { title: "Photo", description: "Place photo", name: "photo" }
          })]
        })
      );
    }
  } else {
    // Нет фото — серый плейсхолдер
    photoCell_children.push(
      new Paragraph({
        children: [new TextRun({ text: "[ фото ]", color: COLORS.gray, size: 20 })]
      })
    );
  }
  
  // Правая колонка: заголовок дня + список мест
  const textCell_children = [];
  
  // Заголовок: "День 1 (07.05, четверг)"
  textCell_children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 100 },
      children: [new TextRun({
        text: day.day_label,
        color: COLORS.blue,
        bold: true,
        size: 26,
        font: "Arial"
      })]
    })
  );
  
  // Подзаголовок: названия мест через " – "
  const foundPlaces = day.places.filter(p => p.status === "OK");
  if (foundPlaces.length > 0) {
    const dayTitle = foundPlaces.map(p => p.name || p.query).join(" – ");
    textCell_children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [new TextRun({
          text: dayTitle,
          bold: true,
          size: 24,
          font: "Arial",
          color: COLORS.black
        })]
      })
    );
  }
  
  // Описания мест (буллеты)
  for (const place of day.places) {
    const text = place.final_text || place.description || "";
    if (!text.trim()) continue;
    
    textCell_children.push(
      new Paragraph({
        spacing: { after: 100 },
        bullet: { level: 0 },
        children: [
          // Название места жирным
          new TextRun({
            text: `${place.name || place.query}: `,
            bold: true,
            size: 20,
            font: "Arial"
          }),
          // Описание обычным
          new TextRun({
            text: text,
            size: 20,
            font: "Arial"
          }),
          // Предупреждение если место не в БД
          ...(place.warning ? [new TextRun({
            text: ` ${place.warning}`,
            color: "FF6600",
            size: 18,
            italics: true
          })] : [])
        ]
      })
    );
  }
  
  // Таблица: 1 строка, 2 колонки
  const dayTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [COL_PHOTO, COL_TEXT],
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideH: { style: BorderStyle.NONE },
      insideV: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: COL_PHOTO, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 80, bottom: 80, left: 0, right: 120 },
            children: photoCell_children
          }),
          new TableCell({
            width: { size: COL_TEXT, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 80, bottom: 80, left: 120, right: 0 },
            children: textCell_children
          })
        ]
      })
    ]
  });
  
  elements.push(dayTable);
  
  // Разделитель между днями
  elements.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" } },
      spacing: { before: 160, after: 160 },
      children: []
    })
  );
  
  return elements;
}


// ============================================================
// Главная функция: собирает весь документ
// ============================================================
async function buildDocument(inputJsonPath, outputDocxPath) {
  
  // Читаем данные
  const data = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const { days, meta } = data;
  
  const tempDir = path.dirname(outputDocxPath);
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  
  // Собираем все блоки документа
  const allContent = [];
  
  // 1. Данные тура (первая страница)
  const tourInfoParagraphs = createTourInfoPage(meta);
  allContent.push(...tourInfoParagraphs);
  
  // 2. Разрыв страницы перед первым днём
  allContent.push(new Paragraph({ children: [new PageBreak()] }));
  
  // 3. Блоки дней
  for (const day of days) {
    const dayElements = await createDayBlock(day, tempDir);
    allContent.push(...dayElements);
  }
  
  // 4. Блок "Стоимость включает / не включает"
  allContent.push(
    new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: "Стоимость тура включает:", bold: true, size: 22, color: COLORS.blue })]
    }),
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: "трансферы аэропорт-отель-аэропорт", size: 20 })] }),
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: "комфортабельное транспортное обслуживание", size: 20 })] }),
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: "услуги сопровождающего гида", size: 20 })] }),
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: "входные билеты в историко-культурные центры", size: 20 })] }),
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: "бутилированная вода в транспорте", size: 20 })] }),
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: "круглосуточная поддержка туристов по телефону", size: 20 })] }),
    
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: "Стоимость тура не включает:", bold: true, size: 22, color: COLORS.red })]
    }),
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: "авиабилеты", size: 20 })] }),
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: "медицинская страховка", size: 20 })] }),
  );
  
  // Создаём документ
  const doc = new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 360, hanging: 260 } }
          }
        }]
      }]
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE.width, height: PAGE.height },
          margin: {
            top: PAGE.marginTop,
            bottom: PAGE.marginBottom,
            left: PAGE.marginLeft,
            right: PAGE.marginRight,
            header: 400,
            footer: 400
          }
        }
      },
      headers: { default: createHeader(logoPath) },
      footers: { default: createFooter() },
      children: allContent
    }]
  });
  
  // Записываем файл
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputDocxPath, buffer);
  console.log(`✅ DOCX создан: ${outputDocxPath}`);
}


// Запуск из командной строки:
// node docx_builder.js /tmp/input.json /tmp/output.docx
const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Использование: node docx_builder.js <input.json> <output.docx>");
  process.exit(1);
}

buildDocument(inputPath, outputPath)
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Ошибка:", err);
    process.exit(1);
  });
