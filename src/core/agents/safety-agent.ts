export interface SafetyResult {
  valid: boolean;
  text: string;
  error?: string;
}

const MAX_INPUT_LENGTH = 500;

const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /data:text\/html/i,
];

export function safetyCheck(raw: string): SafetyResult {
  if (!raw || raw.trim().length === 0) {
    return { valid: false, text: '', error: 'empty_input' };
  }

  const trimmed = raw.trim();

  if (trimmed.length > MAX_INPUT_LENGTH) {
    return {
      valid: false,
      text: trimmed,
      error: 'input_too_long',
    };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        text: trimmed,
        error: 'unsafe_content',
      };
    }
  }

  const sanitized = trimmed
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitized.length < 2) {
    return { valid: false, text: sanitized, error: 'input_too_short' };
  }

  return { valid: true, text: sanitized };
}
