import type { Command } from '@/lib/commands'
import { Kbd } from '@/components/Kbd'
import { Sheet } from '@/components/Sheet'
import { formatHotkey } from '@/lib/hotkeys'
import { closeShortcuts, shortcutsOpenStore } from '@/lib/overlays'
import { useStore } from '@/lib/store'

export function ShortcutsSheet({ commands }: { commands: readonly Command[] }) {
  const open = useStore(shortcutsOpenStore)
  const rows = [
    { title: 'Command palette', keys: formatHotkey({ key: 'k', mod: true }) },
    ...commands
      .filter((command) => command.hotkey)
      .map((command) => ({
        title: command.title,
        keys: formatHotkey(command.hotkey!),
      })),
    { title: 'Close a dialog', keys: ['esc'] },
  ]
  return (
    <Sheet open={open} onClose={closeShortcuts} title="Keyboard shortcuts">
      <ul className="divide-y divide-line pt-1">
        {rows.map((row) => (
          <li
            key={row.title}
            className="flex items-center justify-between gap-4 py-3 text-sm"
          >
            <span className="text-fg-muted">{row.title}</span>
            <Kbd keys={row.keys} />
          </li>
        ))}
      </ul>
      <p className="pt-4 text-xs text-fg-subtle">
        Single-key shortcuts are paused while you type or while a dialog is
        open.
      </p>
    </Sheet>
  )
}
