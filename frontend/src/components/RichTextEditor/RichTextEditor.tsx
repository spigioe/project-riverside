import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import styles from './RichTextEditor.module.css'

// A paragraph node alapból nem őriz meg tetszőleges class attribútumot parse/szerializálás közben —
// ez kell ahhoz, hogy az aláírás sorai (lásd ReplyComposer signature-beszúrás) megtartsák a szürke
// stílusukat, miután a setContent egyszer feldolgozta a HTML-t.
const ParagraphAttributes = Extension.create({
  name: 'paragraphAttributes',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          class: {
            default: null,
            parseHTML: (element) => element.getAttribute('class'),
            renderHTML: (attributes) => (attributes.class ? { class: attributes.class as string } : {}),
          },
        },
      },
    ]
  },
})

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  highlighted?: boolean
  editable?: boolean
  minHeight?: number
  onCannedResponseClick?: () => void
  onAttachClick?: () => void
  onImageUpload?: (file: File) => Promise<string>  // returns the img src URL
}

export interface RichTextEditorHandle {
  insertContent: (html: string) => void
  // Kezdeti tartalom beállítása (aláírás/idézet auto-beszúrás mount-kor) + kurzor a dokumentum elejére —
  // nem emitál onChange-et, a hívónak külön kell szinkronizálnia a szülő state-jét (lásd ReplyComposer).
  setContentAndFocusStart: (html: string) => void
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { content, onChange, placeholder, highlighted = false, editable = true, minHeight, onCannedResponseClick, onAttachClick, onImageUpload },
  ref,
) {
  const onImageUploadRef = useRef(onImageUpload)
  onImageUploadRef.current = onImageUpload

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: true, allowBase64: false }),
      ParagraphAttributes,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      handleDrop(view, event, _slice, moved) {
        if (!onImageUploadRef.current) return false
        const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
        if (files.length === 0 || moved) return false
        event.preventDefault()
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
        files.forEach(async (file) => {
          const src = await onImageUploadRef.current!(file)
          const { tr } = view.state
          const node = view.state.schema.nodes.image.create({ src })
          const pos = coords?.pos ?? tr.doc.content.size
          view.dispatch(tr.insert(pos, node))
        })
        return true
      },
      handlePaste(view, event) {
        if (!onImageUploadRef.current) return false
        const files = Array.from(event.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'))
        if (files.length === 0) return false
        event.preventDefault()
        files.forEach(async (file) => {
          const src = await onImageUploadRef.current!(file)
          view.dispatch(view.state.tr.replaceSelectionWith(
            view.state.schema.nodes.image.create({ src })
          ))
        })
        return true
      },
    },
  })

  // Külső content-frissítés (AI válasz javaslat betöltése, Törlés gomb) szinkronizálása az editorba —
  // a beírt szöveget viszont nem írjuk felül (lásd a lenti feltételt). A canned response beszúrás
  // insertContent-tel megy (lásd insertContent handle), nem ezen az útvonalon.
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

  useImperativeHandle(ref, () => ({
    insertContent: (html: string) => {
      editor?.chain().focus().insertContent(html).run()
    },
    setContentAndFocusStart: (html: string) => {
      editor?.commands.setContent(html, { emitUpdate: false })
      editor?.commands.focus('start')
    },
  }), [editor])

  const isEmpty = editor?.isEmpty ?? true

  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)

  function applyLink(url: string) {
    if (!editor) return
    const trimmed = url.trim()
    if (trimmed === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLinkPopoverOpen(false)
      return
    }
    if (editor.state.selection.empty) {
      const escaped = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      editor.chain().focus().insertContent(`<a href="${trimmed}">${escaped}</a>`).run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
    }
    setLinkPopoverOpen(false)
  }

  return (
    <div
      className={`${styles.wrapper} ${highlighted ? styles.wrapperInternal : ''}`}
      style={minHeight ? ({ '--editor-min-height': `${minHeight}px` } as React.CSSProperties) : undefined}
    >
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
          className={`${styles.toolbarButton} ${editor?.isActive('blockquote') ? styles.toolbarButtonActive : ''}`}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          aria-label="Idézet"
        >
          "
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
        <span className={styles.linkButtonWrapper}>
          <button
            type="button"
            className={`${styles.toolbarButton} ${editor?.isActive('link') ? styles.toolbarButtonActive : ''}`}
            onClick={() => setLinkPopoverOpen((o) => !o)}
            aria-label="Link"
          >
            Link
          </button>
          {linkPopoverOpen && editor && (
            <LinkPopover
              initialUrl={(editor.getAttributes('link').href as string | undefined) ?? ''}
              onApply={applyLink}
              onClose={() => setLinkPopoverOpen(false)}
            />
          )}
        </span>
        <span className={styles.toolbarDivider} />
        {onCannedResponseClick && (
          <button type="button" className={styles.toolbarButton} onClick={onCannedResponseClick}>
            Sablon
          </button>
        )}
        {onAttachClick && (
          <button type="button" className={styles.toolbarButton} onClick={onAttachClick} aria-label="Fájl csatolása">
            📎
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
})

function LinkPopover({
  initialUrl, onApply, onClose,
}: { initialUrl: string; onApply: (url: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState(initialUrl)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div className={styles.linkPopover} ref={containerRef}>
      <input
        type="text"
        className={styles.linkPopoverInput}
        value={url}
        placeholder="https://"
        autoFocus
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onApply(url) }
        }}
      />
      <div className={styles.linkPopoverActions}>
        <button type="button" className={styles.linkPopoverButton} onClick={onClose}>
          Mégse
        </button>
        <button
          type="button"
          className={`${styles.linkPopoverButton} ${styles.linkPopoverButtonPrimary}`}
          onClick={() => onApply(url)}
        >
          Alkalmaz
        </button>
      </div>
    </div>
  )
}
