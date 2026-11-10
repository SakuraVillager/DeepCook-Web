import { useEffect, type RefObject } from 'react'

/** Keep vertical reading and pinch zoom native; only claim a clear horizontal swipe. */
export function useReaderSwipe(
  content: RefObject<HTMLElement | null>,
  enabled: boolean,
  onSwipe: (direction: -1 | 1) => void,
) {
  useEffect(() => {
    const element = content.current
    if (!element || !enabled) return
    let gesture: {
      id: number
      x: number
      y: number
      time: number
      axis: 'pending' | 'horizontal' | 'vertical'
    } | null = null
    const selected = () => Boolean(window.getSelection()?.toString())
    const start = (event: TouchEvent) => {
      gesture = null
      const touch = event.touches[0]
      if (
        event.touches.length !== 1 ||
        !touch ||
        selected() ||
        touch.clientX <= 24 ||
        touch.clientX >= innerWidth - 24 ||
        (event.target instanceof Element &&
          event.target.closest(
            'a, button, input, textarea, select, [contenteditable], [role="button"]',
          ))
      )
        return
      gesture = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        time: performance.now(),
        axis: 'pending',
      }
    }
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 1 || selected()) {
        gesture = null
        return
      }
      if (!gesture) return
      const touch = event.touches[0]!
      if (touch.identifier !== gesture.id) return
      const dx = Math.abs(touch.clientX - gesture.x)
      const dy = Math.abs(touch.clientY - gesture.y)
      if (gesture.axis === 'pending' && Math.max(dx, dy) > 12)
        gesture.axis = dx > dy * 1.4 ? 'horizontal' : 'vertical'
      if (gesture.axis === 'horizontal' && event.cancelable)
        event.preventDefault()
    }
    const end = (event: TouchEvent) => {
      const current = gesture
      gesture = null
      if (!current || event.touches.length || selected()) return
      const touch = Array.from(event.changedTouches).find(
        (t) => t.identifier === current.id,
      )
      if (!touch) return
      const dx = touch.clientX - current.x
      const dy = touch.clientY - current.y
      const threshold = Math.max(48, Math.min(88, element.clientWidth * 0.14))
      if (
        current.axis !== 'vertical' &&
        performance.now() - current.time < 1200 &&
        Math.abs(dx) >= threshold &&
        Math.abs(dx) > Math.abs(dy) * 1.4
      )
        onSwipe(dx < 0 ? 1 : -1)
    }
    const cancel = () => {
      gesture = null
    }
    element.addEventListener('touchstart', start, { passive: true })
    element.addEventListener('touchmove', move, { passive: false })
    element.addEventListener('touchend', end, { passive: true })
    element.addEventListener('touchcancel', cancel, { passive: true })
    return () => {
      element.removeEventListener('touchstart', start)
      element.removeEventListener('touchmove', move)
      element.removeEventListener('touchend', end)
      element.removeEventListener('touchcancel', cancel)
    }
  }, [content, enabled, onSwipe])
}
