/**
 * Shown instead of the app while an older Momentum tab holds up a storage
 * upgrade. The app starts by itself as soon as that tab closes.
 */
export function StorageBlocked() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[rgb(var(--scrim))] p-6 text-center text-fg">
      <div className="max-w-sm" role="status">
        <p className="text-lg font-semibold">Finishing an update</p>
        <p className="mt-2 text-sm text-fg-muted">
          Momentum is open in another tab or window with an older version. Close
          it and this page will carry on by itself.
        </p>
      </div>
    </main>
  )
}
