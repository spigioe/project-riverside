import DOMPurify from 'dompurify'

// A composer (TipTap) saját HTML-t ad, de bejövő emaileknél a body közvetlenül a küldő fél
// tetszőleges HTML tartalma lehet (lásd EmailService.FetchNewAsync) — mindkét esetben sanitálni kell
// megjelenítés előtt, script/esemény-handler nélküli biztonságos HTML-re szűrve.
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
}
