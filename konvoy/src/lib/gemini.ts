// ─── LLM helper (Groq backend) ────────────────────────────────────────────────
// All Convoi AI calls go through Groq's free-tier `llama-3.3-70b-versatile`.
// The file is still named gemini.ts — and the exported function is still
// askGemini() — because callers in planner.ts don't care which provider is
// behind the curtain. Swap-in-place: only this file changes.
//
// Why Groq?
//   • Free tier, no credit card, no prepay credits to deplete.
//   • ~30 req/min, ~14,400 req/day — vastly more than thesis-scale usage.
//   • OpenAI-compatible JSON mode (response_format: { type: "json_object" }).
//   • Faster inference than Gemini in practice.
//
// Setup:
//   1. Free key at https://console.groq.com
//   2. Add to .env:  EXPO_PUBLIC_GROQ_KEY=gsk_...
//   3. Restart Expo with `npx expo start --clear` after editing .env.
// ──────────────────────────────────────────────────────────────────────────────

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.3-70b-versatile is Groq's current best general-purpose model.
// If they deprecate it, swap in `llama-3.1-70b-versatile` or the next flagship.
const GROQ_MODEL = "llama-3.3-70b-versatile";

interface AskGeminiOptions {
	/** Force the model to return pure JSON (no markdown fences). */
	json?: boolean;
	/** Override the default 8192 token cap for very large outputs. */
	maxOutputTokens?: number;
}

/**
 * Send a single user-turn prompt to Groq and return the model's text output.
 * Function name kept as `askGemini` so existing callers (planner.ts) don't
 * need to change — only the network destination is different.
 */
export async function askGemini(
	prompt: string,
	options: AskGeminiOptions = {},
): Promise<string> {
	const key = process.env.EXPO_PUBLIC_GROQ_KEY ?? "";

	if (!key) {
		throw new Error(
			"Groq API key not configured. Add EXPO_PUBLIC_GROQ_KEY to .env",
		);
	}

	const body: Record<string, unknown> = {
		model: GROQ_MODEL,
		messages: [{ role: "user", content: prompt }],
		temperature: 0.7,
		// Bumped from 4096 — large day-by-day routes were getting truncated
		// mid-JSON, causing "Unexpected end of input" parse errors downstream.
		max_tokens: options.maxOutputTokens ?? 8192,
	};
	if (options.json) {
		body.response_format = { type: "json_object" };
	}

	const response = await fetchWithRetry(GROQ_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${key}`,
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		let message = `Groq HTTP ${response.status}`;
		try {
			const err = await response.json();
			message = err?.error?.message ?? message;
		} catch {
			// ignore parse failure — keep status-code fallback
		}
		throw new Error(message);
	}

	const data = await response.json();
	const text: string = data.choices?.[0]?.message?.content ?? "";

	// Surface output truncations so callers see a clear cause rather than a
	// misleading "JSON Parse error" further down. Groq uses `finish_reason:
	// "length"` (OpenAI convention) instead of Gemini's "MAX_TOKENS".
	const finish = data.choices?.[0]?.finish_reason;
	if (finish === "length") {
		throw new Error(
			"The AI response was too long and got cut off. Try fewer days or fewer must-see places.",
		);
	}

	return text;
}

/**
 * Retry once on transient 5xx responses or 429 rate limits. Groq periodically
 * returns brief 503s under load that clear in 1–2 seconds.
 */
async function fetchWithRetry(
	url: string,
	init: RequestInit,
	attempt = 0,
): Promise<Response> {
	const res = await fetch(url, init);
	const retryable = res.status === 503 || res.status === 502 || res.status === 429;
	if (retryable && attempt < 2) {
		await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
		return fetchWithRetry(url, init, attempt + 1);
	}
	return res;
}

/**
 * Strip the markdown code fences the model sometimes wraps JSON output in,
 * then JSON.parse. Throws if the cleaned string still isn't valid JSON.
 * When called with `responseMimeType: 'application/json'` / `response_format`
 * upstream this is a safety net.
 */
export function parseGeminiJson<T = unknown>(raw: string): T {
	let clean = raw.replace(/```json|```/g, "").trim();
	// Best-effort recovery for truncated responses: if the string ends without
	// closing all brackets, append the missing closers in reverse order.
	const opens = (clean.match(/[{[]/g) ?? []).length;
	const closes = (clean.match(/[}\]]/g) ?? []).length;
	if (opens > closes) {
		const stack: string[] = [];
		for (const ch of clean) {
			if (ch === "{") stack.push("}");
			else if (ch === "[") stack.push("]");
			else if (ch === "}" || ch === "]") stack.pop();
		}
		clean += stack.reverse().join("");
	}
	return JSON.parse(clean) as T;
}
