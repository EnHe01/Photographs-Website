const yaml = require("js-yaml");

// Splits "---\n<yaml>\n---\n<body>" into { frontmatter, body }.
function parse(fileText) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(fileText);
  if (!match) return { frontmatter: {}, body: fileText };
  const frontmatter = yaml.load(match[1]) || {};
  // js-yaml auto-detects ISO-looking scalars (our `date` field) and parses
  // them into native Date objects instead of leaving them as strings.
  // Normalize back to ISO strings so callers can rely on `date` being a
  // string (e.g. for .localeCompare-based sorting).
  for (const key of Object.keys(frontmatter)) {
    if (frontmatter[key] instanceof Date) frontmatter[key] = frontmatter[key].toISOString();
  }
  return { frontmatter, body: match[2] };
}

function stringify(frontmatter, body) {
  const yamlText = yaml.dump(frontmatter, { lineWidth: -1 });
  return `---\n${yamlText}---\n${body || ""}`;
}

module.exports = { parse, stringify };
