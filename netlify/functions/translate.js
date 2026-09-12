const { json, handle, HttpError } = require("./_lib/response");
const { requireAuth, requireEnv } = require("./_lib/auth");

const DEEPL_TARGET = { en: "EN-US", ja: "JA", zh: "ZH" };
const DEEPL_SOURCE = { en: "EN", ja: "JA", zh: "ZH" };

async function deeplTranslate(texts, sourceLang, targetLang) {
  const apiKey = requireEnv("DEEPL_API_KEY");
  const params = new URLSearchParams();
  params.append("auth_key", apiKey);
  params.append("source_lang", DEEPL_SOURCE[sourceLang]);
  params.append("target_lang", DEEPL_TARGET[targetLang]);
  texts.forEach((t) => params.append("text", t || ""));

  const res = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new HttpError(res.status, `DeepL request failed: ${await res.text()}`);
  const data = await res.json();
  return data.translations.map((t) => t.text);
}

exports.handler = async (event) =>
  handle(async () => {
    requireAuth(event);
    if (event.httpMethod !== "POST") throw new HttpError(405, "Method not allowed");

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }

    const { sourceLang, targetLang, fields } = body;
    if (!DEEPL_SOURCE[sourceLang] || !DEEPL_TARGET[targetLang]) {
      throw new HttpError(400, "sourceLang/targetLang must be one of zh, en, ja");
    }
    if (!fields || typeof fields !== "object") throw new HttpError(400, "fields object is required");

    const keys = Object.keys(fields);
    const translated = await deeplTranslate(
      keys.map((k) => fields[k]),
      sourceLang,
      targetLang
    );

    const result = {};
    keys.forEach((k, i) => (result[k] = translated[i]));
    return json(200, { fields: result });
  });
