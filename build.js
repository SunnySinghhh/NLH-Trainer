/**
 * Produces trainer.html from trainer.src.html as pure ASCII.
 *
 * The page is served in places that do not always declare a charset, and a
 * mis-declared one turns the card suits into mojibake. Escaping every
 * non-ASCII character removes the dependency entirely: HTML entities outside
 * the script block, \u escapes inside it.
 */

const fs = require("fs");

const src = `${__dirname}/trainer.src.html`;
const out = `${__dirname}/trainer.html`;
const html = fs.readFileSync(src, "utf8");

const marker = "<script>\n(() => {";
const start = html.indexOf(marker);
if (start < 0) throw new Error("could not find the script block");
const end = html.indexOf("</script>", start);

const entities = (text) =>
  [...text].map((c) => (c.charCodeAt(0) < 128 ? c : `&#x${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")};`)).join("");

const escapes = (text) =>
  [...text].map((c) => (c.charCodeAt(0) < 128 ? c : `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)).join("");

const built =
  entities(html.slice(0, start)) + escapes(html.slice(start, end)) + entities(html.slice(end));

const bad = [...new Set([...built].filter((c) => c.charCodeAt(0) > 127))];
if (bad.length) throw new Error(`still non-ASCII: ${bad.join(" ")}`);

fs.writeFileSync(out, built);
console.log(`wrote trainer.html (${built.length} bytes, pure ASCII)`);
