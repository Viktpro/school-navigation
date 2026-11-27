# ШколаНавигатор

Премиальная indoor-навигация для МБОУ СОШ №1 (г.о. Большой Камень).

## Стек

- React 19 + Vite + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Motion (`motion/react`)
- Lucide icons

## Запуск

```bash
cd web
npm install
npm run dev
```

Сборка:

```bash
npm run build
npm run preview
```

## Данные карты

Источник правды по помещениям: `src/data/school-map.json`  
Инвентаризация этажей: `docs/floor-structure.md` в Project store.

Только реальные номера и зоны с планов / `data/points.json`. Учителя и описания не добавлялись.
