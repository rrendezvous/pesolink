// ============================================================
// Email format check shared by registration, employer accounts and job application emails.
// A practical check (something@domain.tld, no spaces), not full RFC validation.
// ============================================================
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value ?? '').trim());
}

const INVALID_EMAIL_MESSAGE = 'Enter a valid email address, for example name@example.com';

module.exports = { isValidEmail, INVALID_EMAIL_MESSAGE };
