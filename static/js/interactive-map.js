/**
 * Интерактивная карта школы на Canvas
 * Позволяет рисовать этажи и управлять точками
 */

class InteractiveMap {
    constructor() {
        this.canvas = document.getElementById('interactive-map');
        this.ctx = this.canvas.getContext('2d');
        this.currentFloor = 1;
        this.floors = {
            1: { walls: [], rooms: [], doors: [], points: [] },
            2: { walls: [], rooms: [], doors: [], points: [] },
            3: { walls: [], rooms: [], doors: [], points: [] }
        };

        // Режимы редактирования
        this.mode = 'view'; // view, draw_wall, draw_room, add_point, move_point
        this.drawing = false;
        this.startX = 0;
        this.startY = 0;
        this.selectedPoint = null;
        this.selectedTool = 'select';

        // Настройки canvas
        this.canvas.width = 1200;
        this.canvas.height = 800;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;

        // Цвета
        this.colors = {
            wall: '#2c3e50',
            room: '#3498db',
            door: '#e67e22',
            point: {
                classroom: '#3498db',
                entrance: '#27ae60',
                toilet: '#e67e22',
                stair: '#9b59b6',
                elevator: '#f1c40f',
                cafeteria: '#e74c3c',
                hall: '#1abc9c'
            }
        };

        this.init();
        this.loadFromPointsJson();
    }

    init() {
        // Добавляем обработчики событий
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));

        // Кнопки инструментов
        document.getElementById('tool-select').addEventListener('click', () => this.setMode('select'));
        document.getElementById('tool-wall').addEventListener('click', () => this.setMode('draw_wall'));
        document.getElementById('tool-room').addEventListener('click', () => this.setMode('draw_room'));
        document.getElementById('tool-point').addEventListener('click', () => this.setMode('add_point'));
        document.getElementById('tool-move').addEventListener('click', () => this.setMode('move_point'));

        // Кнопка сохранения
        document.getElementById('save-map').addEventListener('click', () => this.saveMap());
        document.getElementById('load-map').addEventListener('click', () => this.loadMap());

        // Переключение этажей
        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentFloor = parseInt(e.target.dataset.floor);
                this.draw();
            });
        });

        this.draw();
    }

    setMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`tool-${mode}`)?.classList.add('active');
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offsetX) / this.scale;
        const y = (e.clientY - rect.top - this.offsetY) / this.scale;

        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            // Перетаскивание карты
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            return;
        }

        switch(this.mode) {
            case 'draw_wall':
                this.startDrawingWall(x, y);
                break;
            case 'draw_room':
                this.startDrawingRoom(x, y);
                break;
            case 'add_point':
                this.addPoint(x, y);
                break;
            case 'move_point':
                this.selectPoint(x, y);
                break;
        }
    }

    onMouseMove(e) {
        if (this.isDragging) {
            // Перемещение карты
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            this.offsetX += dx;
            this.offsetY += dy;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.draw();
            return;
        }

        if (this.drawing) {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.offsetX) / this.scale;
            const y = (e.clientY - rect.top - this.offsetY) / this.scale;
            this.drawPreview(x, y);
        }

        if (this.selectedPoint && this.mode === 'move_point') {
            const rect = this.canvas.getBoundingClientRect();
            this.selectedPoint.x = (e.clientX - rect.left - this.offsetX) / this.scale;
            this.selectedPoint.y = (e.clientY - rect.top - this.offsetY) / this.scale;
            this.draw();
        }
    }

    onMouseUp() {
        this.isDragging = false;
        if (this.drawing) {
            this.finishDrawing();
        }
    }

    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= delta;
        this.scale = Math.min(Math.max(0.5, this.scale), 3);
        this.draw();
    }

    startDrawingWall(x, y) {
        this.drawing = true;
        this.startX = x;
        this.startY = y;
    }

    startDrawingRoom(x, y) {
        this.drawing = true;
        this.startX = x;
        this.startY = y;
    }

    drawPreview(x, y) {
        this.draw();
        this.ctx.save();
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.setLineDash([5 / this.scale, 5 / this.scale]);

        if (this.mode === 'draw_wall') {
            this.ctx.beginPath();
            this.ctx.moveTo(this.startX, this.startY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
        } else if (this.mode === 'draw_room') {
            this.ctx.strokeRect(
                this.startX,
                this.startY,
                x - this.startX,
                y - this.startY
            );
        }

        this.ctx.restore();
    }

    finishDrawing() {
        if (!this.drawing) return;

        const endX = this.previewX;
        const endY = this.previewY;

        if (this.mode === 'draw_wall') {
            this.floors[this.currentFloor].walls.push({
                x1: this.startX,
                y1: this.startY,
                x2: endX,
                y2: endY
            });
        } else if (this.mode === 'draw_room') {
            this.floors[this.currentFloor].rooms.push({
                x: this.startX,
                y: this.startY,
                width: endX - this.startX,
                height: endY - this.startY,
                name: 'Новая комната',
                color: this.getRandomColor()
            });
        }

        this.drawing = false;
        this.draw();
    }

    addPoint(x, y) {
        // Показываем диалог для добавления точки
        const name = prompt('Введите название точки:');
        if (!name) return;

        const category = prompt('Введите категорию (classroom, entrance, toilet, stair, elevator, cafeteria, hall):', 'classroom');

        const point = {
            id: `point_${Date.now()}`,
            name: name,
            x: Math.round(x),
            y: Math.round(y),
            floor: this.currentFloor,
            description: '',
            category: category || 'classroom'
        };

        this.floors[this.currentFloor].points.push(point);
        this.draw();

        // Спрашиваем, сохранить ли в points.json
        if (confirm('Сохранить точку в points.json?')) {
            this.savePointToJson(point);
        }
    }

    selectPoint(x, y) {
        // Находим ближайшую точку
        const points = this.floors[this.currentFloor].points;
        let minDist = 20;
        this.selectedPoint = null;

        points.forEach(point => {
            const dist = Math.sqrt(
                Math.pow(point.x - x, 2) +
                Math.pow(point.y - y, 2)
            );
            if (dist < minDist) {
                minDist = dist;
                this.selectedPoint = point;
            }
        });

        this.draw();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Рисуем сетку
        this.drawGrid();

        // Рисуем стены
        this.floors[this.currentFloor].walls.forEach(wall => {
            this.drawWall(wall);
        });

        // Рисуем комнаты
        this.floors[this.currentFloor].rooms.forEach(room => {
            this.drawRoom(room);
        });

        // Рисуем точки
        this.floors[this.currentFloor].points.forEach(point => {
            this.drawPoint(point);
        });

        // Подсвечиваем выбранную точку
        if (this.selectedPoint) {
            this.drawSelectedPoint(this.selectedPoint);
        }

        this.ctx.restore();
    }

    drawGrid() {
        this.ctx.strokeStyle = '#ecf0f1';
        this.ctx.lineWidth = 0.5 / this.scale;

        const step = 50;
        for (let x = 0; x < this.canvas.width; x += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawWall(wall) {
        this.ctx.beginPath();
        this.ctx.moveTo(wall.x1, wall.y1);
        this.ctx.lineTo(wall.x2, wall.y2);
        this.ctx.strokeStyle = this.colors.wall;
        this.ctx.lineWidth = 4 / this.scale;
        this.ctx.stroke();
    }

    drawRoom(room) {
        this.ctx.fillStyle = room.color + '40';
        this.ctx.strokeStyle = room.color;
        this.ctx.lineWidth = 2 / this.scale;

        this.ctx.fillRect(room.x, room.y, room.width, room.height);
        this.ctx.strokeRect(room.x, room.y, room.width, room.height);

        this.ctx.fillStyle = '#2c3e50';
        this.ctx.font = `${12 / this.scale}px Arial`;
        this.ctx.fillText(room.name, room.x + 5, room.y + 20);
    }

    drawPoint(point) {
        const colors = this.colors.point;
        const color = colors[point.category] || '#95a5a6';

        // Градиент
        const gradient = this.ctx.createRadialGradient(
            point.x - 3, point.y - 3, 2,
            point.x, point.y, 15
        );
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, this.darkenColor(color));

        // Тень
        this.ctx.shadowColor = 'rgba(0,0,0,0.3)';
        this.ctx.shadowBlur = 10 / this.scale;
        this.ctx.shadowOffsetY = 3 / this.scale;

        // Круг
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, 10 / this.scale, 0, 2 * Math.PI);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.stroke();

        // Иконка
        this.ctx.fillStyle = 'white';
        this.ctx.font = `${12 / this.scale}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.getIcon(point.category), point.x, point.y - 1);

        // Подпись
        this.ctx.shadowColor = 'rgba(255,255,255,0.8)';
        this.ctx.shadowBlur = 5 / this.scale;
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.font = `bold ${12 / this.scale}px Arial`;
        this.ctx.fillText(point.name, point.x, point.y - 20 / this.scale);

        this.ctx.shadowColor = 'transparent';
    }

    drawSelectedPoint(point) {
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, 15 / this.scale, 0, 2 * Math.PI);
        this.ctx.strokeStyle = '#f1c40f';
        this.ctx.lineWidth = 3 / this.scale;
        this.ctx.setLineDash([5 / this.scale, 5 / this.scale]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    getIcon(category) {
        const icons = {
            classroom: '📚',
            entrance: '🚪',
            toilet: '🚻',
            stair: '⬆️',
            elevator: '🛗',
            cafeteria: '🍽️',
            hall: '🏛️'
        };
        return icons[category] || '📍';
    }

    darkenColor(color) {
        // Упрощенное затемнение цвета
        return color + 'dd';
    }

    getRandomColor() {
        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    async savePointToJson(point) {
        try {
            const response = await fetch('/api/points');
            const points = await response.json();
            points.push(point);

            // Здесь нужно отправить на сервер
            console.log('Точка для сохранения:', point);

            // Показываем код для ручного добавления
            alert(`Добавьте в points.json:\n${JSON.stringify(point, null, 2)}`);
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    saveMap() {
        const data = JSON.stringify(this.floors, null, 2);
        localStorage.setItem('schoolMap', data);
        alert('Карта сохранена в браузере!');
    }

    loadMap() {
        const data = localStorage.getItem('schoolMap');
        if (data) {
            this.floors = JSON.parse(data);
            this.draw();
            alert('Карта загружена!');
        }
    }

    async loadFromPointsJson() {
        try {
            const response = await fetch('/api/points');
            const points = await response.json();

            points.forEach(point => {
                if (point.floor >= 1 && point.floor <= 3) {
                    if (!this.floors[point.floor]) {
                        this.floors[point.floor] = { walls: [], rooms: [], doors: [], points: [] };
                    }
                    this.floors[point.floor].points.push(point);
                }
            });

            this.draw();
        } catch (error) {
            console.error('Ошибка загрузки точек:', error);
        }
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.interactiveMap = new InteractiveMap();
});