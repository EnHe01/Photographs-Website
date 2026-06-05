import os
import re
import hashlib
import deepl
import yaml

DEEPL_KEY = os.environ["DEEPL_API_KEY"]
translator = deepl.Translator(DEEPL_KEY)

BLOG_DIR = "content/blog"
CACHE_FILE = "scripts/.translation_cache.yml"

def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            return yaml.safe_load(f) or {}
    return {}

def save_cache(cache):
    os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        yaml.dump(cache, f)

def file_hash(content):
    return hashlib.md5(content.encode()).hexdigest()

def parse_frontmatter(content):
    match = re.match(r'^---\n(.*?)\n---\n(.*)', content, re.DOTALL)
    if not match:
        return {}, content
    fm = yaml.safe_load(match.group(1))
    body = match.group(2)
    return fm, body

def translate_text(text, target_lang):
    if not text or not text.strip():
        return text
    result = translator.translate_text(
        text,
        source_lang="ZH",
        target_lang=target_lang,
    )
    return result.text

def write_translated(fm, body, path, lang_code):
    fm_copy = fm.copy()
    fm_copy["title"] = translate_text(fm.get("title", ""), lang_code)
    fm_copy["excerpt"] = translate_text(fm.get("excerpt", ""), lang_code)
    translated_body = translate_text(body, lang_code)
    out = f"---\n{yaml.dump(fm_copy, allow_unicode=True)}---\n{translated_body}"
    with open(path, "w", encoding="utf-8") as f:
        f.write(out)

def main():
    cache = load_cache()
    changed = False

    for fname in os.listdir(BLOG_DIR):
        if not fname.endswith(".md") or fname.startswith("_"):
            continue
        if ".en." in fname or ".ja." in fname:
            continue

        fpath = os.path.join(BLOG_DIR, fname)
        with open(fpath, encoding="utf-8") as f:
            content = f.read()

        h = file_hash(content)
        if cache.get(fname) == h:
            continue

        print(f"Translating {fname}...")
        fm, body = parse_frontmatter(content)
        base = fname.replace(".md", "")

        en_path = os.path.join(BLOG_DIR, f"{base}.en.md")
        write_translated(fm, body, en_path, "EN-US")

        ja_path = os.path.join(BLOG_DIR, f"{base}.ja.md")
        write_translated(fm, body, ja_path, "JA")

        cache[fname] = h
        changed = True

    existing = {f.replace(".md", "") for f in os.listdir(BLOG_DIR)
                if f.endswith(".md") and not f.startswith("_")
                and ".en." not in f and ".ja." not in f}

    for fname in list(cache.keys()):
        base = fname.replace(".md", "")
        if base not in existing:
            for lang in ["en", "ja"]:
                lang_file = os.path.join(BLOG_DIR, f"{base}.{lang}.md")
                if os.path.exists(lang_file):
                    os.remove(lang_file)
                    print(f"Removed {lang_file}")
            del cache[fname]
            changed = True

    if changed:
        save_cache(cache)

if __name__ == "__main__":
    main()
