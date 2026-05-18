import datetime

# Мультиязычные словари дней недели
WEEKDAYS = {
    "ru": ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"],
    "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "de": ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
    "hy": ["Երկուշաբթի", "Երեքշաբթի", "Չորեքշաբթի", "Հինգշաբթի", "Ուրբաթ", "Շաբաթ", "Կիրակի"]
}

async def generate_day_texts(days: list, meta: dict, lang: str = "ru") -> list:
    # 1. Берем дату старта из календаря
    start_date_str = meta.get("start", "")
    try:
        start_date = datetime.datetime.strptime(start_date_str, "%Y-%m-%d")
    except ValueError:
        start_date = datetime.datetime.now()

    for i, day in enumerate(days):
        # 2. Автоматический расчет дат
        current_date = start_date + datetime.timedelta(days=i)
        day_str = current_date.strftime("%d.%m")
        weekday = WEEKDAYS.get(lang, WEEKDAYS["ru"])[current_date.weekday()]
        
        # Сохраняем строку: "07.05, четверг"
        day["date_str"] = f"{day_str}, {weekday}"
        
        # 3. Строгий перенос данных из базы (никакого ИИ)
        for place in day["places"]:
            if place["status"] == "PLACE_NOT_FOUND":
                place["final_text"] = "" 
            else:
                place["final_text"] = place.get("description", "")
                
    return days