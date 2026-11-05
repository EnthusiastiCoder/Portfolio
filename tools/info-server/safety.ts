// Redaction guard: anything the server shows that it did not write itself (an error message from a
// usage reader, a commit subject, an agent description) passes through redact() first, so a secret
// or a credentials path that slipped into one never reaches the page.

const SECRETS: RegExp[] = [
	/\bsk-[A-Za-z0-9_-]{10,}/g, // Anthropic / OpenAI style keys
	/\bfw_[A-Za-z0-9]{10,}/g, // Fireworks
	/\bgh[pousr]_[A-Za-z0-9]{20,}/g, // GitHub tokens
	/\bgithub_pat_[A-Za-z0-9_]{20,}/g,
	/\bAKIA[0-9A-Z]{16}\b/g, // AWS access key ids
	/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // JWTs
	/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
	/\b(api[_-]?key|token|secret|password)\s*[=:]\s*\S+/gi,
];
/** Paths that must never be named on the page. */
const FORBIDDEN_PATHS = /[^\s"'`]*(\.credentials(\.json)?|\.env(\.[a-z]+)?|id_rsa|id_ed25519)\b[^\s"'`]*/gi;

export function redact(s: string | null | undefined): string | null {
	if (s == null) return null;
	let out = String(s);
	for (const re of SECRETS) out = out.replace(re, "[redacted]");
	return out.replace(FORBIDDEN_PATHS, "[redacted path]");
}
