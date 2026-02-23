/**
 * Карта в стиле Яндекс/Google/2ГИС
 * Полноценная навигационная карта с управлением
 */

class YandexStyleMap {
    constructor() {
        this.canvas = document.getElementById('main-map');
        this.ctx = this.canvas.getContext('2d');

        // Настройки карты
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.minScale = 0.5;
        this.maxScale = 3;

        // Данные
        this.points = [];
        this.floors = {
            1: { walls: [], rooms: [], label: '1 этаж' },
            2: { walls: [], rooms: [], label: '2 этаж' },
            3: { walls: [], rooms: [], label: '3 этаж' }
        };
        this.currentFloor = 1;

        // Состояние
        this.selectedPoint = null;
        this.startPoint = null;
        this.endPoint = null;
        this.routePoints = [];
        this.hoveredPoint = null;

        // Управление картой
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;

        // Размеры
        this.canvas.width = window.innerWidth - 400;
        this.canvas.height = window.innerHeight;

        this.init();
        this.setupEventListeners();
    }

    async init() {
        await this.loadData();
        this.draw();
        this.setupResizeHandler();
    }

    async loadData() {
        try {
            // Загружаем точки
            const pointsResponse = await fetch('/api/points');
            this.points = await pointsResponse.json();

            // Загружаем сохраненную карту
            const mapResponse = await fetch('/api/load-map');
            const mapData = await mapResponse.json();

            if (mapData.floors) {
                this.floors = mapData.floors;
            }

            console.log('Карта загружена:', this.points.length, 'точек');
            this.updatePlacesList();
        } catch (error) {
            console.error('Ошибка загрузки:', error);
        }
    }

    setupEventListeners() {
        // Управление картой мышью
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));

        // Кнопки управления
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('reset-view').addEventListener('click', () => this.resetView());
        document.getElementById('my-location').addEventListener('click', () => this.goToMyLocation());
        document.getElementById('layer-switch').addEventListener('click', () => this.toggleLayer());

        // Переключение этажей
        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const floor = parseInt(btn.dataset.floor);
                this.changeFloor(floor);
            });
        });

        // Поиск
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Кнопка построения маршрута
        document.getElementById('build-route').addEventListener('click', () => {
            this.buildRoute();
        });

        // Кнопка сканирования QR
        document.getElementById('scan-qr').addEventListener('click', () => {
            this.openQRScanner();
        });

        // Сворачивание боковой панели
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('collapsed');
        });

        // Категории
        document.querySelectorAll('.category-item').forEach(cat => {
            cat.addEventListener('click', () => {
                this.filterByCategory(cat.dataset.category);
            });
        });

        // Изменение размера окна
        window.addEventListener('resize', () => this.onResize());
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Рисуем базовую карту
        this.drawBaseMap();

        // Рисуем стены и комнаты текущего этажа
        this.drawFloor();

        // Рисуем точки
        this.drawPoints();

        // Рисуем маршрут
        if (this.routePoints.length > 0) {
            this.drawRoute();
        }

        this.ctx.restore();

        // Обновляем масштаб
        this.updateScale();
    }

    drawBaseMap() {
        // Сетка как в Яндекс картах
        this.ctx.strokeStyle = '#E5E5E5';
        this.ctx.lineWidth = 1 / this.scale;

        const step = 50;
        const width = this.canvas.width / this.scale;
        const height = this.canvas.height / this.scale;

        // Вертикальные линии
        for (let x = -this.offsetX / this.scale; x < width; x += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, -this.offsetY / this.scale);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Горизонтальные линии
        for (let y = -this.offsetY / this.scale; y < height; y += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(-this.offsetX / this.scale, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        // Центральная точка
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 5 / this.scale, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'rgba(30, 152, 255, 0.3)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'var(--primary)';
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.stroke();
    }

    drawFloor() {
        const floor = this.floors[this.currentFloor];

        // Рисуем стены
        this.ctx.strokeStyle = '#2C3E50';
        this.ctx.lineWidth = 4 / this.scale;
        this.ctx.lineCap = 'round';

        floor.walls.forEach(wall => {
            this.ctx.beginPath();
            this.ctx.moveTo(wall.x1, wall.y1);
            this.ctx.lineTo(wall.x2, wall.y2);
            this.ctx.stroke();
        });

        // Рисуем комнаты
        floor.rooms.forEach(room => {
            // Заливка
            this.ctx.fillStyle = room.color + '20';
            this.ctx.fillRect(room.x, room.y, room.width, room.height);

            // Границы
            this.ctx.strokeStyle = room.color;
            this.ctx.lineWidth = 2 / this.scale;
            this.ctx.strokeRect(room.x, room.y, room.width, room.height);

            // Название комнаты
            this.ctx.fillStyle = '#1C1C1E';
            this.ctx.font = `bold ${14 / this.scale}px -apple-system`;
            this.ctx.fillText(room.name, room.x + 5, room.y + 20);
        });
    }

    drawPoints() {
        const floorPoints = this.points.filter(p => p.floor === this.currentFloor);

        floorPoints.forEach(point => {
            const isSelected = this.selectedPoint?.id === point.id;
            const isHovered = this.hoveredPoint?.id === point.id;
            const isStart = this.startPoint?.id === point.id;
            const isEnd = this.endPoint?.id === point.id;

            this.drawPoint(point, { isSelected, isHovered, isStart, isEnd });
        });
    }

    drawPoint(point, state = {}) {
        const colors = {
            classroom: '#1E98FF',
            entrance: '#34C759',
            toilet: '#FF9F0A',
            stair: '#AF52DE',
            elevator: '#5856D6',
            cafeteria: '#FF3B30',
            hall: '#8E8E93'
        };

        let color = colors[point.category] || '#8E8E93';

        // Тень
        this.ctx.shadowColor = 'rgba(0,0,0,0.3)';
        this.ctx.shadowBlur = 10 / this.scale;
        this.ctx.shadowOffsetY = 3 / this.scale;

        // Размер точки в зависимости от состояния
        let radius = 12 / this.scale;
        if (state.isSelected || state.isStart || state.isEnd) radius = 16 / this.scale;
        if (state.isHovered) radius = 14 / this.scale;

        // Градиент
        const gradient = this.ctx.createRadialGradient(
            point.x - 3, point.y - 3, 2,
            point.x, point.y, radius * 1.5
        );
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, this.darkenColor(color));

        // Круг
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Обводка для выделенных
        if (state.isSelected || state.isStart || state.isEnd) {
            this.ctx.shadowBlur = 15 / this.scale;
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3 / this.scale;
            this.ctx.stroke();
        }

        this.ctx.shadowBlur = 0;

        // Иконка
        this.ctx.fillStyle = 'white';
        this.ctx.font = `${14 / this.scale}px -apple-system`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        let icon = '📍';
        if (point.category === 'classroom') icon = '📚';
        else if (point.category === 'toilet') icon = '🚻';
        else if (point.category === 'cafeteria') icon = '🍽️';
        else if (point.category === 'entrance') icon = '🚪';
        else if (point.category === 'stair') icon = '⬆️';
        else if (point.category === 'elevator') icon = '🛗';

        this.ctx.fillText(icon, point.x, point.y - 1);

        // Подпись
        if (this.scale > 0.8 || state.isHovered) {
            this.ctx.shadowColor = 'white';
            this.ctx.shadowBlur = 5 / this.scale;
            this.ctx.font = `bold ${11 / this.scale}px -apple-system`;
            this.ctx.fillStyle = '#1C1C1E';
            this.ctx.fillText(point.name, point.x, point.y - 25 / this.scale);
        }

        this.ctx.shadowColor = 'transparent';
    }

    drawRoute() {
        if (this.routePoints.length < 2) return;

        this.ctx.beginPath();
        this.ctx.strokeStyle = '#1E98FF';
        this.ctx.lineWidth = 6 / this.scale;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.setLineDash([15 / this.scale, 10 / this.scale]);

        this.ctx.moveTo(this.routePoints[0].x, this.routePoints[0].y);

        for (let i = 1; i < this.routePoints.length; i++) {
            this.ctx.lineTo(this.routePoints[i].x, this.routePoints[i].y);
        }

        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Стрелки направления
        for (let i = 0; i < this.routePoints.length - 1; i++) {
            const start = this.routePoints[i];
            const end = this.routePoints[i + 1];

            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const distance = Math.sqrt(
                Math.pow(end.x - start.x, 2) +
                Math.pow(end.y - start.y, 2)
            );

            if (distance > 50) {
                const arrowX = start.x + (end.x - start.x) * 0.7;
                const arrowY = start.y + (end.y - start.y) * 0.7;

                this.ctx.save();
                this.ctx.translate(arrowX, arrowY);
                this.ctx.rotate(angle);

                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(-15 / this.scale, -7 / this.scale);
                this.ctx.lineTo(-15 / this.scale, 7 / this.scale);
                this.ctx.closePath();
                this.ctx.fillStyle = '#1E98FF';
                this.ctx.fill();

                this.ctx.restore();
            }
        }
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offsetX) / this.scale;
        const y = (e.clientY - rect.top - this.offsetY) / this.scale;

        if (e.button === 0 && !e.ctrlKey) {
            // Выбор точки
            const clickedPoint = this.findNearestPoint(x, y);
            if (clickedPoint) {
                this.selectPoint(clickedPoint);
            } else {
                this.isDragging = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
            }
        } else if (e.button === 0 && e.ctrlKey) {
            // Перетаскивание карты
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        }
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offsetX) / this.scale;
        const y = (e.clientY - rect.top - this.offsetY) / this.scale;

        if (this.isDragging) {
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            this.offsetX += dx;
            this.offsetY += dy;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.draw();
        } else {
            // Подсветка точки при наведении
            const hovered = this.findNearestPoint(x, y, 20);
            if (hovered !== this.hoveredPoint) {
                this.hoveredPoint = hovered;
                this.draw();
            }
        }
    }

    onMouseUp() {
        this.isDragging = false;
    }

    onWheel(e) {
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= delta;
        this.scale = Math.min(Math.max(this.minScale, this.scale), this.maxScale);

        this.draw();
    }

    findNearestPoint(x, y, threshold = 30) {
        const floorPoints = this.points.filter(p => p.floor === this.currentFloor);
        let nearest = null;
        let minDist = Infinity;

        floorPoints.forEach(point => {
            const dist = Math.sqrt(
                Math.pow(point.x - x, 2) +
                Math.pow(point.y - y, 2)
            );

            if (dist < threshold && dist < minDist) {
                minDist = dist;
                nearest = point;
            }
        });

        return nearest;
    }

    selectPoint(point) {
        this.selectedPoint = point;
        this.showBalloon(point);
        this.draw();

        // Подсветка в списке
        document.querySelectorAll('.place-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.id === point.id);
        });
    }

    showBalloon(point) {
        const balloon = document.getElementById('balloon');
        const rect = this.canvas.getBoundingClientRect();

        // Переводим координаты карты в координаты экрана
        const screenX = point.x * this.scale + this.offsetX + rect.left;
        const screenY = point.y * this.scale + this.offsetY + rect.top;

        balloon.style.left = screenX + 'px';
        balloon.style.top = screenY + 'px';

        balloon.innerHTML = `
            <div class="balloon-title">${point.name}</div>
            <div class="balloon-address">${point.floor} этаж • ${point.category}</div>
            <div class="balloon-actions">
                <button class="balloon-btn" onclick="window.map.setAsStart('${point.id}')">
                    <span>🚶</span> Отсюда
                </button>
                <button class="balloon-btn" onclick="window.map.setAsEnd('${point.id}')">
                    <span>🏁</span> Сюда
                </button>
                <button class="balloon-btn" onclick="window.map.centerOnPoint('${point.id}')">
                    <span>🎯</span> Центр
                </button>
            </div>
        `;

        balloon.classList.add('active');
    }

    setAsStart(pointId) {
        this.startPoint = this.points.find(p => p.id === pointId);
        document.getElementById('start-location').textContent = this.startPoint.name;
        document.getElementById('route-panel').classList.remove('active');
        document.getElementById('balloon').classList.remove('active');
        this.draw();
    }

    setAsEnd(pointId) {
        this.endPoint = this.points.find(p => p.id === pointId);
        document.getElementById('end-location').textContent = this.endPoint.name;
        document.getElementById('route-panel').classList.add('active');
        document.getElementById('balloon').classList.remove('active');
        this.draw();
    }

    centerOnPoint(pointId) {
        const point = this.points.find(p => p.id === pointId);
        if (point) {
            this.offsetX = this.canvas.width / 2 - point.x * this.scale;
            this.offsetY = this.canvas.height / 2 - point.y * this.scale;
            this.draw();
            document.getElementById('balloon').classList.remove('active');
        }
    }

    buildRoute() {
        if (!this.startPoint || !this.endPoint) {
            alert('Выберите начальную и конечную точки');
            return;
        }

        this.routePoints = [this.startPoint];

        // Если разные этажи, добавляем лестницу
        if (this.startPoint.floor !== this.endPoint.floor) {
            const stairs = this.points.filter(p =>
                p.category === 'stair' &&
                p.floor === this.startPoint.floor
            );

            if (stairs.length > 0) {
                this.routePoints.push(stairs[0]);
            }

            const stairs2 = this.points.filter(p =>
                p.category === 'stair' &&
                p.floor === this.endPoint.floor
            );

            if (stairs2.length > 0) {
                this.routePoints.push(stairs2[0]);
            }
        }

        this.routePoints.push(this.endPoint);

        // Расчет расстояния
        let totalDistance = 0;
        for (let i = 0; i < this.routePoints.length - 1; i++) {
            const dx = this.routePoints[i].x - this.routePoints[i+1].x;
            const dy = this.routePoints[i].y - this.routePoints[i+1].y;
            totalDistance += Math.sqrt(dx*dx + dy*dy);
        }

        const meters = Math.round(totalDistance * 0.5);
        const minutes = Math.max(1, Math.round(meters / 80));

        document.getElementById('route-distance').textContent = `${minutes} мин`;
        document.getElementById('route-time').innerHTML = `🚶 ${meters} м`;

        // Обновляем шаги
        const stepsContainer = document.getElementById('route-steps');
        stepsContainer.innerHTML = '';

        this.routePoints.forEach((point, i) => {
            if (i < this.routePoints.length - 1) {
                const step = document.createElement('div');
                step.className = 'route-step';
                step.innerHTML = `
                    <div class="step-marker">${i+1}</div>
                    <div>
                        <strong>${point.name}</strong>
                        <div style="color: var(--gray); font-size: 12px;">
                            → ${this.routePoints[i+1].name}
                        </div>
                    </div>
                `;
                stepsContainer.appendChild(step);
            }
        });

        this.changeFloor(this.startPoint.floor);
        this.draw();
    }

    changeFloor(floor) {
        this.currentFloor = floor;
        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.floor) === floor);
        });
        this.draw();
    }

    zoomIn() {
        this.scale = Math.min(this.scale * 1.2, this.maxScale);
        this.draw();
    }

    zoomOut() {
        this.scale = Math.max(this.scale / 1.2, this.minScale);
        this.draw();
    }

    resetView() {
        this.scale = 1;
        this.offsetX = this.canvas.width / 2 - 500;
        this.offsetY = this.canvas.height / 2 - 400;
        this.draw();
    }

    goToMyLocation() {
        // В реальности здесь должен быть GPS
        this.centerOnPoint('central_entrance');
    }

    toggleLayer() {
        // Переключение слоев карты
        alert('Переключение слоев будет добавлено');
    }

    handleSearch(query) {
        if (query.length < 2) {
            document.getElementById('search-results').style.display = 'none';
            return;
        }

        const results = this.points.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);

        const container = document.getElementById('search-results');
        container.innerHTML = '';

        results.forEach(point => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `
                <span>${point.name}</span>
                <small>${point.floor} этаж</small>
            `;
            div.onclick = () => {
                this.centerOnPoint(point.id);
                this.selectPoint(point);
                document.getElementById('search-input').value = point.name;
                container.style.display = 'none';
            };
            container.appendChild(div);
        });

        container.style.display = 'block';
    }

    filterByCategory(category) {
        document.querySelectorAll('.category-item').forEach(cat => {
            cat.classList.toggle('active', cat.dataset.category === category);
        });

        // Показываем только выбранную категорию
        const places = document.querySelectorAll('.place-item');
        places.forEach(place => {
            if (category === 'all') {
                place.style.display = 'flex';
            } else {
                const point = this.points.find(p => p.id === place.dataset.id);
                place.style.display = point?.category === category ? 'flex' : 'none';
            }
        });
    }

    updatePlacesList() {
        const container = document.getElementById('places-list');
        container.innerHTML = '';

        this.points.forEach(point => {
            const div = document.createElement('div');
            div.className = 'place-item';
            div.dataset.id = point.id;

            let icon = '📍';
            if (point.category === 'classroom') icon = '📚';
            else if (point.category === 'toilet') icon = '🚻';
            else if (point.category === 'cafeteria') icon = '🍽️';

            div.innerHTML = `
                <div class="place-icon">${icon}</div>
                <div class="place-info">
                    <div class="place-name">${point.name}</div>
                    <div class="place-meta">
                        <span>📍 ${point.floor} этаж</span>
                        <span class="place-rating">⭐ 4.5</span>
                    </div>
                </div>
            `;

            div.onclick = () => {
                this.centerOnPoint(point.id);
                this.selectPoint(point);
            };

            container.appendChild(div);
        });
    }

    updateScale() {
        const scaleElement = document.getElementById('map-scale-value');
        const metersPerPixel = 0.5 / this.scale;
        const scaleInMeters = Math.round(100 * metersPerPixel * 100);
        scaleElement.textContent = `${scaleInMeters} м`;
    }

    onResize() {
        this.canvas.width = window.innerWidth - 400;
        this.canvas.height = window.innerHeight;
        this.draw();
    }

    darkenColor(color) {
        return color + 'dd';
    }

    openQRScanner() {
        // Здесь код для QR сканера
        alert('Сканирование QR-кода');
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.map = new YandexStyleMap();
});