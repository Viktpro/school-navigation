"""
Добавление тестовых данных статистики
Запустите этот скрипт один раз
"""

import json
import os
from datetime import datetime, timedelta

# Путь к файлу статистики
stats_file = 'data/statistics.json'

# Создаем тестовые данные
test_stats = {
    "total_navigations": 42,
    "popular_routes": {
        "entrance_1_dining_hall": 15,
        "entrance_1_library": 10,
        "classroom_101_classroom_201": 8,
        "dining_hall_assembly_hall": 5,
        "entrance_1_classroom_B115": 4
    },
    "daily_stats": {},
    "unique_users": 5,
    "last_reset": datetime.now().isoformat()
}

# Добавляем данные за последние 7 дней
today = datetime.now()
for i in range(7):
    day = (today - timedelta(days=i)).strftime("%Y-%m-%d")
    test_stats["daily_stats"][day] = 5 + i

# Сохраняем в файл
os.makedirs('data', exist_ok=True)
with open(stats_file, 'w', encoding='utf-8') as f:
    json.dump(test_stats, f, ensure_ascii=False, indent=2)

print("✅ Тестовые данные созданы!")
print(f"📊 Всего навигаций: {test_stats['total_navigations']}")
print(f"📅 Сегодня: {test_stats['daily_stats'].get(today.strftime('%Y-%m-%d'), 0)}")