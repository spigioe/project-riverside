import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import styles from './RichTextEditor.module.css'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  highlighted?: boolean
  editable?: boolean
  onCannedResponseClick?: () => void
}

export function RichTextEditor({
  content, onChange, placeholder, highlighted = false, editable = true, onCannedResponseClick,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // Külső content-frissítés (canned response kiválasztás, AI válasz javaslat betöltése, Törlés gomb)
  // szinkronizálása az editorba — a beírt szöveget viszont nem írjuk felül (lásd a lenti feltételt).
  useEffect(() => {
    if (!editor) return
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || '', { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor])

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editable, editor])

  const isEmpty = editor?.isEmpty ?? true

  function addLink() {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL:', previousUrl ?? 'https://')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div className={`${styles.wrapper} ${highlighted ? styles.wrapperInternal : ''}`}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${styles.toolbarButton} ${editor?.isActive('bold') ? styles.toolbarButtonActive : ''}`}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          aria-label="Félkövér"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`${styles.toolbarButton} ${editor?.isActive('italic') ? styles.toolbarButtonActive : ''}`}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          aria-label="Dőlt"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`${styles.toolbarButton} ${editor?.isActive('underline') ? styles.toolbarButtonActive : ''}`}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          aria-label="Aláhúzott"
        >
          <u>U</u>
        </button>
        <button
          type="button"
          className={`${styles.toolbarButton} ${editor?.isActive('bulletList') ? styles.toolbarButtonActive : ''}`}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          aria-label="Felsorolás"
        >
          • Lista
        </button>
        <button
          type="button"
          className={`${styles.toolbarButton} ${editor?.isActive('orderedList') ? styles.toolbarButtonActive : ''}`}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          aria-label="Számozott lista"
        >
          1. Lista
        </button>
        <button
          type="button"
          className={`${styles.toolbarButton} ${editor?.isActive('link') ? styles.toolbarButtonActive : ''}`}
          onClick={addLink}
          aria-label="Link"
        >
          Link
        </button>
        <span className={styles.toolbarDivider} />
        {onCannedResponseClick && (
          <button type="button" className={styles.toolbarButton} onClick={onCannedResponseClick}>
            Sablon
          </button>
        )}
        <button
          type="button"
          className={styles.toolbarButton}
          disabled={isEmpty}
          onClick={() => editor?.chain().focus().clearContent().run()}
        >
          Törlés
        </button>
      </div>
      <div className={styles.editorArea}>
        {isEmpty && placeholder && <div className={styles.placeholder}>{placeholder}</div>}
        <EditorContent editor={editor} className={styles.editorContent} />
      </div>
    </div>
  )
}
