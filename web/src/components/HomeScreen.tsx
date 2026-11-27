import { motion } from 'motion/react'
import { Compass, Layers3, QrCode, Route } from 'lucide-react'
import { SchoolCrest } from '@/components/SchoolCrest'

const steps = [
  {
    icon: QrCode,
    title: 'QR-код',
    text: 'Сканируйте код у двери — карта поймёт, где вы стоите.',
  },
  {
    icon: Compass,
    title: 'Выбор кабинета',
    text: 'Найдите номер или зону: столовая, гардероб, спортзал.',
  },
  {
    icon: Route,
    title: 'Живой маршрут',
    text: 'Линия сама пробежит от точки А до точки Б.',
  },
  {
    icon: Layers3,
    title: 'Этажи',
    text: 'Камера перелетит на нужный этаж вместе с лестницей.',
  },
]

export function HomeScreen({
  onOpenMap,
  onOpenAdmin,
}: {
  onOpenMap: () => void
  onOpenAdmin: () => void
}) {
  return (
    <div className="relative flex min-h-full flex-col items-center overflow-auto px-5 py-10">
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 8, repeat: Infinity }}
        style={{
          background:
            'radial-gradient(600px 320px at 50% 12%, oklch(0.72 0.14 85 / 0.35), transparent 70%)',
        }}
      />
      <SchoolCrest size={148} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 140, damping: 18, delay: 0.1 }}
        className="relative mt-4 text-center"
      >
        <p className="text-xs tracking-[0.28em] text-primary uppercase">
          Большой Камень
        </p>
        <h1 className="font-display mt-2 text-4xl text-foreground md:text-6xl">
          МБОУ СОШ №1
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground md:text-base">
          Навигация по школе: живая карта этажей, маршрут и QR у кабинета.
        </p>
      </motion.div>

      <motion.button
        type="button"
        onClick={onOpenMap}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 380, damping: 16 }}
        className="liquid-sheen glass-panel relative mt-8 rounded-full px-8 py-4 text-base font-semibold text-primary"
      >
        Открыть карту школы
      </motion.button>
      <button
        type="button"
        onClick={onOpenAdmin}
        className="relative mt-3 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Админ-панель
      </button>

      <div className="relative mt-10 grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <motion.article
            key={step.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: 'spring',
              stiffness: 220,
              damping: 20,
              delay: 0.15 + i * 0.08,
            }}
            whileHover={{ y: -4 }}
            className="glass-panel rounded-3xl p-4"
          >
            <step.icon className="size-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold">{step.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {step.text}
            </p>
          </motion.article>
        ))}
      </div>
    </div>
  )
}
