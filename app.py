"""
Школьная навигационная система с главной страницей и админ-панелью
Flask приложение для навигации по школе с использованием QR-кодов
Поддержка ЭВАКУАЦИОННЫХ маршрутов (красных)
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
            "evacuation_used": 0,
            "last_reset": datetime.now().isoformat()
        }

    def save_stats(self):
        try:
            os.makedirs(os.path.dirname(self.stats_file), exist_ok=True)
            with open(self.stats_file, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"❌ Ошибка сохранения статистики: {e}")

    def increment_navigation(self, start_id: str, end_id: str, start_name: str = "", end_name: str = ""):
        try:
            self.data["total_navigations"] += 1
            route_key = f"{start_id}_{end_id}"
            self.data["popular_routes"][route_key] = self.data["popular_routes"].get(route_key, 0) + 1
            today = datetime.now().strftime("%Y-%m-%d")
            self.data["daily_stats"][today] = self.data["daily_stats"].get(today, 0) + 1
            self.save_stats()
        except Exception as e:
            print(f"❌ Ошибка: {e}")

    def increment_evacuation(self):
        try:
            self.data["evacuation_used"] = self.data.get("evacuation_used", 0) + 1
            self.save_stats()
        except Exception as e:
            print(f"❌ Ошибка: {e}")

    def get_stats(self):
        return self.data


statistics = Statistics()


# ========== ТОЧКИ НАВИГАЦИИ ==========
class NavigationPoint:
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
        return cls(
            id=data['id'],
            name=data['name'],
            x=data['x'],
            y=data['y'],
            floor=data['floor'],
            description=data.get('description', ''),
            category=data.get('category', 'classroom')
        )


class NavigationManager:
    def __init__(self, data_file='data/points.json'):
        self.data_file = data_file
        self.points = []
        self.load_points()

    def load_points(self):
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        if 'points' in data:
                            points_data = data['points']
                        else:
                            points_data = list(data.values())
                    else:
                        points_data = data
                    self.points = [NavigationPoint.from_dict(point) for point in points_data]
                    logger.info(f"✅ Загружено {len(self.points)} точек")
            else:
                logger.warning(f"⚠️ Файл {self.data_file} не найден")
                self.create_default_points()
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки точек: {e}")
            self.create_default_points()

    def create_default_points(self):
        default_points = [
            {"id": "entrance_main", "name": "Главный вход", "x": 265, "y": 340, "floor": 1,
             "description": "Центральный вход", "category": "entrance"},
            {"id": "entrance_back", "name": "Запасной выход", "x": 700, "y": 400, "floor": 1,
             "description": "Запасной выход", "category": "entrance"},
            {"id": "entrance_side", "name": "Боковой выход", "x": 100, "y": 400, "floor": 1,
             "description": "Боковой выход", "category": "entrance"},
            {"id": "classroom_B115", "name": "Класс Б115", "x": 189, "y": 320, "floor": 1,
             "description": "Кабинет Б115", "category": "classroom"},
            {"id": "classroom_B116", "name": "Класс Б116", "x": 145, "y": 320, "floor": 1,
             "description": "Кабинет Б116", "category": "classroom"},
            {"id": "classroom_G164", "name": "Класс Г164", "x": 318, "y": 67, "floor": 1, "description": "Кабинет Г164",
             "category": "classroom"},
            {"id": "classroom_G167", "name": "Класс Г167", "x": 400, "y": 111, "floor": 1,
             "description": "Кабинет Г167", "category": "classroom"},
            {"id": "classroom_V134", "name": "Класс В134", "x": 483, "y": 318, "floor": 1,
             "description": "Кабинет В134", "category": "classroom"},
            {"id": "classroom_V137", "name": "Класс В137", "x": 334, "y": 320, "floor": 1,
             "description": "Кабинет В137", "category": "classroom"},
            {"id": "dining_hall", "name": "Столовая", "x": 225, "y": 93, "floor": 1, "description": "Столовая",
             "category": "cafeteria"},
            {"id": "library", "name": "Библиотека", "x": 400, "y": 250, "floor": 2, "description": "Библиотека",
             "category": "library"},
            {"id": "stair_1", "name": "Лестница", "x": 550, "y": 200, "floor": 1, "description": "Лестница",
             "category": "stair"},
        ]
        self.points = [NavigationPoint.from_dict(point) for point in default_points]
        self.save_points()

    def save_points(self):
        try:
            os.makedirs(os.path.dirname(self.data_file), exist_ok=True)
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump([p.to_dict() for p in self.points], f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ Ошибка сохранения точек: {e}")

    def get_point(self, point_id: str):
        for point in self.points:
            if point.id == point_id:
                return point
        return None

    def get_exits(self, floor: int = None):
        exits = [p for p in self.points if p.category == 'entrance']
        if floor is not None:
            exits = [p for p in exits if p.floor == floor]
        return exits

    def get_points_by_floor(self, floor: int):
        return [p for p in self.points if p.floor == floor]

    def calculate_distance(self, p1: NavigationPoint, p2: NavigationPoint) -> float:
        return math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)


nav_manager = NavigationManager()

# ========== РАБОТА С МАРШРУТАМИ ==========
ROUTES_FILE = 'data/routes.json'
EVACUATION_FILE = 'data/evacuation_routes.json'


def load_routes():
    try:
        if os.path.exists(ROUTES_FILE):
            with open(ROUTES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    except:
        return {}


def save_routes(routes):
    try:
        os.makedirs('data', exist_ok=True)
        with open(ROUTES_FILE, 'w', encoding='utf-8') as f:
            json.dump(routes, f, ensure_ascii=False, indent=2)
        return True
    except:
        return False


def load_evacuation_routes():
    try:
        if os.path.exists(EVACUATION_FILE):
            with open(EVACUATION_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    except:
        return {}


def save_evacuation_routes(routes):
    try:
        os.makedirs('data', exist_ok=True)
        with open(EVACUATION_FILE, 'w', encoding='utf-8') as f:
            json.dump(routes, f, ensure_ascii=False, indent=2)
        logger.info(f"✅ Сохранено {len(routes)} эвакуационных маршрутов")
        return True
    except:
        return False


# ========== ФУНКЦИЯ ДЛЯ IP ==========
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"


# ========== СТРАНИЦЫ ==========
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/admin')
def admin_panel():
    return render_template('admin.html')


@app.route('/editor')
def map_editor():
    return render_template('map-editor.html')


@app.route('/viewer')
def map_viewer():
    return render_template('viewer.html')


@app.route('/route-editor')
def route_editor():
    return render_template('route_editor.html')


@app.route('/voice-editor')
def voice_editor():
    return render_template('voice_editor.html')


# ========== API ТОЧЕК ==========
@app.route('/api/points', methods=['GET'])
def get_points():
    return jsonify([p.to_dict() for p in nav_manager.points])


@app.route('/api/points/floor/<int:floor>', methods=['GET'])
def get_points_by_floor_api(floor):
    points = nav_manager.get_points_by_floor(floor)
    return jsonify([p.to_dict() for p in points])


@app.route('/api/points', methods=['POST'])
def add_point():
    try:
        data = request.json
        if 'id' not in data:
            data['id'] = f"point_{int(datetime.now().timestamp() * 1000)}"
        new_point = NavigationPoint.from_dict(data)
        nav_manager.points.append(new_point)
        nav_manager.save_points()
        return jsonify({'success': True, 'point': new_point.to_dict()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/points/<point_id>', methods=['PUT'])
def update_point(point_id):
    try:
        data = request.json
        for i, point in enumerate(nav_manager.points):
            if point.id == point_id:
                nav_manager.points[i] = NavigationPoint.from_dict(data)
                nav_manager.save_points()
                return jsonify({'success': True})
        return jsonify({'error': 'Not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/points/<point_id>', methods=['DELETE'])
def delete_point(point_id):
    try:
        nav_manager.points = [p for p in nav_manager.points if p.id != point_id]
        nav_manager.save_points()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== API КАРТЫ (СТЕНЫ) ==========
@app.route('/api/save-map', methods=['POST'])
def save_map():
    try:
        data = request.json
        with open('data/map_data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/load-map', methods=['GET'])
def load_map():
    try:
        if os.path.exists('data/map_data.json'):
            with open('data/map_data.json', 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        return jsonify({"floors": {"1": {"walls": []}, "2": {"walls": []}, "3": {"walls": []}}})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== API ОБЫЧНЫХ МАРШРУТОВ ==========
@app.route('/api/routes', methods=['GET'])
def get_routes():
    return jsonify(load_routes())


@app.route('/api/routes', methods=['POST'])
def save_routes_api():
    try:
        data = request.json
        save_routes(data)
        return jsonify({'success': True, 'count': len(data)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== API ЭВАКУАЦИОННЫХ МАРШРУТОВ ==========
@app.route('/api/evacuation-routes', methods=['GET'])
def get_evacuation_routes():
    return jsonify(load_evacuation_routes())


@app.route('/api/evacuation-routes', methods=['POST'])
def save_evacuation_routes_api():
    try:
        data = request.json
        save_evacuation_routes(data)
        return jsonify({'success': True, 'count': len(data)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== API ЭВАКУАЦИИ ==========
@app.route('/api/evacuation/start', methods=['POST'])
def start_evacuation():
    """Запуск эвакуации - возвращает сохраненный эвакуационный маршрут"""
    try:
        # Загружаем сохраненные эвакуационные маршруты
        evac_routes = load_evacuation_routes()

        print(f"📢 Загружено эвакуационных маршрутов: {len(evac_routes)}")

        # Если есть сохраненные маршруты - берем первый
        if evac_routes:
            first_key = list(evac_routes.keys())[0]
            route = evac_routes[first_key]
            print(f"✅ Возвращаем маршрут: {route.get('name', 'Без имени')}, точек: {len(route.get('points', []))}")

            statistics.increment_evacuation()
            return jsonify({
                'success': True,
                'route': route,
                'message': '🚨 ЭВАКУАЦИЯ! Следуйте по красному маршруту'
            })

        # Если нет сохраненных маршрутов - создаем стандартный
        default_route = {
            "name": "🚨 ЭВАКУАЦИОННЫЙ МАРШРУТ",
            "points": [
                {"x": 265, "y": 340, "floor": 1, "pointId": "start", "pointName": "Начало маршрута"},
                {"x": 200, "y": 300, "floor": 1, "pointId": "mid1", "pointName": "Поворот"},
                {"x": 150, "y": 350, "floor": 1, "pointId": "mid2", "pointName": "Коридор"},
                {"x": 100, "y": 340, "floor": 1, "pointId": "exit", "pointName": "ВЫХОД"}
            ],
            "type": "evacuation",
            "color": "#dc2626"
        }

        statistics.increment_evacuation()
        return jsonify({
            'success': True,
            'route': default_route,
            'message': '🚨 ЭВАКУАЦИЯ! Следуйте по красному маршруту'
        })

    except Exception as e:
        logger.error(f"Ошибка эвакуации: {e}")
        return jsonify({'error': str(e)}), 500


# ========== API УВЕДОМЛЕНИЙ ==========
@app.route('/api/evacuation/notify', methods=['POST'])
def evacuation_notify():
    """Получение уведомления об эвакуации от сервера"""
    try:
        data = request.json
        print(f"📢 Уведомление об эвакуации: {data.get('message')}")
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== API НАВИГАЦИИ ==========
@app.route('/api/navigate', methods=['POST'])
def navigate():
    try:
        data = request.json
        start_id = data.get('start_id')
        end_id = data.get('end_id')

        if not start_id or not end_id:
            return jsonify({'error': 'Missing ids'}), 400

        start_point = nav_manager.get_point(start_id)
        end_point = nav_manager.get_point(end_id)

        if not start_point or not end_point:
            return jsonify({'error': 'Points not found'}), 404

        # Ищем маршрут
        routes = load_routes()
        route_key = f"{start_id}_{end_id}"
        reverse_key = f"{end_id}_{start_id}"

        if route_key in routes:
            path = routes[route_key].get('points', [])
        elif reverse_key in routes:
            path = list(reversed(routes[reverse_key].get('points', [])))
        else:
            path = [
                {'x': start_point.x, 'y': start_point.y, 'floor': start_point.floor,
                 'pointId': start_point.id, 'pointName': start_point.name},
                {'x': end_point.x, 'y': end_point.y, 'floor': end_point.floor,
                 'pointId': end_point.id, 'pointName': end_point.name}
            ]

        # Расстояние
        distance = 0
        for i in range(len(path) - 1):
            distance += math.sqrt(
                (path[i + 1]['x'] - path[i]['x']) ** 2 +
                (path[i + 1]['y'] - path[i]['y']) ** 2
            )

        meters = round(distance * 0.5)
        minutes = max(1, round(meters / 70))

        # Статистика
        statistics.increment_navigation(start_id, end_id, start_point.name, end_point.name)

        return jsonify({
            'path': path,
            'distance': meters,
            'time': minutes
        })

    except Exception as e:
        logger.error(f"Ошибка навигации: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q', '')
    if len(query) < 2:
        return jsonify([])
    results = []
    for p in nav_manager.points:
        if query in p.name.lower() or query in p.description.lower():
            results.append({'id': p.id, 'name': p.name, 'category': p.category, 'floor': p.floor})
    return jsonify(results[:20])


# ========== API СТАТИСТИКИ ==========
@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        stats = statistics.get_stats()
        stats['total_points'] = len(nav_manager.points)
        stats['total_routes'] = len(load_routes())
        stats['total_evacuation_routes'] = len(load_evacuation_routes())
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== API QR-КОДОВ ==========
@app.route('/api/qr/<point_id>', methods=['GET'])
def generate_qr(point_id):
    try:
        point = nav_manager.get_point(point_id)
        if not point:
            return jsonify({'error': 'Point not found'}), 404

        os.makedirs('qr_codes', exist_ok=True)
        local_ip = get_local_ip()
        url = f"http://{local_ip}:8080/viewer?point={point_id}"

        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        qr_path = f'qr_codes/{point_id}.png'
        img.save(qr_path)
        return send_file(qr_path, mimetype='image/png')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== API ГОЛОСОВЫХ ПОДСКАЗОК ==========
VOICE_FILE = 'data/voice_prompts.json'


def load_voice_prompts():
    try:
        if os.path.exists(VOICE_FILE):
            with open(VOICE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except:
        pass
    return {}


def save_voice_prompts(prompts):
    try:
        os.makedirs('data', exist_ok=True)
        with open(VOICE_FILE, 'w', encoding='utf-8') as f:
            json.dump(prompts, f, ensure_ascii=False, indent=2)
    except:
        pass


@app.route('/api/voice-prompts', methods=['GET'])
def get_all_voice():
    return jsonify(load_voice_prompts())


@app.route('/api/voice-prompts/<route_key>', methods=['GET'])
def get_voice(route_key):
    prompts = load_voice_prompts()
    return jsonify(prompts.get(route_key, []))


@app.route('/api/voice-prompts/<route_key>', methods=['POST'])
def save_voice(route_key):
    try:
        data = request.json
        prompts = data.get('prompts', [])
        all_prompts = load_voice_prompts()
        all_prompts[route_key] = prompts
        save_voice_prompts(all_prompts)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== СТАТИЧЕСКИЕ ФАЙЛЫ ==========
@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


# ========== ЗАПУСК ==========
if __name__ == '__main__':
    # Создаем папки
    for folder in ['templates', 'static/css', 'static/js', 'static/images', 'qr_codes', 'data']:
        os.makedirs(folder, exist_ok=True)

    # Проверяем наличие эвакуационных маршрутов
    evac_routes = load_evacuation_routes()
    print(f"📢 Загружено эвакуационных маршрутов: {len(evac_routes)}")
    for key, route in evac_routes.items():
        print(f"   - {key}: {route.get('name', 'Без имени')} ({len(route.get('points', []))} точек)")

    local_ip = get_local_ip()

    points_by_floor = {1: 0, 2: 0, 3: 0}
    for point in nav_manager.points:
        points_by_floor[point.floor] = points_by_floor.get(point.floor, 0) + 1

    print("\n" + "=" * 70)
    print("🏫 ШКОЛЬНАЯ НАВИГАЦИЯ С ЭВАКУАЦИЕЙ")
    print("=" * 70)
    print(f"📱 Локальный адрес: http://localhost:8080")
    print(f"📱 С телефона: http://{local_ip}:8080")
    print("\n📌 ДОСТУПНЫЕ СТРАНИЦЫ:")
    print(f"   🏠 Главная: http://localhost:8080")
    print(f"   🗺️ Навигатор: http://localhost:8080/viewer")
    print(f"   ✏️ Редактор карты: http://localhost:8080/editor")
    print(f"   ⚙️ Админ-панель: http://localhost:8080/admin")
    print("=" * 70 + "\n")

    app.run(debug=True, host='0.0.0.0', port=8080)