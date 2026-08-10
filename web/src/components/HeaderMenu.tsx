import { useEffect, useId, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import '../css/HeaderMenu.css'

export interface HeaderMenuLink {
  key: string
  href: string
  label: string
}

interface HeaderMenuProps {
  links: HeaderMenuLink[]
}

/**
 * The app bar's overflow menu — the narrow-screen form of the project links.
 *
 * Above 640px the links render as pills in `.ehr-header-actions` and this is
 * hidden; below it the pills hide and this takes over. The swap is CSS-only
 * (`display: none`), so exactly one of the two is in the accessibility tree and
 * the tab order at any width, and there is no JS breakpoint to keep in sync.
 *
 * Built as a **disclosure**, not the ARIA menu pattern. Every item is a link,
 * so Tab order and screen-reader link semantics already do the right thing;
 * claiming `role="menu"` would additionally owe arrow-key navigation, a roving
 * tabindex and typeahead — machinery that buys nothing for three links and is
 * worse than useless when implemented halfway.
 */
export function HeaderMenu({ links }: HeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      // Escape closes without moving focus anywhere, so put it back on the
      // trigger — otherwise it is stranded on a link that just left the tree
      // and the next Tab restarts from the top of the document.
      triggerRef.current?.focus()
    }

    // `pointerdown`, not `click`: a press that starts outside should dismiss
    // immediately, matching the sidebar overlay's behavior.
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  // Tabbing past the last item should close the menu rather than leave it
  // hanging open behind the rest of the page. `relatedTarget` is where focus
  // is going; null (e.g. focus leaving the document) also counts as leaving.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
  }

  return (
    <div className="header-menu" ref={wrapRef} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        className="header-menu__trigger"
        aria-label="Project links"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(o => !o)}
      >
        {/* An SVG rather than a "⋯" glyph: the character's size and baseline
            vary by font, and this button is a fixed 44x44 tap target whose
            icon has to sit dead centre of it. */}
        <svg
          className="header-menu__icon"
          viewBox="0 0 20 20"
          width="20"
          height="20"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="4" cy="10" r="1.75" />
          <circle cx="10" cy="10" r="1.75" />
          <circle cx="16" cy="10" r="1.75" />
        </svg>
      </button>

      {/* Rendered at every state and hidden with `hidden`, rather than removed
          from the tree, so `aria-controls` always resolves to a real element.
          `hidden` also keeps the links out of the tab order while closed. */}
      <ul className="header-menu__list" id={listId} hidden={!open}>
        {links.map(link => (
          <li key={link.key}>
            <a
              className="header-menu__item"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${link.label} (opens in a new tab)`}
              onClick={() => setOpen(false)}
            >
              <span>{link.label}</span>
              <span className="header-menu__ext" aria-hidden="true">
                &#8599;
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
