"""
Генератор QR-кодов для всех точек навигации
Запустите этот скрипт для создания всех QR-кодов сразу
"""

import qrcode
import os
import json
import socket
from PIL import Image, ImageDraw, ImageFont


def get_local_ip():
    """Получение локального IP адреса компьютера"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "localhost"


def create_qr_with_label(data, filename, label_text, box_size=10):
    """Создание QR-кода с подписью"""
    # Создаем QR-код
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=box_size,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)

    # Создаем изображение QR-кода
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')

    # Создаем изображение с подписью
    qr_width, qr_height = qr_img.size

    # Пытаемся загрузить шрифт
    try:
        # Для Windows
        font_path = "C:\\Windows\\Fonts\\Arial.ttf"
        font = ImageFont.truetype(font_path, 20)
        small_font = ImageFont.truetype(font_path, 16)
    except:
        # Если шрифт не найден, используем стандартный
        font = ImageFont.load_default()
        small_font = ImageFont.load_default()

    # Создаем изображение с отступами для подписи
    padding = 20
    label_height = 60
    total_height = qr_height + label_height + padding * 2

    img = Image.new('RGB', (qr_width + padding * 2, total_height), 'white')

    # Вставляем QR-код
    img.paste(qr_img, (padding, padding))

    # Добавляем подпись
    draw = ImageDraw.Draw(img)

    # Разбиваем текст на строки
    lines = label_text.split('\n')
    y_position = qr_height + padding + 5

    for i, line in enumerate(lines):
        if i == 0:
            draw.text((padding, y_position), line, fill='black', font=font)
            y_position += 25
        else:
            draw.text((padding + 10, y_position), line, fill='#666666', font=small_font)
            y_position += 20

    # Сохраняем
    img.save(filename, quality=95)


def generate_all_qr_codes():
    """Генерация QR-кодов для всех точек"""

    # Получаем IP компьютера
    local_ip = get_local_ip()
    port = 8080

    print("=" * 70)
    print("🏫 ГЕНЕРАТОР QR-КОДОВ ДЛЯ ШКОЛЬНОЙ НАВИГАЦИИ")
    print("=" * 70)
    print(f"📱 IP адрес компьютера: {local_ip}")
    print(f"📱 Порт: {port}")
    print(f"📱 Полный адрес: http://{local_ip}:{port}/viewer?point=ID_ТОЧКИ")
    print()

    # Загружаем точки из файла
    try:
        with open('data/points.json', 'r', encoding='utf-8') as f:
            points = json.load(f)
        print(f"✅ Загружено {len(points)} точек из data/points.json")
    except FileNotFoundError:
        print("❌ Файл data/points.json не найден!")
        return
    except json.JSONDecodeError:
        print("❌ Ошибка в формате файла points.json")
        return

    # Создаем папку для QR-кодов
    qr_folder = 'qr_codes'
    os.makedirs(qr_folder, exist_ok=True)
    print(f"📁 Папка {qr_folder} создана")
    print()

    # Генерируем QR-код для каждой точки
    success_count = 0

    # Сортируем точки по этажам и названиям
    points_by_floor = {1: [], 2: [], 3: []}
    for point in points:
        floor = point.get('floor', 1)
        if floor in points_by_floor:
            points_by_floor[floor].append(point)

    for floor in [1, 2, 3]:
        floor_points = points_by_floor[floor]
        if not floor_points:
            continue

        print(f"\n🏢 {floor} ЭТАЖ:")
        print("-" * 50)

        # Сортируем по названию
        floor_points.sort(key=lambda x: x['name'])

        for point in floor_points:
            try:
                point_id = point['id']
                point_name = point['name']
                point_category = point.get('category', '')
                point_desc = point.get('description', '')

                # URL для точки
                url = f"http://{local_ip}:{port}/viewer?point={point_id}"

                # Текст для подписи
                label = f"{point_name}\n{point_desc}\n{floor} этаж"

                # Имя файла
                filename = f"{qr_folder}/{point_id}.png"

                # Создаем QR-код с подписью
                create_qr_with_label(url, filename, label, box_size=8)

                print(f"✅ {point_name} -> {filename}")
                success_count += 1

            except Exception as e:
                print(f"❌ Ошибка создания QR для {point.get('name', 'unknown')}: {e}")

    print("\n" + "=" * 70)
    print(f"🎉 ВСЕГО СОЗДАНО: {success_count} QR-кодов")
    print(f"📁 Они сохранены в папке: {qr_folder}")
    print("=" * 70)

    # Создаем HTML страницу для печати
    create_printable_page(qr_folder, points_by_floor, local_ip, port)


def create_printable_page(qr_folder, points_by_floor, local_ip, port):
    """Создание HTML страницы для печати всех QR-кодов"""

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>QR-коды для навигации по школе</title>
        <style>
            body {{ 
                font-family: Arial, sans-serif; 
                padding: 20px;
                margin: 0;
                background: #f5f5f5;
            }}
            h1 {{
                text-align: center;
                color: #2c3e50;
                margin-bottom: 30px;
                font-size: 28px;
            }}
            .ip-info {{
                text-align: center;
                background: #e8f4fd;
                padding: 15px;
                border-radius: 10px;
                margin-bottom: 30px;
                font-size: 18px;
                border: 2px solid #3498db;
            }}
            .ip-info code {{
                background: #2c3e50;
                color: white;
                padding: 5px 10px;
                border-radius: 5px;
                font-size: 20px;
            }}
            .floor-section {{
                margin-bottom: 40px;
                page-break-after: always;
            }}
            .floor-title {{
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                margin-bottom: 20px;
                font-size: 24px;
            }}
            .qr-grid {{ 
                display: grid; 
                grid-template-columns: repeat(4, 1fr);
                gap: 20px;
            }}
            .qr-item {{
                background: white;
                border: 1px solid #ddd;
                padding: 15px;
                text-align: center;
                border-radius: 10px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                page-break-inside: avoid;
            }}
            .qr-item img {{
                width: 100%;
                max-width: 200px;
                height: auto;
                margin: 10px 0;
                border: 1px solid #eee;
            }}
            .qr-item p {{
                margin: 5px 0;
                font-weight: bold;
                color: #2c3e50;
            }}
            .qr-item .floor-badge {{
                display: inline-block;
                padding: 3px 8px;
                background: #e8f4fd;
                color: #3498db;
                border-radius: 5px;
                font-size: 12px;
                margin-top: 5px;
            }}
            .qr-item .small {{
                font-size: 11px;
                color: #666;
            }}
            .instructions {{
                background: #fff3cd;
                border: 2px solid #ffc107;
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 30px;
            }}
            .instructions h3 {{
                color: #856404;
                margin-bottom: 10px;
            }}
            .instructions ol {{
                margin-left: 20px;
                color: #856404;
            }}
            .instructions li {{
                margin: 10px 0;
            }}
            @media print {{
                .qr-grid {{
                    grid-template-columns: repeat(4, 1fr);
                }}
                .floor-section {{
                    page-break-after: always;
                }}
                .ip-info {{
                    border: 1px solid #000;
                    background: none;
                }}
            }}
        </style>
    </head>
    <body>
        <h1>🏫 QR-коды для навигации по школе</h1>

        <div class="ip-info">
            <p>🌐 Для сканирования используйте адрес:</p>
            <code>http://{local_ip}:{port}</code>
            <p style="font-size: 14px; margin-top: 10px;">
                (Телефон должен быть в одной Wi-Fi сети с компьютером)
            </p>
        </div>

        <div class="instructions">
            <h3>📱 Как пользоваться:</h3>
            <ol>
                <li>Подключите телефон к той же Wi-Fi сети, что и компьютер</li>
                <li>Откройте приложение "Навигатор" на телефоне</li>
                <li>Нажмите "Сканировать QR-код" и разрешите доступ к камере</li>
                <li>Наведите камеру на нужный QR-код</li>
                <li>Ваше местоположение установится автоматически</li>
            </ol>
        </div>
    """

    # Добавляем каждый этаж
    for floor in [1, 2, 3]:
        if points_by_floor[floor]:
            html += f"""
        <div class="floor-section">
            <div class="floor-title">
                <h2>{floor} ЭТАЖ</h2>
            </div>
            <div class="qr-grid">
            """

            for point in points_by_floor[floor]:
                point_id = point['id']
                point_name = point['name']
                point_desc = point.get('description', '')

                html += f"""
                <div class="qr-item">
                    <p><strong>{point_name}</strong></p>
                    <img src="{qr_folder}/{point_id}.png" alt="{point_name}">
                    <p class="small">{point_desc}</p>
                    <span class="floor-badge">{floor} этаж</span>
                </div>
                """

            html += """
            </div>
        </div>
        """

    html += """
    </body>
    </html>
    """

    with open('qr_codes_print.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"📄 Создан файл для печати: qr_codes_print.html")
    print(f"📱 Откройте его в браузере и нажмите Ctrl+P для печати")


if __name__ == '__main__':
    generate_all_qr_codes()