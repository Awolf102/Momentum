import { useState, type FormEvent } from 'react'
import { SettingsCard } from '@/components/SettingsCard'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import { formatCost, formatMonth, formatTokens } from '../lib/format'
import { summarizeMonth, type UsageRow } from '../lib/usage'
import { usageLabel } from '../chain'
import { aiSettingsStore, aiUsageStore, resetUsage, setPrice } from '../store'

/** Tokens used this month per model, with a cost estimate from prices you enter. */
export function UsageCard() {
  const usage = useStore(aiUsageStore)
  const { prices } = useStore(aiSettingsStore)
  const [confirmingReset, setConfirmingReset] = useState(false)
  // Today's date key is "YYYY-MM-DD"; usage is kept by "YYYY-MM".
  const month = useToday().slice(0, 7)
  const { rows, total } = summarizeMonth(usage, month, prices)

  return (
    <SettingsCard
      title="Usage"
      description={`${formatMonth(month)}, counted on this device from what providers report.`}
    >
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-tint px-4 py-3 text-sm text-fg-muted">
          No AI requests yet this month.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl bg-tint px-4 py-3">
            <p className="text-sm">
              <span className="font-semibold tabular-nums">
                {formatTokens(total.inputTokens)}
              </span>{' '}
              <span className="text-fg-muted">in ·</span>{' '}
              <span className="font-semibold tabular-nums">
                {formatTokens(total.outputTokens)}
              </span>{' '}
              <span className="text-fg-muted">
                out · {total.requests}{' '}
                {total.requests === 1 ? 'request' : 'requests'}
              </span>
            </p>
            <p className="font-serif text-2xl leading-none tabular-nums">
              {total.cost > 0 || !total.unpriced
                ? `≈ ${formatCost(total.cost)}`
                : '—'}
            </p>
            {total.unpriced && total.cost > 0 && (
              <p className="w-full text-xs text-fg-subtle">
                The estimate leaves out models without a price.
              </p>
            )}
          </div>
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <UsageLine key={row.key} row={row} />
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
        Prices aren't built in, because they change. Add what your provider
        charges per million tokens to see an estimate.
      </p>
      {rows.length > 0 && (
        <button
          type="button"
          onClick={() => {
            if (!confirmingReset) return setConfirmingReset(true)
            resetUsage()
            setConfirmingReset(false)
          }}
          onBlur={() => setConfirmingReset(false)}
          className="mt-3 rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-tint"
        >
          {confirmingReset
            ? 'Tap again to clear all usage history'
            : 'Clear usage history'}
        </button>
      )}
    </SettingsCard>
  )
}

function UsageLine({ row }: { row: UsageRow }) {
  const [editing, setEditing] = useState(false)
  const { chain } = useStore(aiSettingsStore).chat
  // Each of chat's servers is counted apart, under the name you gave it.
  const providerLabel = usageLabel(row.provider, chain)
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs">{row.model}</p>
          <p className="mt-0.5 text-xs text-fg-subtle">
            {providerLabel} · {formatTokens(row.inputTokens)} in ·{' '}
            {formatTokens(row.outputTokens)} out
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {row.cost !== undefined && (
            <span className="text-sm tabular-nums">{formatCost(row.cost)}</span>
          )}
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            aria-expanded={editing}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-fg-muted transition hover:bg-tint"
          >
            {row.cost === undefined ? 'Add price' : 'Price'}
          </button>
        </div>
      </div>
      {editing && (
        <PriceForm usageKey={row.key} onDone={() => setEditing(false)} />
      )}
    </li>
  )
}

function PriceForm({
  usageKey,
  onDone,
}: {
  usageKey: string
  onDone: () => void
}) {
  const current = useStore(aiSettingsStore).prices[usageKey]
  const [input, setInput] = useState(current ? String(current.input) : '')
  const [output, setOutput] = useState(current ? String(current.output) : '')
  const valid = [input, output].every(
    (value) => value.trim() !== '' && Number(value) >= 0,
  )

  function save(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    setPrice(usageKey, { input: Number(input), output: Number(output) })
    onDone()
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-2 rounded-2xl bg-tint p-3">
      <p className="text-xs text-fg-subtle">US dollars per million tokens</p>
      <div className="grid grid-cols-2 gap-2">
        <PriceInput label="Input" value={input} onChange={setInput} />
        <PriceInput label="Output" value={output} onChange={setOutput} />
      </div>
      <div className="flex justify-end gap-2">
        {current && (
          <button
            type="button"
            onClick={() => {
              setPrice(usageKey, null)
              onDone()
            }}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-line"
          >
            Remove price
          </button>
        )}
        <button
          type="submit"
          disabled={!valid}
          className="rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-3.5 py-1.5 text-xs font-semibold text-orange-950 disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </form>
  )
}

function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs text-fg-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl bg-tint px-3 py-2 text-sm tabular-nums outline-none focus-visible:outline-2"
      />
    </label>
  )
}
