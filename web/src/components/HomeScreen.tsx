import { motion } from 'motion/react'
import {
  Compass,
  Gamepad2,
  GraduationCap,
  Moon,
  QrCode,
  ShoppingBag,
  Sun,
} from 'lucide-react'
import { SchoolCrest } from '@/components/SchoolCrest'
import { cn } from '@/lib/utils'

const soon = [
  {
    icon: GraduationCap,
    title: 'ОГЭ и ЕГЭ',
    text: 'Подготовка появится здесь, внутри того же приложения.',
  },
  {
    icon: ShoppingBag,
    title: 'Магазин',
    text: 'Школьная лавка откроется отдельным разделом.',
  },
  {
    icon: Gamepad2,
    title: 'Игры',
    text: 'Игровая полка школы — следующий модуль, не отдельный сайт.',
  },
]

export function HomeScreen({
  onOpenMap,
  onOpenQr,
  onOpenAdmin,
  theme,
  onToggleTheme,
}: {
  onOpenMap: () => void
  onOpenQr: () => void
  onOpenAdmin: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 md:px-8">
        <div className="glass-panel flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2">
          <SchoolCrest size={44} />
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.22em] text-primary uppercase">
              Платформа школы
            </p>
            <p className="font-display truncate text-lg leading-none">МБОУ СОШ №1</p>
          </div>
          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            <NavChip onClick={onOpenMap}>Карта</NavChip>
            <NavChip onClick={onOpenQr}>QR</NavChip>
            <NavChip onClick={onOpenAdmin}>Кабинеты</NavChip>
          </nav>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Тема"
            className="ml-1 grid size-9 place-items-center rounded-xl text-foreground hover:bg-secondary"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-4 pb-16 md:px-8">
        <div>
          <h1 className="font-display text-4xl text-foreground md:text-5xl">
            Школа в одном приложении
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            Большой Камень. Карта этажей — первый раздел. Рядом уже есть место
            для экзаменов, магазина и игр.
          </p>
        </div>

        <motion.button
          type="button"
          onClick={onOpenMap}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          className="relative overflow-hidden rounded-3xl p-6 text-left text-primary-foreground shadow-[0_18px_50px_oklch(0.32_0.08_262/0.28)] md:p-8"
          style={{
            background:
              'linear-gradient(145deg, oklch(0.46 0.15 262), oklch(0.32 0.1 262) 70%)',
          }}
        >
          <span className="text-[11px] tracking-[0.2em] uppercase opacity-80">
            Раздел
          </span>
          <span className="mt-2 flex items-center gap-3">
            <Compass className="size-7" />
            <span className="font-display text-3xl md:text-4xl">Карта школы</span>
          </span>
          <span className="mt-3 block max-w-md text-sm text-primary-foreground/85">
            Этажи по настоящим стенам, маршрут до лестницы и QR у кабинета.
          </span>
          <span className="mt-5 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
            Открыть карту
          </span>
        </motion.button>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            icon={QrCode}
            title="QR у двери"
            text="Скан кода кабинета открывает карту с вашей точки."
            action="Сканировать"
            onClick={onOpenQr}
          />
          <ModuleCard
            icon={Compass}
            title="Кабинеты"
            text="Для сотрудников: точки, QR и какие маршруты строят чаще."
            action="Открыть"
            onClick={onOpenAdmin}
          />
          {soon.map((item) => (
            <ModuleCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              text={item.text}
              soon
            />
          ))}
        </div>
      </main>
    </div>
  )
}

function NavChip({
  children,
  onClick,
}: {
  children: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
    >
      {children}
    </button>
  )
}

function ModuleCard({
  icon: Icon,
  title,
  text,
  action,
  onClick,
  soon,
}: {
  icon: typeof Compass
  title: string
  text: string
  action?: string
  onClick?: () => void
  soon?: boolean
}) {
  return (
    <button
      type="button"
      disabled={soon}
      onClick={onClick}
      className={cn(
        'glass-panel rounded-3xl p-4 text-left',
        soon ? 'cursor-default opacity-80' : 'transition hover:-translate-y-0.5',
      )}
    >
      <div className="flex items-center justify-between">
        <Icon className={cn('size-5', soon ? 'text-muted-foreground' : 'text-primary')} />
        {soon && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent-foreground uppercase">
            Скоро
          </span>
        )}
      </div>
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
      {action && <p className="mt-3 text-xs font-semibold text-primary">{action}</p>}
    </button>
  )
}
