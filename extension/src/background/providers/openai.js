/* OpenAI / GPT adapter. */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

export async function ask({ apiKey, model, system, user }) {
  if (!apiKey) throw new Error("missing_key");
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages,
      max_tokens: 1024,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error && data.error.message;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const text =
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;
  return (text || "").trim() || "(empty response)";
}
