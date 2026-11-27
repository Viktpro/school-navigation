import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

export function SchoolCrest({
  size = 72,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <motion.div
      className={cn('crest-glow relative shrink-0', className)}
      style={{ width: size, height: size }}
      initial={{ rotateY: -18, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 16 }}
      whileHover={{ rotateY: 12, scale: 1.04 }}
    >
      <div
        className="absolute inset-[-12%] rounded-full blur-2xl"
        style={{
          background:
            'radial-gradient(circle, oklch(0.82 0.15 85 / 0.75), transparent 68%)',
        }}
      />
      <img
        src="/school-logo.png"
        alt="Герб МБОУ СОШ №1, Большой Камень"
        className="relative z-10 h-full w-full object-contain drop-shadow-xl"
        draggable={false}
      />
    </motion.div>
  )
}
