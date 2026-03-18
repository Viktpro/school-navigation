#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Скрипт для автоматического добавления голосовых настроек (voiceSettings)
ко всем существующим маршрутам в файле data/routes.json
"""

import json
import os
from datetime import datetime


def backup_file(filepath):
    """Создает резервную копию файла"""
    if os.path.exists(filepath):
        backup_name = f"{filepath}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        with open(filepath, 'r', encoding='utf-8') as src:
            with open(backup_name, 'w', encoding='utf-8') as dst:
                dst.write(src.read())
        print(f"✅ Создана резервная копия: {backup_name}")
        return True
    return False


def get_direction_text(angle):
    """Определяет текстовое направление по углу"""
    if angle > -45 and angle <= 45:
        return 'направо'
    elif angle > 45 and angle <= 135:
        return 'вниз'
    elif angle > 135 or angle <= -135:
        return 'налево'
    else:
        return 'вверх'


def analyze_route(route_data):
    """Анализирует маршрут и возвращает полезную информацию"""
    points = route_data.get('points', [])

    if len(points) < 2:
        return None

    start_point = points[0]
    end_point = points[-1]

    start_name = start_point.get('pointName', 'начало')
    end_name = end_point.get('pointName', 'конец')

    # Определяем количество этажей в маршруте
    floors = set()
    for point in points:
        if point.get('floor'):
            floors.add(point['floor'])

    has_floor_change = len(floors) > 1

    # Определяем основное направление первого шага
    if len(points) >= 2:
        first = points[0]
        second = points[1]
        dx = second.get('x', 0) - first.get('x', 0)
        dy = second.get('y', 0) - first.get('y', 0)
        angle = math.atan2(dy, dx) * 180 / math.pi if 'math' in dir() else 0
        first_direction = get_direction_text(angle) if 'math' in dir() else 'прямо'
    else:
        first_direction = 'прямо'

    return {
        'start_name': start_name,
        'end_name': end_name,
        'has_floor_change': has_floor_change,
        'floors': list(floors),
        'first_direction': first_direction,
        'points_count': len(points)
    }


def create_voice_settings(route_key, route_data):
    """Создает голосовые настройки для маршрута"""

    # Получаем информацию о маршруте
    points = route_data.get('points', [])

    if not points:
        return None

    start_point = points[0] if points else {}
    end_point = points[-1] if points else {}

    start_name = start_point.get('pointName', 'начало')
    end_name = end_point.get('pointName', 'конец')

    # Базовая структура голосовых настроек
    voice_settings = {
        "enabled": True,
        "rate": 0.9,
        "pitch": 1.1,
        "volume": 1.0,
        "language": "ru-RU",
        "voice_name": "",
        "customPhrases": {
            "start": f"Начинаем маршрут от {start_name} до {end_name}.",
            "first_step": "Сначала идите {direction} к {point}.",
            "step": "Затем идите {direction} к {point}.",
            "last_step": "Затем поверните {direction} и вы у цели: {point}.",
            "finish": f"Вы прибыли в пункт назначения: {end_name}.",
            "floor_change": "Перейдите на {floor} этаж."
        },
        "stepInstructions": {}
    }

    # Добавляем специальные инструкции для конкретных шагов, если нужно
    for i in range(len(points) - 1):
        from_point = points[i]
        to_point = points[i + 1]

        from_id = from_point.get('pointId', f'point_{i}')
        to_id = to_point.get('pointId', f'point_{i + 1}')
        step_key = f"{from_id}_{to_id}"

        # Если есть смена этажа, добавляем особую инструкцию
        if from_point.get('floor') != to_point.get('floor'):
            voice_settings["stepInstructions"][step_key] = f"Поднимитесь на {to_point.get('floor', 'следующий')} этаж"

    return voice_settings


def main():
    """Основная функция"""
    print("=" * 60)
    print("🔧 ДОБАВЛЕНИЕ ГОЛОСОВЫХ НАСТРОЕК ДЛЯ МАРШРУТОВ")
    print("=" * 60)

    # Путь к файлу с маршрутами
    routes_file = 'data/routes.json'

    # Проверяем существование файла
    if not os.path.exists(routes_file):
        print(f"❌ Файл {routes_file} не найден!")
        return

    # Создаем резервную копию
    backup_file(routes_file)

    # Загружаем маршруты
    try:
        with open(routes_file, 'r', encoding='utf-8') as f:
            routes = json.load(f)
        print(f"✅ Загружено {len(routes)} маршрутов")
    except Exception as e:
        print(f"❌ Ошибка загрузки файла: {e}")
        return

    # Счетчики
    updated = 0
    skipped = 0
    new_routes = {}

    # Обрабатываем каждый маршрут
    for route_key, route_data in routes.items():
        print(f"\n📌 Обработка маршрута: {route_key}")

        # Проверяем, есть ли уже voiceSettings
        if 'voiceSettings' in route_data:
            print(f"   ⚠️ Голосовые настройки уже существуют")
            # Можно либо пропустить, либо обновить
            choice = input("   Пропустить (п) или обновить (о)? [п/о]: ").lower()
            if choice == 'о':
                # Обновляем существующие
                voice_settings = create_voice_settings(route_key, route_data)
                if voice_settings:
                    # Сохраняем старые настройки, если они есть
                    old_settings = route_data.get('voiceSettings', {})

                    # Обновляем только нужные поля, сохраняя пользовательские изменения
                    voice_settings['customPhrases']['start'] = old_settings.get('customPhrases', {}).get('start',
                                                                                                         voice_settings[
                                                                                                             'customPhrases'][
                                                                                                             'start'])
                    voice_settings['customPhrases']['first_step'] = old_settings.get('customPhrases', {}).get(
                        'first_step', voice_settings['customPhrases']['first_step'])
                    voice_settings['customPhrases']['step'] = old_settings.get('customPhrases', {}).get('step',
                                                                                                        voice_settings[
                                                                                                            'customPhrases'][
                                                                                                            'step'])
                    voice_settings['customPhrases']['last_step'] = old_settings.get('customPhrases', {}).get(
                        'last_step', voice_settings['customPhrases']['last_step'])
                    voice_settings['customPhrases']['finish'] = old_settings.get('customPhrases', {}).get('finish',
                                                                                                          voice_settings[
                                                                                                              'customPhrases'][
                                                                                                              'finish'])
                    voice_settings['customPhrases']['floor_change'] = old_settings.get('customPhrases', {}).get(
                        'floor_change', voice_settings['customPhrases']['floor_change'])

                    # Сохраняем stepInstructions, добавляя новые
                    old_instructions = old_settings.get('stepInstructions', {})
                    voice_settings['stepInstructions'].update(old_instructions)

                    route_data['voiceSettings'] = voice_settings
                    updated += 1
                    print(f"   ✅ Голосовые настройки обновлены")
            else:
                skipped += 1
                print(f"   ⏭️ Пропущено")
        else:
            # Добавляем новые voiceSettings
            voice_settings = create_voice_settings(route_key, route_data)
            if voice_settings:
                route_data['voiceSettings'] = voice_settings
                updated += 1
                print(f"   ✅ Голосовые настройки добавлены")

                # Показываем превью
                print(f"   📝 Старт: {voice_settings['customPhrases']['start']}")
                print(f"   🏁 Финиш: {voice_settings['customPhrases']['finish']}")
            else:
                skipped += 1
                print(f"   ❌ Не удалось создать настройки")

        new_routes[route_key] = route_data

    # Сохраняем обновленный файл
    try:
        with open(routes_file, 'w', encoding='utf-8') as f:
            json.dump(new_routes, f, ensure_ascii=False, indent=2)
        print(f"\n✅ Файл успешно сохранен!")
        print(f"📊 Статистика:")
        print(f"   • Обновлено маршрутов: {updated}")
        print(f"   • Пропущено маршрутов: {skipped}")
        print(f"   • Всего маршрутов: {len(routes)}")
    except Exception as e:
        print(f"❌ Ошибка сохранения файла: {e}")


def batch_process():
    """Пакетная обработка без запросов (для автоматического запуска)"""
    print("=" * 60)
    print("🔧 ПАКЕТНОЕ ДОБАВЛЕНИЕ ГОЛОСОВЫХ НАСТРОЕК")
    print("=" * 60)

    routes_file = 'data/routes.json'

    if not os.path.exists(routes_file):
        print(f"❌ Файл {routes_file} не найден!")
        return

    backup_file(routes_file)

    try:
        with open(routes_file, 'r', encoding='utf-8') as f:
            routes = json.load(f)
        print(f"✅ Загружено {len(routes)} маршрутов")
    except Exception as e:
        print(f"❌ Ошибка загрузки файла: {e}")
        return

    updated = 0
    skipped = 0

    for route_key, route_data in routes.items():
        if 'voiceSettings' not in route_data:
            voice_settings = create_voice_settings(route_key, route_data)
            if voice_settings:
                route_data['voiceSettings'] = voice_settings
                updated += 1
            else:
                skipped += 1
        else:
            skipped += 1

    try:
        with open(routes_file, 'w', encoding='utf-8') as f:
            json.dump(routes, f, ensure_ascii=False, indent=2)
        print(f"\n✅ Пакетная обработка завершена!")
        print(f"📊 Статистика:")
        print(f"   • Добавлено настроек: {updated}")
        print(f"   • Пропущено (уже есть): {skipped}")
        print(f"   • Всего маршрутов: {len(routes)}")
    except Exception as e:
        print(f"❌ Ошибка сохранения файла: {e}")


def clean_duplicate_points():
    """Очищает дублирующиеся точки в маршрутах"""
    print("=" * 60)
    print("🧹 ОЧИСТКА ДУБЛИКАТОВ ТОЧЕК В МАРШРУТАХ")
    print("=" * 60)

    routes_file = 'data/routes.json'

    if not os.path.exists(routes_file):
        print(f"❌ Файл {routes_file} не найден!")
        return

    backup_file(routes_file)

    try:
        with open(routes_file, 'r', encoding='utf-8') as f:
            routes = json.load(f)
        print(f"✅ Загружено {len(routes)} маршрутов")
    except Exception as e:
        print(f"❌ Ошибка загрузки файла: {e}")
        return

    cleaned = 0

    for route_key, route_data in routes.items():
        points = route_data.get('points', [])

        if len(points) < 2:
            continue

        # Удаляем последовательные дубликаты
        new_points = []
        prev_point = None

        for point in points:
            if prev_point is None:
                new_points.append(point)
                prev_point = point
            else:
                # Проверяем, не дубликат ли это
                if (point.get('x') == prev_point.get('x') and
                        point.get('y') == prev_point.get('y') and
                        point.get('pointId') == prev_point.get('pointId')):
                    # Это дубликат, пропускаем
                    continue
                else:
                    new_points.append(point)
                    prev_point = point

        if len(new_points) != len(points):
            route_data['points'] = new_points
            cleaned += 1
            print(f"   ✅ Маршрут {route_key}: удалено {len(points) - len(new_points)} дубликатов")

    try:
        with open(routes_file, 'w', encoding='utf-8') as f:
            json.dump(routes, f, ensure_ascii=False, indent=2)
        print(f"\n✅ Очистка завершена! Обработано маршрутов: {cleaned}")
    except Exception as e:
        print(f"❌ Ошибка сохранения файла: {e}")


if __name__ == "__main__":
    import math  # Импортируем здесь для использования в функциях

    print("\nВыберите режим работы:")
    print("1. Интерактивный режим (с запросами)")
    print("2. Пакетный режим (автоматически)")
    print("3. Очистка дубликатов точек")
    print("4. Выход")

    choice = input("\nВаш выбор (1-4): ").strip()

    if choice == '1':
        main()
    elif choice == '2':
        batch_process()
    elif choice == '3':
        clean_duplicate_points()
    else:
        print("До свидания!")