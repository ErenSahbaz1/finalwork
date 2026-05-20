// ─── Gemini API helper ────────────────────────────────────────────────────────
// All Convoi AI calls go through Gemini 2.5 Flash. Free tier limits
// (15 req/min, 1500 req/day) are plenty for a thesis project.
//
// Setup:
//   1. Create a free key at https://aistudio.google.com/app/apikey
//   2. Add to .env:  EXPO_PUBLIC_GEMINI_KEY=your_key_here
//   3. Restart Expo with `npx expo start --clear` after editing .env
// ──────────────────────────────────────────────────────────────────────────────


// gemini-2.5-flash is the current free-tier flash model. If Google deprecates
// this one too, swap in the `gemini-flash-latest` alias.
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface AskGeminiOptions {
	/** Force the model to return pure JSON (no markdown fences). */
	json?: boolean;
	/** Override the default 8192 token cap for very large outputs. */
	maxOutputTokens?: number;
}

export async function askGemini(
	prompt: string,
	options: AskGeminiOptions = {},
): Promise<string> {
	const key = process.env.EXPO_PUBLIC_GEMINI_KEY ?? "";

	if (!key) {
		throw new Error(
			"Gemini API key not configured. Add EXPO_PUBLIC_GEMINI_KEY to .env",
		);
	}

	const body: any = {
		contents: [{ parts: [{ text: prompt }] }],
		generationConfig: {
			temperature: 0.7,
			// Bumped from 4096 — large day-by-day routes were getting truncated
			// mid-JSON, causing "Unexpected end of input" parse errors downstream.
			maxOutputTokens: options.maxOutputTokens ?? 8192,
		},
	};
	if (options.json) {
		body.generationConfig.responseMimeType = "application/json";
	}

	const response = await fetchWithRetry(`${GEMINI_URL}?key=${key}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		let message = `Gemini HTTP ${response.status}`;
		try {
			const err = await response.json();
			message = err?.error?.message ?? message;
		} catch {
			// ignore parse failure — keep status-code fallback
		}
		throw new Error(message);
	}

	const data = await response.json();
	const text: string =
		data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

	// Surface MAX_TOKENS truncations so callers see a clear cause rather than
	// a misleading "JSON Parse error" further down.
	const finishReason = data.candidates?.[0]?.finishReason;
	if (finishReason === "MAX_TOKENS") {
		throw new Error(
			"The AI response was too long and got cut off. Try fewer days or fewer must-see places.",
		);
	}

	return text;
}

/**
 * Retry once on transient 503/overloaded responses. Gemini periodically
 * returns "high demand" errors that clear in 1–2 seconds.
 */
async function fetchWithRetry(
	url: string,
	init: RequestInit,
	attempt = 0,
): Promise<Response> {
	const res = await fetch(url, init);
	if (res.status === 503 && attempt < 2) {
		await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
		return fetchWithRetry(url, init, attempt + 1);
	}
	return res;
}

/**
 * Strip the markdown code fences Gemini sometimes wraps JSON output in,
 * then JSON.parse. Throws if the cleaned string still isn't valid JSON.
 * When called with `responseMimeType: 'application/json'` upstream, this
 * is just a safety net.
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
