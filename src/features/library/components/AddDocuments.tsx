import { useRef, useState, type ReactNode } from 'react'
import { PlusIcon, UploadIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { toast } from '@/lib/toast'
import { addFiles } from '../actions'

async function add(files: readonly File[]) {
  if (files.length === 0) return
  const { added, problems } = await addFiles(files)
  for (const problem of problems)
    toast({ title: "Couldn't add a file", description: problem })
  if (added.length > 1)
    toast({
      id: 'library-added',
      icon: <UploadIcon className="text-orange-300" />,
      title: `Added ${added.length} documents`,
      duration: 2500,
    })
}

/** "Add PDF": a file picker for one or more PDFs. */
export function AddDocumentsButton({ className }: { className?: string }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition-shadow hover:shadow-[0_12px_28px_-10px_rgb(249_115_22/0.9)]',
          className,
        )}
      >
        <PlusIcon /> Add PDF
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          void add(files)
        }}
      />
    </>
  )
}

/** Takes PDFs dropped anywhere on it, with a quiet sign while dragging. */
export function DropZone({ children }: { children: ReactNode }) {
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const hasFiles = (event: React.DragEvent) =>
    [...event.dataTransfer.types].includes('Files')
  return (
    <div
      className="relative flex flex-1 flex-col"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return
        depth.current++
        setOver(true)
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setOver(false)
      }}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault()
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        depth.current = 0
        setOver(false)
        void add([...event.dataTransfer.files])
      }}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[28px] border-2 border-dashed border-orange-300/70 bg-orange-400/10 text-sm font-semibold text-fg backdrop-blur-sm">
          Drop PDFs to add them to your library
        </div>
      )}
    </div>
  )
}
