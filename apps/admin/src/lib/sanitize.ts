import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'br', 'hr',
  'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'section', 'article', 'header', 'footer', 'main', 'aside',
  'style',
];

const ALLOWED_ATTR = [
  'class', 'id', 'style', 'src', 'alt', 'width', 'height',
  'data-*', 'aria-*', 'role',
];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_SCRIPTS: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'iframe'],
    FORCE_BODY: true,
  });
}
