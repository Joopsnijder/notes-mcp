import assert from "node:assert";
import { toNotesHtml } from "./markup";
import { updateNote } from "./notes";

// plain lines and blank lines
assert.strictEqual(
    toNotesHtml("Regel een\n\nRegel twee"),
    "<div>Regel een</div><div><br></div><div>Regel twee</div>"
);

// characters that would break the HTML are escaped
assert.strictEqual(toNotesHtml("a < b & c"), "<div>a &lt; b &amp; c</div>");

// headings become the bold, larger text that Notes keeps
assert.strictEqual(
    toNotesHtml("# Titel"),
    '<div><b><span style="font-size: 24px">Titel</span></b></div>'
);
assert.strictEqual(
    toNotesHtml("## Kop"),
    '<div><b><span style="font-size: 18px">Kop</span></b></div>'
);

// consecutive bullets collapse into one list
assert.strictEqual(
    toNotesHtml("- een\n- twee"),
    "<ul><li>een</li><li>twee</li></ul>"
);

// numbered lines keep their own list type
assert.strictEqual(toNotesHtml("1. een"), "<ol><li>een</li></ol>");

// two adjacent lists need a spacer, or Notes merges them into one
assert.strictEqual(
    toNotesHtml("- bullet\n1. genummerd"),
    "<ul><li>bullet</li></ul><div><br></div><ol><li>genummerd</li></ol>"
);

// checklists are not supported by Notes, so they degrade to visible boxes
assert.strictEqual(
    toNotesHtml("- [ ] open\n- [x] klaar"),
    "<ul><li>\u2610 open</li><li>\u2611 klaar</li></ul>"
);

// indented items nest inside the item above them
assert.strictEqual(
    toNotesHtml("- buiten\n  - binnen\n    - dieper\n- buiten twee"),
    "<ul><li>buiten</li><ul><li>binnen</li><ul><li>dieper</li></ul></ul><li>buiten twee</li></ul>"
);

// a nested list keeps its own type
assert.strictEqual(
    toNotesHtml("- buiten\n  1. een\n  2. twee"),
    "<ul><li>buiten</li><ol><li>een</li><li>twee</li></ol></ul>"
);

// "+" asks for the dash list Notes keeps as its own style
assert.strictEqual(
    toNotesHtml("+ streepje een\n+ streepje twee"),
    '<ul class="Apple-dash-list"><li>streepje een</li><li>streepje twee</li></ul>'
);

// a list that switches type mid-way still needs the spacer
assert.strictEqual(
    toNotesHtml("- bullet\n1. genummerd\n- weer bullet"),
    "<ul><li>bullet</li></ul><div><br></div><ol><li>genummerd</li></ol>" +
        "<div><br></div><ul><li>weer bullet</li></ul>"
);

// inline emphasis
assert.strictEqual(toNotesHtml("**vet** en *schuin*"), "<div><b>vet</b> en <i>schuin</i></div>");

// existing markup is passed through untouched
const html = "<h2>Kop</h2><ul><li>punt</li></ul>";
assert.strictEqual(toNotesHtml(html), html);

// an update with no fields is a mistake, not a no-op
assert.rejects(() => updateNote("whatever", {}), /needs a name, a body, or both/);

console.log("markup ok");
