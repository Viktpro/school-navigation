# School Navigation → ШколаНавигатор

Премиальная indoor-навигация по этажам МБОУ СОШ №1 (г.о. Большой Камень).

## Новое приложение

Актуальное SPA находится в каталоге [`web/`](./web):

```bash
cd web
npm install
npm run dev
```

Стек: Vite + React + TypeScript + Tailwind CSS + shadcn/ui + Motion.

Карта: интерактивный SVG по всем этажам (подвал–3), поиск, маршруты через коридоры/лестницы/лифт, светлая/тёмная тема.

Legacy Flask-прототип в корне репозитория сохранён для справки (`app.py`, `data/`, `templates/`).
