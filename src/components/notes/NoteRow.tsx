import type { Note } from "@/lib/types";

/**
 * A single clinical note. Content is rendered as text (React escapes it), so
 * author-entered content can't inject markup.
 */
export function NoteRow({ note }: { note: Note }) {
  return (
    <div className="note-row">
      <div className="row-top">
        <div>
          <strong>{note.type}</strong>
          <div className="muted">
            {note.author} · {note.at}
          </div>
        </div>
      </div>
      <p>{note.content}</p>
    </div>
  );
}
