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
