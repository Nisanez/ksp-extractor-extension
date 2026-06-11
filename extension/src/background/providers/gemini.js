/* Google Gemini adapter. */

const DEFAULT_MODEL = "gemini-2.0-flash";

export async function ask({ apiKey, model, system, user }) {
  if (!apiKey) throw new Error("missing_key");
  const m = model || DEFAULT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: 1024 },
  };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error && data.error.message;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const parts =
    (data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts) ||
    [];
  const text = parts
    .map((p) => p.text || "")
    .join("\n")
    .trim();
  return text || "(empty response)";
}
