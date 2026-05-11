-- Таблица основных объектов
CREATE TABLE places (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(100) UNIQUE NOT NULL,
    category ENUM('monastery', 'museum', 'nature', 'winery', 'cave', 'city', 'activity', 'restaurant') DEFAULT 'monastery',
    region VARCHAR(100),
    
    -- Медиа данные (ссылки на Cloudflare R2 или твой S3)
    photo_main VARCHAR(500),
    photo_secondary VARCHAR(500),
    
    -- Текстовый контент (RU)
    name_ru VARCHAR(255),
    desc_ru TEXT,
    promo_ru TEXT, -- Тот самый "продающий" текст для программы
    
    -- Текстовый контент (EN)
    name_en VARCHAR(255),
    desc_en TEXT,
    promo_en TEXT,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица алиасов для AI-поиска (чтобы "Хор Вирап" и "Вирап" вели к одному ID)
CREATE TABLE place_aliases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    place_id INT,
    alias_name VARCHAR(255),
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
);

-- Логирование генераций
CREATE TABLE tour_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_name VARCHAR(255),
    route_raw TEXT,
    docx_link VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);