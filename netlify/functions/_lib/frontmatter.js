const yaml = require("js-yaml");

// Splits "---\n<yaml>\n---\n<body>" into { frontmatter, body }.
function parse(fileText) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(fileText);
  if (!match) return { frontmatter: {}, body: fileText };
  const frontmatter = yaml.load(match[1]) || {};
  return { frontmatter, body: match[2] };
}

function stringify(frontmatter, body) {
  const yamlText = yaml.dump(frontmatter, { lineWidth: -1 });
  return `---\n${yamlText}---\n${body || ""}`;
}

module.exports = { parse, stringify };
