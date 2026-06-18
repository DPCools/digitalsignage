import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'br', 'hr',
  'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'section', 'article', 'header', 'footer', 'main', 'aside',
  // 'style' intentionally omitted — inline <style> can be used for CSS exfiltration
];

const ALLOWED_ATTR = [
  'class', 'id', 'alt', 'width', 'height', 'role',
  // 'style' intentionally omitted — inline styles can contain url() for data exfiltration
  // 'src' handled separately via ALLOWED_URI_REGEXP to restrict to safe origins
];

// Only allow https://, http://, and root-relative URLs for src attributes
const ALLOWED_URI_REGEXP = /^(?:https?:|\/)/i;

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ADD_ATTR: ['src'],  // src is allowed but gated by ALLOWED_URI_REGEXP
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'iframe', 'style'],
    FORCE_BODY: true,
  });
}
