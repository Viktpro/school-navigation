/**
 * Школьная навигационная система для трёх этажей
 * JavaScript для интерактивной карты и навигации
 */

class SchoolNavigation {
    constructor() {
        // Свойства класса
        this.points = [];
        this.currentPath = [];
        this.currentFloor = 1;
        this.mapImage = document.getElementById('school-map');
        this.canvas = document.getElementById('path-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.scanner = null;
        this.searchTimeout = null;

        // Инициализация
        this.init();
    }

    /**
     * Инициализация приложения
     */
    async init() {
        console.log('Инициализация навигационной системы для 3 этажей...');

        // Показываем загрузку
        this.showToast('Загрузка данных...', 'info');

        // Загружаем точки
        await this.loadPoints();

        // Заполняем выпадающие списки
        this.populateSelects();

        // Настраиваем обработчики событий
        this.setupEventListeners();

        // Проверяем параметры URL
        this.checkUrlParams();

        // Загружаем карту первого этажа
        this.loadFloorMap(1);

        console.log('Инициализация завершена');
    }

    /**
     * Загрузка точек с сервера
     */
    async loadPoints() {
        try {
            const response = await fetch('/api/points');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.points = await response.json();
            console.log(`Загружено ${this.points.length} точек`);

            // Группируем по этажам для статистики
            const floors = {};
            this.points.forEach(p => {
                floors[p.floor] = (floors[p.floor] || 0) + 1;
            });
            console.log('Точек по этажам:', floors);

        } catch (error) {
            console.error('Ошибка загрузки точек:', error);
            this.showToast('Ошибка загрузки данных с сервера', 'error');
        }
    }

    /**
     * Загрузка карты этажа
     */
    loadFloorMap(floor) {
        // Показываем загрузку
        document.getElementById('map-loading').style.display = 'block';
        document.getElementById('map-error').style.display = 'none';
        this.mapImage.style.display = 'none';

        // Устанавливаем путь к карте этажа
        this.mapImage.src = `/static/images/floor${floor}.jpg?t=${new Date().getTime()}`;

        this.mapImage.onload = () => {
            console.log(`Карта ${floor} этажа загружена`);
            this.canvas.width = this.mapImage.width;
            this.canvas.height = this.mapImage.height;
            this.mapImage.style.display = 'block';
            document.getElementById('map-loading').style.display = 'none';
            this.drawMap();
        };

        this.mapImage.onerror = () => {
            console.error(`Ошибка загрузки карты ${floor} этажа`);
            document.getElementById('map-loading').style.display = 'none';
            document.getElementById('map-error').style.display = 'block';
            this.showToast(`Не найдена карта ${floor} этажа`, 'error');
        };
    }

    /**
     * Заполнение выпадающих списков
     */
    populateSelects() {
        const startSelect = document.getElementById('start-point');
        const endSelect = document.getElementById('end-point');

        // Очищаем списки
        startSelect.innerHTML = '<option value="">Выберите точку...</option>';
        endSelect.innerHTML = '<option value="">Выберите точку...</option>';

        // Группируем по этажам
        for (let floor = 1; floor <= 3; floor++) {
            const floorPoints = this.points.filter(p => p.floor === floor);

            if (floorPoints.length > 0) {
                // Создаем группу для этажа
                const groupStart = document.createElement('optgroup');
                groupStart.label = `${floor} этаж (${floorPoints.length})`;

                const groupEnd = document.createElement('optgroup');
                groupEnd.label = `${floor} этаж (${floorPoints.length})`;

                // Сортируем по имени
                floorPoints.sort((a, b) => a.name.localeCompare(b.name));

                floorPoints.forEach(point => {
                    const optionStart = document.createElement('option');
                    optionStart.value = point.id;
                    optionStart.textContent = point.name;
                    optionStart.dataset.floor = point.floor;
                    optionStart.dataset.category = point.category;

                    const optionEnd = optionStart.cloneNode(true);

                    groupStart.appendChild(optionStart);
                    groupEnd.appendChild(optionEnd);
                });

                startSelect.appendChild(groupStart);
                endSelect.appendChild(groupEnd);
            }
        }
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Кнопка построения маршрута
        document.getElementById('build-route-btn').addEventListener('click', () => {
            this.buildRoute();
        });

        // Кнопка сканирования QR
        document.getElementById('scan-qr-btn').addEventListener('click', () => {
            this.openQRScanner();
        });

        // Кнопка отмены сканирования
        document.getElementById('cancel-scan').addEventListener('click', () => {
            this.closeQRScanner();
        });

        // Кнопки этажей
        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const floor = parseInt(e.target.dataset.floor);
                this.changeFloor(floor);
            });
        });

        // Поиск
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Закрытие поиска при клике вне
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.getElementById('search-results').style.display = 'none';
            }
        });

        // Закрытие инструкций
        document.getElementById('close-instructions').addEventListener('click', () => {
            document.getElementById('instructions-panel').style.display = 'none';
        });

        // Закрытие модального окна
        document.querySelector('.close-modal').addEventListener('click', () => {
            this.closeQRScanner();
        });

        // Закрытие по клику вне модального окна
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('qr-modal');
            if (e.target === modal) {
                this.closeQRScanner();
            }
        });
    }

    /**
     * Смена этажа
     */
    changeFloor(floor) {
        this.currentFloor = floor;

        // Обновляем активную кнопку
        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.floor) === floor);
        });

        // Загружаем карту этажа
        this.loadFloorMap(floor);
    }

    /**
     * Отрисовка карты и точек
     */
    drawMap() {
        if (!this.ctx || !this.mapImage.complete) return;

        // Очищаем канвас
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Рисуем точки текущего этажа
        const floorPoints = this.points.filter(p => p.floor === this.currentFloor);
        floorPoints.forEach(point => this.drawPoint(point));

        // Рисуем путь (только для текущего этажа)
        if (this.currentPath.length > 0) {
            this.drawPath();
        }
    }

    /**
     * Рисование точки на карте
     */
    drawPoint(point) {
        const ctx = this.ctx;

        // Цвета для разных категорий
        const colors = {
            'classroom': '#2196F3',
            'exit': '#4CAF50',
            'entrance': '#4CAF50',
            'toilet': '#FF9800',
            'stair': '#9C27B0',
            'staircase': '#9C27B0',
            'cafeteria': '#FF5722',
            'gym': '#E91E63',
            'library': '#795548',
            'office': '#607D8B',
            'hall': '#00BCD4',
            'medical': '#F44336'
        };

        const color = colors[point.category] || '#9E9E9E';

        // Рисуем точку
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Добавляем белую подложку для текста
        ctx.font = 'bold 12px Roboto, sans-serif';
        const textWidth = ctx.measureText(point.name).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(point.x + 12, point.y - 22, textWidth + 6, 18);

        // Рисуем подпись
        ctx.fillStyle = '#333';
        ctx.fillText(point.name, point.x + 15, point.y - 10);
    }

    /**
     * Рисование пути
     */
    drawPath() {
        const ctx = this.ctx;

        // Фильтруем точки пути по текущему этажу
        const pathPoints = this.currentPath.filter(p => p.floor === this.currentFloor);

        if (pathPoints.length < 2) return;

        // Рисуем линии
        ctx.beginPath();
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 4]);

        ctx.moveTo(pathPoints[0].x, pathPoints[0].y);

        for (let i = 1; i < pathPoints.length; i++) {
            ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
        }

        ctx.stroke();

        // Рисуем стрелки направления
        ctx.setLineDash([]);

        for (let i = 0; i < pathPoints.length - 1; i++) {
            const start = pathPoints[i];
            const end = pathPoints[i + 1];

            // Вычисляем угол
            const angle = Math.atan2(end.y - start.y, end.x - start.x);

            // Рисуем стрелку
            const arrowX = start.x + (end.x - start.x) * 0.7;
            const arrowY = start.y + (end.y - start.y) * 0.7;

            ctx.save();
            ctx.translate(arrowX, arrowY);
            ctx.rotate(angle);

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-10, -5);
            ctx.lineTo(-10, 5);
            ctx.closePath();
            ctx.fillStyle = '#4CAF50';
            ctx.fill();

            ctx.restore();
        }
    }

    /**
     * Построение маршрута
     */
    async buildRoute() {
        const startId = document.getElementById('start-point').value;
        const endId = document.getElementById('end-point').value;

        if (!startId) {
            this.showToast('Выберите начальную точку', 'warning');
            return;
        }

        if (!endId) {
            this.showToast('Выберите конечную точку', 'warning');
            return;
        }

        try {
            this.showToast('Построение маршрута...', 'info');

            const response = await fetch('/api/navigate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ start_id: startId, end_id: endId })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.currentPath = await response.json();

            if (this.currentPath.length === 0) {
                this.showToast('Маршрут не найден', 'error');
                return;
            }

            // Переключаемся на этаж начальной точки
            const startPoint = this.currentPath[0];
            this.changeFloor(startPoint.floor);

            // Показываем инструкции
            this.showInstructions();

            this.showToast('Маршрут построен', 'success');

        } catch (error) {
            console.error('Ошибка построения маршрута:', error);
            this.showToast('Ошибка построения маршрута', 'error');
        }
    }

    /**
     * Показ инструкций по маршруту
     */
    showInstructions() {
        if (this.currentPath.length === 0) return;

        const panel = document.getElementById('instructions-panel');
        const summary = document.getElementById('route-summary');
        const list = document.getElementById('route-instructions');

        // Очищаем список
        list.innerHTML = '';

        // Создаем инструкции
        for (let i = 0; i < this.currentPath.length - 1; i++) {
            const current = this.currentPath[i];
            const next = this.currentPath[i + 1];

            const li = document.createElement('li');

            if (current.floor !== next.floor) {
                li.innerHTML = `🚶 <strong>Переход на этаж ${next.floor}</strong><br>
                               От <strong>${current.name}</strong> идите к лестнице, затем к <strong>${next.name}</strong>`;
            } else {
                li.innerHTML = `🚶 От <strong>${current.name}</strong> идите к <strong>${next.name}</strong>`;
            }

            list.appendChild(li);
        }

        // Считаем количество переходов между этажами
        let floorChanges = 0;
        for (let i = 0; i < this.currentPath.length - 1; i++) {
            if (this.currentPath[i].floor !== this.currentPath[i + 1].floor) {
                floorChanges++;
            }
        }

        // Показываем суммарную информацию
        const startPoint = this.currentPath[0];
        const endPoint = this.currentPath[this.currentPath.length - 1];

        summary.innerHTML = `
            <strong>${startPoint.name}</strong> → <strong>${endPoint.name}</strong><br>
            📍 Этажей: ${floorChanges > 0 ? floorChanges + ' переход' : 'один этаж'}<br>
            🚶 Точек на пути: ${this.currentPath.length}
        `;

        panel.style.display = 'block';

        // Прокручиваем к инструкциям
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Открытие QR-сканера
     */
    openQRScanner() {
        const modal = document.getElementById('qr-modal');
        modal.style.display = 'block';

        // Создаем сканер
        this.scanner = new Html5Qrcode("qr-reader");

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };

        this.scanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => this.handleQRScan(decodedText),
            (error) => {
                // Игнорируем частые ошибки сканирования
                if (error?.message && !error.message.includes('No MultiFormat Readers')) {
                    console.log('QR Scan status:', error);
                }
            }
        );
    }

    /**
     * Закрытие QR-сканера
     */
    closeQRScanner() {
        if (this.scanner) {
            this.scanner.stop().then(() => {
                document.getElementById('qr-modal').style.display = 'none';
                this.scanner = null;
            }).catch(() => {
                document.getElementById('qr-modal').style.display = 'none';
                this.scanner = null;
            });
        } else {
            document.getElementById('qr-modal').style.display = 'none';
        }
    }

    /**
     * Обработка отсканированного QR-кода
     */
    handleQRScan(decodedText) {
        try {
            // Парсим URL
            const url = new URL(decodedText);
            const pointId = url.searchParams.get('point');

            if (pointId) {
                // Проверяем, существует ли такая точка
                const point = this.points.find(p => p.id === pointId);

                if (point) {
                    // Устанавливаем точку в выпадающий список
                    document.getElementById('start-point').value = pointId;

                    // Показываем уведомление
                    this.showToast(`📍 Текущее местоположение: ${point.name} (${point.floor} этаж)`, 'success');

                    // Закрываем сканер
                    this.closeQRScanner();
                } else {
                    this.showToast('Точка не найдена в базе данных', 'error');
                }
            } else {
                this.showToast('Неверный формат QR-кода', 'error');
            }
        } catch (error) {
            console.error('Ошибка обработки QR:', error);
            this.showToast('Ошибка обработки QR-кода', 'error');
        }
    }

    /**
     * Обработка поиска
     */
    handleSearch(query) {
        // Очищаем предыдущий таймер
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        if (query.length < 2) {
            document.getElementById('search-results').style.display = 'none';
            return;
        }

        // Устанавливаем таймер для избежания частых запросов
        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, 300);
    }

    /**
     * Выполнение поиска
     */
    async performSearch(query) {
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const results = await response.json();
            this.displaySearchResults(results);
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }

    /**
     * Отображение результатов поиска
     */
    displaySearchResults(results) {
        const container = document.getElementById('search-results');
        container.innerHTML = '';

        if (results.length === 0) {
            container.innerHTML = '<div class="search-result-item">Ничего не найдено</div>';
            container.style.display = 'block';
            return;
        }

        results.forEach(result => {
            const div = document.createElement('div');
            div.className = 'search-result-item';

            // Иконка в зависимости от категории
            let icon = '📍';
            if (result.category === 'classroom') icon = '📚';
            if (result.category === 'toilet') icon = '🚻';
            if (result.category === 'cafeteria') icon = '🍽️';
            if (result.category === 'exit') icon = '🚪';

            div.innerHTML = `
                <span class="result-name">${icon} ${result.name}</span>
                <span class="result-category">${result.floor} этаж</span>
            `;

            div.addEventListener('click', () => {
                document.getElementById('end-point').value = result.id;
                container.style.display = 'none';
                document.getElementById('search-input').value = '';
                this.showToast(`Выбрано: ${result.name}`, 'success');
            });

            container.appendChild(div);
        });

        container.style.display = 'block';
    }

    /**
     * Проверка параметров URL
     */
    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const pointId = urlParams.get('point');

        if (pointId) {
            const point = this.points.find(p => p.id === pointId);
            if (point) {
                document.getElementById('start-point').value = pointId;
                this.showToast(`📍 Текущее местоположение: ${point.name}`, 'success');
            }
        }
    }

    /**
     * Показ уведомления
     */
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
}

// Создание экземпляра класса при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SchoolNavigation();
});