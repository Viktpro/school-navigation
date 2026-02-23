"""
Школьная навигационная система с главной страницей и админ-панелью
Flask приложение для навигации по школе с использованием QR-кодов
"""

from flask import Flask, render_template, jsonify, request, send_file, send_from_directory
import qrcode
import os
import json
import math
import socket
from datetime import datetime
from typing import List, Dict, Optional
import logging

# Настройка логирования
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Создание приложения Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = 'school-navigation-secret-key-2024'
app.config['DEBUG'] = True


# ========== СТАТИСТИКА НАВИГАЦИЙ ==========
class Statistics:
    def __init__(self, stats_file='data/statistics.json'):
        self.stats_file = stats_file
        self.data = self.load_stats()

    def load_stats(self):
        """Загрузка статистики из файла"""
        try:
            if os.path.exists(self.stats_file):
                with open(self.stats_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"⚠️ Ошибка загрузки статистики: {e}")
        return {
            "total_navigations": 0,
            "popular_routes": {},
            "daily_stats": {},
            "unique_users": 0,
            "last_reset": datetime.now().isoformat()
        }

    def save_stats(self):
        """Сохранение статистики в файл"""
        try:
            os.makedirs(os.path.dirname(self.stats_file), exist_ok=True)
            with open(self.stats_file, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
            print(f"💾 Статистика сохранена в {self.stats_file}")
        except Exception as e:
            print(f"❌ Ошибка сохранения статистики: {e}")

    def increment_navigation(self, start_id: str, end_id: str, start_name: str = "", end_name: str = ""):
        """Увеличение счетчика навигаций"""
        try:
            # Увеличиваем общее количество
            self.data["total_navigations"] += 1
            print(f"📊 Навигация #{self.data['total_navigations']}: {start_name} → {end_name}")

            # Записываем в популярные маршруты (по ID)
            route_key = f"{start_id}_{end_id}"
            if route_key in self.data["popular_routes"]:
                self.data["popular_routes"][route_key] += 1
            else:
                self.data["popular_routes"][route_key] = 1

            # Статистика по дням
            today = datetime.now().strftime("%Y-%m-%d")
            if today in self.data["daily_stats"]:
                self.data["daily_stats"][today] += 1
            else:
                self.data["daily_stats"][today] = 1

            self.save_stats()
            return True
        except Exception as e:
            print(f"❌ Ошибка в increment_navigation: {e}")
            return False

    def get_stats(self):
        """Получение всей статистики"""
        return self.data


# Создаем объект статистики
statistics = Statistics()


# Класс для точки навигации
class NavigationPoint:
    """Модель точки на карте школы"""

    def __init__(self, id: str, name: str, x: float, y: float,
                 floor: int, description: str, category: str):
        self.id = id
        self.name = name
        self.x = x
        self.y = y
        self.floor = floor
        self.description = description
        self.category = category

    def to_dict(self):
        """Преобразование в словарь для JSON"""
        return {
            'id': self.id,
            'name': self.name,
            'x': self.x,
            'y': self.y,
            'floor': self.floor,
            'description': self.description,
            'category': self.category
        }

    @classmethod
    def from_dict(cls, data):
        """Создание объекта из словаря"""
        return cls(
            id=data['id'],
            name=data['name'],
            x=data['x'],
            y=data['y'],
            floor=data['floor'],
            description=data['description'],
            category=data['category']
        )


# Класс для работы с точками
class NavigationManager:
    """Менеджер навигации"""

    def __init__(self, data_file='data/points.json'):
        self.data_file = data_file
        self.points = []
        self.load_points()

    def load_points(self):
        """Загрузка точек из файла"""
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Поддержка разных форматов
                    if isinstance(data, dict):
                        if 'points' in data:
                            points_data = data['points']
                        else:
                            points_data = list(data.values())
                    else:
                        points_data = data

                    self.points = [NavigationPoint.from_dict(point) for point in points_data]
                    logger.info(f"✅ Загружено {len(self.points)} точек из {self.data_file}")
            else:
                logger.warning(f"⚠️ Файл {self.data_file} не найден")
                self.create_school_points()
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки точек: {e}")
            self.create_school_points()

    def create_school_points(self):
        """Создание точек для школы"""
        school_points = [
            # 1 ЭТАЖ - Вход
            {
                "id": "entrance_1",
                "name": "Центральный вход",
                "x": 265,
                "y": 340,
                "floor": 1,
                "description": "Главный вход в школу",
                "category": "entrance"
            },
            # 1 ЭТАЖ - Классы Б
            {
                "id": "classroom_B115",
                "name": "Класс Б115",
                "x": 189,
                "y": 320,
                "floor": 1,
                "description": "Кабинет Б115",
                "category": "classroom"
            },
            {
                "id": "classroom_B116",
                "name": "Класс Б116",
                "x": 145,
                "y": 320,
                "floor": 1,
                "description": "Кабинет Б116",
                "category": "classroom"
            },
            {
                "id": "classroom_B117",
                "name": "Класс Б117",
                "x": 97,
                "y": 319,
                "floor": 1,
                "description": "Кабинет Б117",
                "category": "classroom"
            },
            {
                "id": "classroom_B119",
                "name": "Класс Б119",
                "x": 52,
                "y": 320,
                "floor": 1,
                "description": "Кабинет Б119",
                "category": "classroom"
            },
            {
                "id": "classroom_B120",
                "name": "Класс Б120",
                "x": 48,
                "y": 277,
                "floor": 1,
                "description": "Кабинет Б120",
                "category": "classroom"
            },
            {
                "id": "classroom_B122",
                "name": "Класс Б122",
                "x": 121,
                "y": 277,
                "floor": 1,
                "description": "Кабинет Б122",
                "category": "classroom"
            },
            {
                "id": "classroom_B135",
                "name": "Класс Б135",
                "x": 434,
                "y": 318,
                "floor": 1,
                "description": "Кабинет Б135",
                "category": "classroom"
            },
            # 1 ЭТАЖ - Классы В
            {
                "id": "classroom_V134",
                "name": "Класс В134",
                "x": 483,
                "y": 318,
                "floor": 1,
                "description": "Кабинет В134",
                "category": "classroom"
            },
            {
                "id": "classroom_V136",
                "name": "Класс В136",
                "x": 388,
                "y": 318,
                "floor": 1,
                "description": "Кабинет В136",
                "category": "classroom"
            },
            {
                "id": "classroom_V137",
                "name": "Класс В137",
                "x": 334,
                "y": 320,
                "floor": 1,
                "description": "Кабинет В137",
                "category": "classroom"
            },
            # 1 ЭТАЖ - Классы Г
            {
                "id": "classroom_G164",
                "name": "Класс Г164",
                "x": 318,
                "y": 67,
                "floor": 1,
                "description": "Кабинет Г164",
                "category": "classroom"
            },
            {
                "id": "classroom_G167",
                "name": "Класс Г167",
                "x": 400,
                "y": 111,
                "floor": 1,
                "description": "Кабинет Г167",
                "category": "classroom"
            },
            {
                "id": "classroom_G168",
                "name": "Класс Г168",
                "x": 346,
                "y": 105,
                "floor": 1,
                "description": "Кабинет Г168",
                "category": "classroom"
            },
            # 1 ЭТАЖ - Лекционный зал
            {
                "id": "lecture_hall",
                "name": "Лекционный зал Г167",
                "x": 393,
                "y": 68,
                "floor": 1,
                "description": "Лекционный зал",
                "category": "hall"
            },
            # 1 ЭТАЖ - Кухня и столовая
            {
                "id": "kitchen",
                "name": "Кухня",
                "x": 157,
                "y": 91,
                "floor": 1,
                "description": "Школьная кухня",
                "category": "cafeteria"
            },
            {
                "id": "dining_hall",
                "name": "Зал приема пищи",
                "x": 225,
                "y": 93,
                "floor": 1,
                "description": "Столовая",
                "category": "cafeteria"
            },
            # 1 ЭТАЖ - Лифт и лестница
            {
                "id": "elevator_1",
                "name": "Лифт",
                "x": 299,
                "y": 276,
                "floor": 1,
                "description": "Лифт",
                "category": "elevator"
            },
            {
                "id": "stair_1",
                "name": "Лестница",
                "x": 550,
                "y": 200,
                "floor": 1,
                "description": "Главная лестница",
                "category": "stair"
            },
            # 1 ЭТАЖ - Туалеты
            {
                "id": "toilet_1_male",
                "name": "Мужской туалет",
                "x": 600,
                "y": 300,
                "floor": 1,
                "description": "Мужской туалет",
                "category": "toilet"
            },
            {
                "id": "toilet_1_female",
                "name": "Женский туалет",
                "x": 620,
                "y": 300,
                "floor": 1,
                "description": "Женский туалет",
                "category": "toilet"
            },
            # 2 ЭТАЖ
            {
                "id": "stair_2",
                "name": "Лестница",
                "x": 550,
                "y": 200,
                "floor": 2,
                "description": "Лестница на 2 этаже",
                "category": "stair"
            },
            {
                "id": "classroom_201",
                "name": "Кабинет 201",
                "x": 200,
                "y": 150,
                "floor": 2,
                "description": "Кабинет физики",
                "category": "classroom"
            },
            {
                "id": "classroom_202",
                "name": "Кабинет 202",
                "x": 300,
                "y": 150,
                "floor": 2,
                "description": "Кабинет химии",
                "category": "classroom"
            },
            {
                "id": "library",
                "name": "Библиотека",
                "x": 400,
                "y": 250,
                "floor": 2,
                "description": "Школьная библиотека",
                "category": "library"
            },
            {
                "id": "toilet_2_male",
                "name": "Мужской туалет",
                "x": 600,
                "y": 300,
                "floor": 2,
                "description": "Мужской туалет",
                "category": "toilet"
            },
            {
                "id": "toilet_2_female",
                "name": "Женский туалет",
                "x": 620,
                "y": 300,
                "floor": 2,
                "description": "Женский туалет",
                "category": "toilet"
            },
            # 3 ЭТАЖ
            {
                "id": "stair_3",
                "name": "Лестница",
                "x": 550,
                "y": 200,
                "floor": 3,
                "description": "Лестница на 3 этаже",
                "category": "stair"
            },
            {
                "id": "classroom_301",
                "name": "Кабинет 301",
                "x": 200,
                "y": 150,
                "floor": 3,
                "description": "Кабинет информатики",
                "category": "classroom"
            },
            {
                "id": "classroom_302",
                "name": "Кабинет 302",
                "x": 300,
                "y": 150,
                "floor": 3,
                "description": "Кабинет иностранных языков",
                "category": "classroom"
            },
            {
                "id": "assembly_hall",
                "name": "Актовый зал",
                "x": 400,
                "y": 250,
                "floor": 3,
                "description": "Актовый зал",
                "category": "hall"
            },
            {
                "id": "toilet_3_male",
                "name": "Мужской туалет",
                "x": 600,
                "y": 300,
                "floor": 3,
                "description": "Мужской туалет",
                "category": "toilet"
            },
            {
                "id": "toilet_3_female",
                "name": "Женский туалет",
                "x": 620,
                "y": 300,
                "floor": 3,
                "description": "Женский туалет",
                "category": "toilet"
            }
        ]

        self.points = [NavigationPoint.from_dict(point) for point in school_points]
        self.save_points()
        logger.info(f"✅ Создано {len(self.points)} точек для школы")

    def save_points(self):
        """Сохранение точек в файл"""
        try:
            os.makedirs(os.path.dirname(self.data_file), exist_ok=True)
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump([p.to_dict() for p in self.points],
                          f, ensure_ascii=False, indent=2)
            logger.info(f"✅ Сохранено {len(self.points)} точек в {self.data_file}")
        except Exception as e:
            logger.error(f"❌ Ошибка сохранения точек: {e}")

    def get_point(self, point_id: str) -> Optional[NavigationPoint]:
        """Получение точки по ID"""
        for point in self.points:
            if point.id == point_id:
                return point
        return None

    def search_points(self, query: str) -> List[NavigationPoint]:
        """Поиск точек по названию"""
        query = query.lower()
        results = []
        for point in self.points:
            if query in point.name.lower() or query in point.description.lower():
                results.append(point)
        return results[:20]

    def get_points_by_floor(self, floor: int) -> List[NavigationPoint]:
        """Получение точек по этажу"""
        return [p for p in self.points if p.floor == floor]

    def calculate_distance(self, p1: NavigationPoint, p2: NavigationPoint) -> float:
        """Расчет расстояния между точками"""
        return math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)

    def find_path(self, start_id: str, end_id: str) -> List[NavigationPoint]:
        """Поиск пути между точками"""
        start = self.get_point(start_id)
        end = self.get_point(end_id)

        if not start or not end:
            return []

        return [start, end]


# Создаем менеджер навигации
nav_manager = NavigationManager()


# Функция для получения локального IP
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"


# ========== МАРШРУТЫ ==========

@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')


@app.route('/admin')
def admin_panel():
    """Админ-панель"""
    return render_template('admin.html')


@app.route('/editor')
def map_editor():
    """Редактор карты - для рисования стен"""
    return render_template('map-editor.html')


@app.route('/viewer')
def map_viewer():
    """Навигатор для пользователей"""
    return render_template('viewer.html')


@app.route('/route-editor')
def route_editor():
    """Редактор маршрутов - для рисования путей между точками"""
    return render_template('route_editor.html')


@app.route('/map-only')
def map_only():
    """Только карта без лишних элементов"""
    return render_template('map_only.html')


@app.route('/map')
def school_map():
    """Простая карта"""
    return render_template('map.html')


# ========== API ДЛЯ ТОЧЕК ==========

@app.route('/api/points', methods=['GET'])
def get_points():
    """Получение всех точек"""
    return jsonify([p.to_dict() for p in nav_manager.points])


@app.route('/api/points/floor/<int:floor>', methods=['GET'])
def get_points_by_floor(floor):
    """Получение точек по этажу"""
    points = nav_manager.get_points_by_floor(floor)
    return jsonify([p.to_dict() for p in points])


@app.route('/api/points', methods=['POST'])
def add_point():
    """Добавление новой точки"""
    try:
        data = request.json
        # Генерируем ID если его нет
        if 'id' not in data:
            data['id'] = f"point_{datetime.now().timestamp()}".replace('.', '')

        new_point = NavigationPoint.from_dict(data)
        nav_manager.points.append(new_point)
        nav_manager.save_points()
        return jsonify({'success': True, 'point': new_point.to_dict()})
    except Exception as e:
        logger.error(f"❌ Error adding point: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/points/<point_id>', methods=['PUT'])
def update_point(point_id):
    """Обновление точки"""
    try:
        data = request.json
        for i, point in enumerate(nav_manager.points):
            if point.id == point_id:
                nav_manager.points[i] = NavigationPoint.from_dict(data)
                nav_manager.save_points()
                return jsonify({'success': True})
        return jsonify({'error': 'Point not found'}), 404
    except Exception as e:
        logger.error(f"❌ Error updating point: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/points/<point_id>', methods=['DELETE'])
def delete_point(point_id):
    """Удаление точки"""
    try:
        nav_manager.points = [p for p in nav_manager.points if p.id != point_id]
        nav_manager.save_points()
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"❌ Error deleting point: {e}")
        return jsonify({'error': str(e)}), 500


# ========== API ДЛЯ НАВИГАЦИИ ==========

@app.route('/api/navigate', methods=['POST'])
def navigate():
    """Построение маршрута"""
    try:
        data = request.json
        start_id = data.get('start_id')
        end_id = data.get('end_id')

        print(f"🔍 НАВИГАЦИЯ: start={start_id}, end={end_id}")

        if not start_id or not end_id:
            return jsonify({'error': 'Missing start_id or end_id'}), 400

        # Получаем точки для статистики
        start_point = nav_manager.get_point(start_id)
        end_point = nav_manager.get_point(end_id)

        if start_point and end_point:
            # СОХРАНЯЕМ СТАТИСТИКУ!
            statistics.increment_navigation(
                start_id,
                end_id,
                start_point.name,
                end_point.name
            )
            print(f"✅ Статистика обновлена. Всего: {statistics.data['total_navigations']}")
        else:
            print(f"❌ Точки не найдены: start={start_point}, end={end_point}")

        path = nav_manager.find_path(start_id, end_id)

        if not path or len(path) < 2:
            return jsonify({'error': 'Path not found'}), 404

        # Рассчитываем расстояние
        total_distance = nav_manager.calculate_distance(start_point, end_point)
        meters = round(total_distance * 0.5)
        minutes = max(1, round(meters / 70))

        return jsonify({
            'path': [p.to_dict() for p in path],
            'distance': meters,
            'time': minutes
        })

    except Exception as e:
        print(f"❌ ОШИБКА В НАВИГАЦИИ: {e}")
        logger.error(f"❌ Error in navigate: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/search', methods=['GET'])
def search():
    """Поиск точек"""
    query = request.args.get('q', '').lower()

    if len(query) < 2:
        return jsonify([])

    results = nav_manager.search_points(query)

    return jsonify([{
        'id': p.id,
        'name': p.name,
        'category': p.category,
        'floor': p.floor
    } for p in results])


# ========== API ДЛЯ СТАТИСТИКИ ==========

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Получение статистики"""
    try:
        stats = statistics.get_stats()

        # Добавляем общее количество точек
        stats['total_points'] = len(nav_manager.points)

        # Считаем количество маршрутов
        routes_file = 'data/routes.json'
        if os.path.exists(routes_file):
            with open(routes_file, 'r', encoding='utf-8') as f:
                routes = json.load(f)
                stats['total_routes'] = len(routes)
        else:
            stats['total_routes'] = 0

        # Преобразуем популярные маршруты из ID в названия для читаемости
        popular_with_names = {}

        # Безопасное преобразование популярных маршрутов
        if isinstance(stats.get('popular_routes'), dict):
            for route_key, count in stats['popular_routes'].items():
                if isinstance(route_key, str) and '_' in route_key:
                    # Разделяем только по первому вхождению
                    parts = route_key.split('_', 1)
                    if len(parts) == 2:
                        start_id, end_id = parts
                        start = nav_manager.get_point(start_id)
                        end = nav_manager.get_point(end_id)
                        if start and end:
                            popular_with_names[f"{start.name} → {end.name}"] = count
                        else:
                            popular_with_names[route_key] = count
                    else:
                        popular_with_names[route_key] = count
                else:
                    popular_with_names[route_key] = count

        stats['popular_with_names'] = popular_with_names

        print(f"📊 Статистика запрошена: всего навигаций {stats['total_navigations']}")

        return jsonify(stats)
    except Exception as e:
        print(f"❌ Ошибка получения статистики: {e}")
        # Возвращаем базовую статистику в случае ошибки
        return jsonify({
            "total_navigations": 0,
            "popular_routes": {},
            "daily_stats": {},
            "total_points": len(nav_manager.points),
            "total_routes": 0,
            "error": str(e)
        }), 500


@app.route('/api/stats/reset', methods=['POST'])
def reset_stats():
    """Сброс статистики"""
    try:
        global statistics
        statistics = Statistics()
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"❌ Error resetting stats: {e}")
        return jsonify({'error': str(e)}), 500


# ========== API ДЛЯ QR-КОДОВ ==========

@app.route('/api/qr/<point_id>', methods=['GET'])
def generate_qr(point_id):
    """Генерация QR-кода для точки"""
    try:
        point = nav_manager.get_point(point_id)

        if not point:
            return jsonify({'error': 'Point not found'}), 404

        os.makedirs('qr_codes', exist_ok=True)

        local_ip = get_local_ip()
        url = f"http://{local_ip}:8080/viewer?point={point_id}"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        qr_path = f'qr_codes/{point_id}.png'
        img.save(qr_path)

        return send_file(qr_path, mimetype='image/png')

    except Exception as e:
        logger.error(f"❌ Error generating QR: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/qr/all', methods=['GET'])
def generate_all_qr():
    """Генерация всех QR-кодов"""
    try:
        os.makedirs('qr_codes', exist_ok=True)
        local_ip = get_local_ip()
        count = 0

        for point in nav_manager.points:
            url = f"http://{local_ip}:8080/viewer?point={point.id}"

            qr = qrcode.QRCode(version=1, box_size=10, border=4)
            qr.add_data(url)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")
            img.save(f'qr_codes/{point.id}.png')
            count += 1

        return jsonify({'success': True, 'count': count})

    except Exception as e:
        logger.error(f"❌ Error generating QR codes: {e}")
        return jsonify({'error': str(e)}), 500


# ========== API ДЛЯ КАРТЫ ==========

@app.route('/api/save-map', methods=['POST'])
def save_map():
    """Сохранение карты (стены)"""
    try:
        data = request.json
        with open('data/map_data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info("✅ Карта сохранена")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"❌ Error saving map: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/load-map', methods=['GET'])
def load_map():
    """Загрузка карты (стены)"""
    try:
        if os.path.exists('data/map_data.json'):
            with open('data/map_data.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
            return jsonify(data)
        else:
            # Пустая карта по умолчанию
            default_map = {
                "floors": {
                    "1": {"walls": []},
                    "2": {"walls": []},
                    "3": {"walls": []}
                }
            }
            return jsonify(default_map)
    except Exception as e:
        logger.error(f"❌ Error loading map: {e}")
        return jsonify({'error': str(e)}), 500


# ========== API ДЛЯ МАРШРУТОВ ==========

@app.route('/api/routes', methods=['GET'])
def get_routes():
    """Получение всех сохраненных маршрутов"""
    try:
        routes_file = 'data/routes.json'
        if os.path.exists(routes_file):
            with open(routes_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logger.info(f"✅ Загружено {len(data)} маршрутов")
            return jsonify(data)
        else:
            logger.info("📁 Файл маршрутов не найден, возвращаем пустой объект")
            return jsonify({})
    except Exception as e:
        logger.error(f"❌ Error loading routes: {e}")
        return jsonify({}), 500


@app.route('/api/routes', methods=['POST'])
def save_routes():
    """Сохранение маршрутов"""
    try:
        data = request.json
        routes_file = 'data/routes.json'
        os.makedirs(os.path.dirname(routes_file), exist_ok=True)
        with open(routes_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"✅ Сохранено {len(data)} маршрутов")
        return jsonify({'success': True, 'count': len(data)})
    except Exception as e:
        logger.error(f"❌ Error saving routes: {e}")
        return jsonify({'error': str(e)}), 500


# ========== СТАТИЧЕСКИЕ ФАЙЛЫ ==========

@app.route('/static/<path:path>')
def serve_static(path):
    """Обслуживание статических файлов"""
    return send_from_directory('static', path)


# ========== СОЗДАНИЕ ПАПОК ==========

def create_required_folders():
    """Создание необходимых папок"""
    folders = [
        'templates',
        'static/css',
        'static/js',
        'static/images',
        'qr_codes',
        'data'
    ]

    for folder in folders:
        os.makedirs(folder, exist_ok=True)
        logger.info(f"📁 Папка {folder} создана")


# ========== ЗАПУСК ==========

if __name__ == '__main__':
    # Создаем папки
    create_required_folders()

    # Получаем локальный IP
    local_ip = get_local_ip()

    # Группируем точки по этажам для статистики
    points_by_floor = {1: 0, 2: 0, 3: 0}
    for point in nav_manager.points:
        points_by_floor[point.floor] = points_by_floor.get(point.floor, 0) + 1

    # Выводим информацию
    print("\n" + "=" * 70)
    print("🏫 ШКОЛЬНАЯ НАВИГАЦИЯ")
    print("=" * 70)
    print(f"📱 Локальный адрес: http://localhost:8080")
    print(f"📱 С телефона: http://{local_ip}:8080")
    print("\n📌 ДОСТУПНЫЕ СТРАНИЦЫ:")
    print(f"   🏠 Главная: http://localhost:8080")
    print(f"   🗺️ Навигатор: http://localhost:8080/viewer")
    print(f"   ⚙️ Админ-панель: http://localhost:8080/admin")
    print(f"   ✏️ Редактор карты: http://localhost:8080/editor")
    print(f"   🛤️ Редактор маршрутов: http://localhost:8080/route-editor")
    print(f"   🗺️ Только карта: http://localhost:8080/map-only")
    print("\n📊 ТОЧКИ НА КАРТЕ:")
    print(f"   • 1 этаж: {points_by_floor[1]} точек")
    print(f"   • 2 этаж: {points_by_floor[2]} точек")
    print(f"   • 3 этаж: {points_by_floor[3]} точек")
    print(f"   • Всего: {len(nav_manager.points)} точек")
    print("=" * 70 + "\n")

    # Запускаем сервер
    app.run(debug=True, host='0.0.0.0', port=8080)