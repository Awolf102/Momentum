import { navigate, paths } from '@/lib/routes'
import { createNote } from './notes'

/** Starts a note and opens it. */
export async function startNote(
  input?: Parameters<typeof createNote>[0],
): Promise<void> {
  const note = await createNote(input)
  navigate(paths.note(note.id))
}
