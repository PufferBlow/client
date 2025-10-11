import DOMPurify from 'dompurify';

// For security, we'll use a simple input validation approach
// Block common malicious patterns
export const MALICIOUS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,  // script tags
  /javascript:/gi,  // javascript: URLs
  /data:text\/html/gi,  // data URLs for HTML
  /vbscript:/gi,  // vbscript URLs
  /onload\s*=/gi,  // onload attributes
  /onerror\s*=/gi,  // onerror attributes
  /onclick\s*=/gi,  // onclick attributes
  /onsubmit\s*=/gi,  // onsubmit attributes
  /<iframe[^>]*>/gi,  // iframe tags
  /<object[^>]*>/gi,  // object tags
  /<embed[^>]*>/gi,   // embed tags
  /<form[^>]*>/gi,    // form tags
  /\[.*\]\(.*javascript:.*\)/gi,  // markdown links with javascript URLs
  /!\[.*\]\(.*javascript:.*\)/gi,  // markdown images with javascript URLs
];

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export function isInputSafe(input: string): boolean {
  const sanitized = sanitizeInput(input);

  // Check for malicious patterns
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(input)) {
      return false;
    }
  }

  return sanitized === input;
}

export function validateMessageInput(message: string, maxLength: number = 10000): { isValid: boolean; error?: string } {
  if (!message.trim()) {
    return { isValid: false, error: "Message cannot be empty" };
  }

  if (message.length > maxLength) {
    return { isValid: false, error: `Message is too long. Maximum length is ${maxLength} characters.` };
  }

  if (!isInputSafe(message)) {
    return { isValid: false, error: "Message contains potentially malicious content" };
  }

  return { isValid: true };
}
