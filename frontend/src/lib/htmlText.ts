import { sanitizeHtml } from './sanitizeHtml'

// Plain szöveg (canned response, AI válasz javaslat) beillesztése a TipTap editorba — soronként
// <p> bekezdéssé alakítva, hogy a sortörések megmaradjanak (a setContent nem értelmezi a \n-t).
export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .split(/\r?\n/)
    .map((line) => `<p>${line.length > 0 ? line : '<br>'}</p>`)
    .join('')
}

export function isHtmlEmpty(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim().length === 0
}

// Agent aláírás beszúrása "--" elválasztóval (RFC 3676 sig-dash konvenció) — minden sor a
// lineClassName-t kapja, hogy a RichTextEditor paragraphAttributes extension-je megőrizze a
// szürke stílust szerializálás után is (lásd RichTextEditor.module.css .emailSignatureLine).
export function buildSignatureHtml(signature: string, lineClassName: string): string {
  const escape = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return ['--', ...signature.split(/\r?\n/)]
    .map((line) => `<p class="${lineClassName}">${line.length > 0 ? escape(line) : '<br>'}</p>`)
    .join('')
}

// Az utolsó bejövő üzenet idézése blockquote-ba — a body tetszőleges külső HTML lehet (bejövő
// emailből), sanitálás nélkül XSS-t engedne be a setContent-en keresztül.
export function buildQuoteHtml(body: string): string {
  return `<blockquote>${sanitizeHtml(body)}</blockquote>`
}
