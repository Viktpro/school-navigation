/**
 * Карта в стиле Google Maps
 * Чистые линии, мягкие цвета, скругленные углы
 */

class GoogleStyleMap {
    constructor() {
        this.canvas = document.getElementById('floor-plan');
        this.ctx = this.canvas.getContext('2d');

        // Размеры
        this.canvas.width = window.innerWidth - 360;
        this.canvas.height = window.innerHeight - 64;

        // Настройки карты
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.minScale = 0.5;
        this.maxScale = 3;

        // Данные
        this.points = [];
        this.currentFloor = 1;
        this.selectedPoint = null;
        this.startPoint = null;
        this.endPoint = null;
        this.routePoints = [];

        // Состояние
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.hoveredPoint = null;

        // Цветовая схема Google
        this.colors = {
            wall: '#dadce0',
            room: '#f1f3f4',
            door: '#9aa0a6',
            text: '#3c4043',

            classroom: '#1a73e8',
            entrance: '#34a853',
            toilet: '#f9ab00',
            stair: '#9334e8',
            elevator: '#e8710a',
            cafeteria: '#e5252d',
            hall: '#0d652d',

            route: '#1a73e8',
            start: '#34a853',
            end: '#e5252d'
        };

        this.init();
    }

    async init() {
        await this.loadPoints();
        this.setupEventListeners();
        this.draw();
        this.populatePlacesList();
    }

    async loadPoints() {
        try {
            const response = await fetch('/api/points');
            this.points = await response.json();
            console.log('✅ Загружено точек:', this.points.length);
        } catch (error) {
            console.error('❌ Ошибка загрузки:', error);
        }
    }

    setupEventListeners() {
        // Управление мышью
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));

        // Кнопки управления
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('reset-view').addEventListener('click', () => this.resetView());

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
        document.getElementById('build-route-btn').addEventListener('click', () => {
            this.buildRoute();
        });

        // Смена направления
        document.getElementById('swap-route').addEventListener('click', () => {
            [this.startPoint, this.endPoint] = [this.endPoint, this.startPoint];
            this.updateLocationDisplay();
            if (this.startPoint && this.endPoint) {
                this.buildRoute();
            }
            this.draw();
        });

        // Изменение размера окна
        window.addEventListener('resize', () => this.onResize());
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Рисуем базовую сетку
        this.drawGrid();

        // Рисуем стены и комнаты
        this.drawFloorPlan();

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

    drawGrid() {
        this.ctx.strokeStyle = '#e5e5e5';
        this.ctx.lineWidth = 1 / this.scale;

        const step = 50;
        const startX = -this.offsetX / this.scale;
        const startY = -this.offsetY / this.scale;
        const endX = startX + this.canvas.width / this.scale;
        const endY = startY + this.canvas.height / this.scale;

        // Вертикальные линии
        for (let x = Math.floor(startX / step) * step; x < endX; x += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }

        // Горизонтальные линии
        for (let y = Math.floor(startY / step) * step; y < endY; y += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
    }

    drawFloorPlan() {
        // Здесь можно добавить стены из сохраненной карты
        // Пока рисуем примерные стены

        this.ctx.strokeStyle = this.colors.wall;
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Внешний контур
        this.ctx.strokeRect(50, 50, 700, 500);

        // Внутренние стены
        this.ctx.beginPath();
        this.ctx.moveTo(50, 200);
        this.ctx.lineTo(750, 200);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(300, 50);
        this.ctx.lineTo(300, 550);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(500, 200);
        this.ctx.lineTo(500, 550);
        this.ctx.stroke();
    }

    drawPoints() {
        const floorPoints = this.points.filter(p => p.floor === this.currentFloor);

        floorPoints.forEach(point => {
            const isHovered = this.hoveredPoint?.id === point.id;
            const isSelected = this.selectedPoint?.id === point.id;
            const isStart = this.startPoint?.id === point.id;
            const isEnd = this.endPoint?.id === point.id;

            this.drawPoint(point, { isHovered, isSelected, isStart, isEnd });
        });
    }

    drawPoint(point, state) {
        const ctx = this.ctx;
        const baseRadius = 12 / this.scale;
        let radius = baseRadius;

        if (state.isStart || state.isEnd) {
            radius = baseRadius * 1.2;
        }

        // Тень
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 8 / this.scale;
        ctx.shadowOffsetY = 2 / this.scale;

        // Определяем цвет
        let color = this.colors[point.category] || '#9aa0a6';

        if (state.isStart) {
            color = this.colors.start;
        } else if (state.isEnd) {
            color = this.colors.end;
        }

        // Рисуем точку
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);

        // Градиент для объема
        const gradient = ctx.createRadialGradient(
            point.x - radius/3, point.y - radius/3, radius/3,
            point.x, point.y, radius * 1.5
        );
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, this.darkenColor(color));

        ctx.fillStyle = gradient;
        ctx.fill();

        // Обводка
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2 / this.scale;
        ctx.stroke();

        // Иконка
        ctx.fillStyle = 'white';
        ctx.font = `${14 / this.scale}px 'Google Sans', Roboto`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let icon = '📍';
        if (point.category === 'classroom') icon = '📚';
        else if (point.category === 'toilet') icon = '🚻';
        else if (point.category === 'cafeteria') icon = '🍽️';
        else if (point.category === 'entrance') icon = '🚪';
        else if (point.category === 'stair') icon = '⬆️';
        else if (point.category === 'elevator') icon = '🛗';

        if (state.isStart) icon = '📍';
        if (state.isEnd) icon = '🏁';

        ctx.fillText(icon, point.x, point.y - 1);

        // Подпись
        if (this.scale > 0.7 || state.isHovered) {
            ctx.shadowColor = 'white';
            ctx.shadowBlur = 4 / this.scale;
            ctx.font = `500 ${12 / this.scale}px 'Google Sans', Roboto`;
            ctx.fillStyle = this.colors.text;
            ctx.fillText(point.name, point.x, point.y - 25 / this.scale);
        }

        // Пульсация для стартовой точки
        if (state.isStart) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 15 / this.scale;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius * 1.5, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(52,168,83,0.2)';
            ctx.fill();
        }
    }

    drawRoute() {
        if (this.routePoints.length < 2) return;

        const ctx = this.ctx;

        // Фильтруем точки текущего этажа
        const floorPoints = this.routePoints.filter(p => p.floor === this.currentFloor);

        if (floorPoints.length < 2) return;

        // Рисуем линию
        ctx.beginPath();
        ctx.strokeStyle = this.colors.route;
        ctx.lineWidth = 4 / this.scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(26,115,232,0.3)';
        ctx.shadowBlur = 10 / this.scale;
        ctx.shadowOffsetY = 2 / this.scale;

        ctx.moveTo(floorPoints[0].x, floorPoints[0].y);

        for (let i = 1; i < floorPoints.length; i++) {
            // Добавляем кривую Безье для плавности
            const prev = floorPoints[i-1];
            const curr = floorPoints[i];

            const cp1x = prev.x + (curr.x - prev.x) * 0.3;
            const cp1y = prev.y;
            const cp2x = prev.x + (curr.x - prev.x) * 0.7;
            const cp2y = curr.y;

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, curr.x, curr.y);
        }

        ctx.stroke();

        // Стрелки направления
        for (let i = 0; i < floorPoints.length - 1; i++) {
            const start = floorPoints[i];
            const end = floorPoints[i + 1];

            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const dist = Math.sqrt(
                Math.pow(end.x - start.x, 2) +
                Math.pow(end.y - start.y, 2)
            );

            if (dist > 50) {
                const arrowX = start.x + (end.x - start.x) * 0.6;
                const arrowY = start.y + (end.y - start.y) * 0.6;

                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-12 / this.scale, -6 / this.scale);
                ctx.lineTo(-12 / this.scale, 6 / this.scale);
                ctx.closePath();
                ctx.fillStyle = 'white';
                ctx.shadowColor = 'rgba(26,115,232,0.5)';
                ctx.shadowBlur = 8 / this.scale;
                ctx.fill();

                ctx.restore();
            }
        }

        ctx.shadowColor = 'transparent';
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offsetX) / this.scale;
        const y = (e.clientY - rect.top - this.offsetY) / this.scale;

        if (e.button === 0) {
            // Ищем точку под курсором
            const clickedPoint = this.findNearestPoint(x, y, 20);

            if (clickedPoint) {
                this.selectedPoint = clickedPoint;
                this.showInfoCard(clickedPoint);
                this.draw();
            } else {
                this.isDragging = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                document.getElementById('info-card').classList.remove('active');
            }
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
            // Подсветка при наведении
            const hovered = this.findNearestPoint(x, y, 15);
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

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - this.offsetX) / this.scale;
        const worldY = (mouseY - this.offsetY) / this.scale;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(this.scale * delta, this.minScale), this.maxScale);

        // Корректируем смещение, чтобы масштабирование было относительно курсора
        this.offsetX = mouseX - worldX * newScale;
        this.offsetY = mouseY - worldY * newScale;
        this.scale = newScale;

        this.draw();
    }

    findNearestPoint(x, y, threshold = 20) {
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

    showInfoCard(point) {
        const card = document.getElementById('info-card');
        document.getElementById('info-title').textContent = point.name;
        document.getElementById('info-category').textContent = this.getCategoryName(point.category);
        document.getElementById('info-description').textContent = point.description || `${point.floor} этаж`;

        card.classList.add('active');
    }

    getCategoryName(category) {
        const names = {
            'classroom': 'Класс',
            'entrance': 'Вход',
            'toilet': 'Туалет',
            'stair': 'Лестница',
            'elevator': 'Лифт',
            'cafeteria': 'Столовая',
            'hall': 'Зал'
        };
        return names[category] || category;
    }

    setAsStart() {
        if (this.selectedPoint) {
            this.startPoint = this.selectedPoint;
            document.getElementById('start-location').textContent = this.startPoint.name;
            document.getElementById('info-card').classList.remove('active');
            this.draw();
        }
    }

    setAsEnd() {
        if (this.selectedPoint) {
            this.endPoint = this.selectedPoint;
            document.getElementById('end-location').textContent = this.endPoint.name;
            document.getElementById('info-card').classList.remove('active');
            this.draw();
        }
    }

    buildRoute() {
        if (!this.startPoint || !this.endPoint) {
            alert('Выберите начальную и конечную точки');
            return;
        }

        // Строим маршрут
        this.routePoints = [this.startPoint];

        // Добавляем промежуточные точки при необходимости
        if (this.startPoint.floor !== this.endPoint.floor) {
            // Ищем лестницу
            const stairs = this.points.filter(p =>
                p.category === 'stair' && p.floor === this.startPoint.floor
            );
            if (stairs.length > 0) {
                this.routePoints.push(stairs[0]);
            }

            const stairs2 = this.points.filter(p =>
                p.category === 'stair' && p.floor === this.endPoint.floor
            );
            if (stairs2.length > 0) {
                this.routePoints.push(stairs2[0]);
            }
        }

        this.routePoints.push(this.endPoint);

        // Удаляем дубликаты
        const unique = [];
        const seen = new Set();
        for (const point of this.routePoints) {
            if (!seen.has(point.id)) {
                unique.push(point);
                seen.add(point.id);
            }
        }
        this.routePoints = unique;

        // Рассчитываем расстояние
        let totalDistance = 0;
        for (let i = 0; i < this.routePoints.length - 1; i++) {
            const dx = this.routePoints[i].x - this.routePoints[i+1].x;
            const dy = this.routePoints[i].y - this.routePoints[i+1].y;
            totalDistance += Math.sqrt(dx*dx + dy*dy);
        }

        const meters = Math.round(totalDistance * 0.5);
        const minutes = Math.max(1, Math.round(meters / 70));

        // Показываем карточку маршрута
        document.getElementById('route-distance').textContent = `${minutes} мин`;
        document.getElementById('route-time').textContent = `${meters} м`;

        const steps = [];
        for (let i = 0; i < this.routePoints.length - 1; i++) {
            if (this.routePoints[i].floor !== this.routePoints[i+1].floor) {
                steps.push(`⬆️ Этаж ${this.routePoints[i+1].floor}`);
            }
        }
        document.getElementById('route-steps').innerHTML = steps.join(' • ');

        document.getElementById('route-card').style.display = 'flex';

        // Переключаемся на этаж старта
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
        this.offsetX = this.canvas.width / 2 - 400;
        this.offsetY = this.canvas.height / 2 - 300;
        this.draw();
    }

    updateScale() {
        const metersPerPixel = 0.5 / this.scale;
        const scaleInMeters = Math.round(100 * metersPerPixel);
        document.getElementById('scale-value').textContent = `${scaleInMeters} м`;
    }

    handleSearch(query) {
        if (query.length < 2) return;

        const results = this.points.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.description.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);

        // Здесь можно показать результаты поиска
        console.log('Результаты поиска:', results);
    }

    populatePlacesList() {
        const container = document.getElementById('places-list');

        // Группируем по этажам
        for (let floor = 1; floor <= 3; floor++) {
            const floorPoints = this.points.filter(p => p.floor === floor);

            if (floorPoints.length > 0) {
                floorPoints.forEach(point => {
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
                                <span>${point.floor} этаж</span>
                                <span>${this.getCategoryName(point.category)}</span>
                            </div>
                        </div>
                    `;

                    div.addEventListener('click', () => {
                        this.selectedPoint = point;
                        this.centerOnPoint(point);
                        this.showInfoCard(point);

                        document.querySelectorAll('.place-item').forEach(item => {
                            item.classList.remove('selected');
                        });
                        div.classList.add('selected');
                    });

                    container.appendChild(div);
                });
            }
        }
    }

    centerOnPoint(point) {
        this.offsetX = this.canvas.width / 2 - point.x * this.scale;
        this.offsetY = this.canvas.height / 2 - point.y * this.scale;
        this.changeFloor(point.floor);
        this.draw();
    }

    updateLocationDisplay() {
        document.getElementById('start-location').textContent =
            this.startPoint ? this.startPoint.name : 'Не выбрано';
        document.getElementById('end-location').textContent =
            this.endPoint ? this.endPoint.name : 'Не выбрано';
    }

    darkenColor(color) {
        // Затемнение цвета для градиента
        return color + 'dd';
    }

    onResize() {
        this.canvas.width = window.innerWidth - 360;
        this.canvas.height = window.innerHeight - 64;
        this.draw();
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.map = new GoogleStyleMap();
});