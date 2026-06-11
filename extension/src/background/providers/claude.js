/* Claude (Anthropic) adapter.
 * Uses the anthropic-dangerous-direct-browser-access header so the call
 * works from an extension origin without a proxy. The key lives only in
 * chrome.storage.local and goes straight to api.anthropic.com — no third
 * party in between. */

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5";

export async function ask({ apiKey, model, system, user }) {
  if (!apiKey) throw new Error("missing_key");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      max_tokens: 1024,
      system: system || undefined,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error && data.error.message;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || "(empty response)";
}
