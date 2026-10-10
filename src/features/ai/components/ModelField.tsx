import { useId } from 'react'
import { savedSecretsStore } from '@/lib/secrets'
import { useStore } from '@/lib/store'
import { modelsForTask } from '../lib/format'
import { loadModels, modelListsStore } from '../modelLists'
import { PROVIDERS } from '../providers/meta'
import { setTaskModel } from '../store'
import type { AiTask, ProviderId } from '../types'

interface ModelFieldProps {
  task: AiTask
  provider: ProviderId
  model: string
}

/** Type any model name, or pick from the list the provider reports. */
export function ModelField({ task, provider, model }: ModelFieldProps) {
  const list = useStore(modelListsStore)[provider]
  const keys = useStore(savedSecretsStore)
  const listId = useId()
  const inputId = useId()
  const meta = PROVIDERS[provider]
  const canList = !meta.needsKey || keys.has(provider)
  const suggestions = modelsForTask(list?.models ?? [], task)

  let status: { text: string; error?: boolean }
  if (list?.status === 'error')
    status = { text: list.error ?? "Couldn't load the list.", error: true }
  else if (list?.status === 'loaded') {
    status = {
      text: `${suggestions.length} ${suggestions.length === 1 ? 'model' : 'models'} from ${meta.label}. Pick one or type any name.`,
    }
  } else if (!canList)
    status = {
      text: `Add your ${meta.label} key above to load its models, or type a name.`,
    }
  else
    status = { text: `Type a model name, or load the list from ${meta.label}.` }

  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-medium">
        Model
      </label>
      <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-tint py-1.5 pr-1.5 pl-4 ring-orange-300/60 focus-within:ring-2">
        <input
          id={inputId}
          list={listId}
          value={model}
          onChange={(event) => setTaskModel(task, event.target.value)}
          placeholder={canList ? 'Choose or type a model' : 'Model name'}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-sm outline-none placeholder:font-sans placeholder:text-fg-subtle focus-visible:outline-none"
        />
        <button
          type="button"
          disabled={!canList || list?.status === 'loading'}
          onClick={() => void loadModels(provider)}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-line disabled:opacity-40"
        >
          {list?.status === 'loading'
            ? 'Loading…'
            : list?.status === 'loaded'
              ? 'Refresh'
              : 'Load list'}
        </button>
      </div>
      <datalist id={listId}>
        {suggestions.map((item) => (
          <option key={item.id} value={item.id}>
            {[
              item.name !== item.id ? item.name : null,
              item.deprecated ? 'deprecated' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </option>
        ))}
      </datalist>
      <p
        className={
          status.error
            ? 'mt-1.5 text-xs text-rose-300 light:text-rose-600'
            : 'mt-1.5 text-xs text-fg-subtle'
        }
      >
        {status.text}
      </p>
    </div>
  )
}
