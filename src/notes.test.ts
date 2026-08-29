import assert from "node:assert";
import { bodyToHtml } from "./notes";

// plain text: elke regel een eigen div, lege regel blijft zichtbaar
assert.strictEqual(
    bodyToHtml("Regel een\n\nRegel twee"),
    "<div>Regel een</div><div><br></div><div>Regel twee</div>"
);

// tekens die HTML zouden breken, worden ontsmet
assert.strictEqual(bodyToHtml("a < b & c"), "<div>a &lt; b &amp; c</div>");

// bestaande markup blijft ongemoeid
const html = "<h2>Kop</h2><ul><li>punt</li></ul>";
assert.strictEqual(bodyToHtml(html), html);

// losse punthaken maken van tekst nog geen HTML
assert.strictEqual(bodyToHtml("5 > 3"), "<div>5 &gt; 3</div>");

console.log("bodyToHtml ok");
