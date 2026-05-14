# ============================================================
# ExploreArmenia — Python обёртка для запуска docx_builder.js
# ============================================================
# Python (FastAPI) не умеет напрямую работать с библиотекой docx.
# Поэтому мы: 
#   1. Сохраняем данные в JSON файл
#   2. Запускаем Node.js скрипт через subprocess
#   3. Node.js читает JSON и создаёт DOCX
# ============================================================

import os
import json
import subprocess

# Путь к Node.js скрипту (рядом с этим файлом)
DOCX_BUILDER_JS = os.path.join(os.path.dirname(__file__), 'docx_builder.js')


def build_docx(days: list, meta: dict, lang: str, output_path: str):
    """
    Создаёт DOCX файл из данных тура.
    
    Args:
        days: список дней с местами и текстами (из ai_generator)
        meta: данные тура (даты, рейсы, отель, контакт)
        lang: язык документа (ru, en, hy)
        output_path: путь куда сохранить .docx файл
    """
    
    # Шаг 1: Сохраняем все данные в JSON файл
    # (рядом с будущим docx файлом, в той же временной папке)
    input_json_path = output_path.replace('.docx', '_input.json')
    
    payload = {
        "days": days,
        "meta": meta,
        "lang": lang
    }
    
    with open(input_json_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    
    # Шаг 2: Запускаем Node.js
    # node docx_builder.js /tmp/input.json /tmp/output.docx
    result = subprocess.run(
        ["node", DOCX_BUILDER_JS, input_json_path, output_path],
        capture_output=True,
        text=True,
        timeout=60  # максимум 60 секунд
    )
    
    # Шаг 3: Проверяем что всё прошло хорошо
    if result.returncode != 0:
        error_msg = result.stderr or result.stdout or "Unknown error"
        raise RuntimeError(f"DOCX generation failed: {error_msg}")
    
    if not os.path.exists(output_path):
        raise RuntimeError(f"DOCX file was not created at {output_path}")
    
    
    print(f"✅ DOCX готов: {output_path}")
    return output_path
