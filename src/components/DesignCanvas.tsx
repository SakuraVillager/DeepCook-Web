import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type DesignCanvasProps = {
  children: ReactNode
  className?: string
  label: string
}

const LANDSCAPE = { width: 1280, height: 800 }
const PORTRAIT = { width: 420, height: 900 }
const COMPACT = { width: 420, height: 720 }
const NARROW = { width: 800, height: 900 }

/** A complete composition, fitted uniformly inside its available rectangle. */
export function DesignCanvas({ children, className = '', label }: DesignCanvasProps) {
  const host = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ ...LANDSCAPE, scale: 0, portrait: false, narrow: false, compact: false })

  useLayoutEffect(() => {
    const element = host.current
    if (!element) return

    const update = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return
      const portrait = width / height < 0.95
      // Wider portrait canvases fill narrow windows horizontally, leaving space above/below.
      const narrow = portrait && width > 480
      const compact = portrait && !narrow && width / height > 0.51
      const design = portrait ? narrow ? NARROW : compact ? COMPACT : PORTRAIT : LANDSCAPE
      const scale = Math.min(width / design.width, height / design.height)
      setFit(previous => previous.scale === scale && previous.portrait === portrait && previous.narrow === narrow && previous.compact === compact
        ? previous
        : { ...design, scale, portrait, narrow, compact })
    }

    update(element.clientWidth, element.clientHeight)
    const observer = new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="design-canvas" ref={host} role="group" aria-label={label}>
      <div
        className={`design-canvas__content ${fit.portrait ? 'canvas-portrait' : 'canvas-landscape'}${fit.narrow ? ' canvas-narrow' : ''}${fit.compact ? ' canvas-compact' : ''} ${className}`.trim()}
        style={{
          width: fit.width,
          height: fit.height,
          '--canvas-scale': fit.scale,
          visibility: fit.scale > 0 ? 'visible' : 'hidden',
        } as CSSProperties}
      >
        {children}
      </div>
    </div>
  )
}
