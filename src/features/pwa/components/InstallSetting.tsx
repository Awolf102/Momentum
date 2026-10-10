import { CheckIcon, InstallIcon, ShareIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { installStore, isIos, promptInstall } from '../install'

export function InstallSetting() {
  const { canPrompt, installed } = useStore(installStore)

  if (installed) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-tint px-4 py-3 text-sm">
        <CheckIcon className="text-orange-300 light:text-orange-500" />
        Installed. Momentum opens like an app and works offline.
      </p>
    )
  }
  if (canPrompt) {
    return (
      <button
        type="button"
        onClick={() => void promptInstall()}
        className="flex w-full items-center gap-3 rounded-2xl bg-tint px-4 py-3 text-left text-sm font-medium transition hover:bg-line"
      >
        <InstallIcon className="text-base opacity-80" />
        Install Momentum
        <span className="ml-auto text-xs font-normal text-fg-subtle">
          Home screen · offline
        </span>
      </button>
    )
  }
  return (
    <p className="rounded-2xl bg-tint px-4 py-3 text-sm text-fg-muted">
      {isIos() ? (
        <>
          In Safari, tap{' '}
          <ShareIcon className="inline align-[-2px]" aria-label="Share" /> then{' '}
          <strong className="font-semibold text-fg">Add to Home Screen</strong>.
        </>
      ) : (
        'Use your browser’s “Install app” or “Add to Home Screen” option. Momentum also works offline once it has loaded.'
      )}
    </p>
  )
}
