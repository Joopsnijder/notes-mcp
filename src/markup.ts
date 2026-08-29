/**
 * Apple Notes stores a note body as HTML, but only keeps a small subset of it.
 * Measured against Notes 4.x: h1-h3 survive as bold text at a larger size,
 * ul/ol survive, and two lists that touch are merged into one — so a spacer
 * has to sit between them. Checklists cannot be created through this API at
 * all: class="checklist" and <input type="checkbox"> are both stripped.
 *
 * This converts a plain-text body with light markdown into that subset.
 */

const HTML_MARKUP = /<(br|div|p|ul|ol|li|h[1-6]|b|i|u|span|a|table)\b[^>]*>/i;

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/** Inline markup: **bold** and *italic*, applied after escaping. */
function inline(text: string): string {
    return escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<i>$2</i>");
}

type Block =
    | { kind: "line"; html: string }
    | { kind: "blank" }
    | { kind: "list"; ordered: boolean; items: string[] };

function classify(line: string): Block {
    const trimmed = line.trim();

    if (trimmed === "") return { kind: "blank" };

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
        const size = [24, 18, 0][heading[1].length - 1];
        const text = inline(heading[2]);
        return {
            kind: "line",
            html: size
                ? `<b><span style="font-size: ${size}px">${text}</span></b>`
                : `<b>${text}</b>`,
        };
    }

    // Notes drops real checklists, so a task line degrades to a ballot box that
    // at least still reads as done or not done.
    const task = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(trimmed);
    if (task) {
        const box = task[1].toLowerCase() === "x" ? "☑" : "☐";
        return { kind: "list", ordered: false, items: [`${box} ${inline(task[2])}`] };
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
        return { kind: "list", ordered: false, items: [inline(bullet[1])] };
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
        return { kind: "list", ordered: true, items: [inline(numbered[1])] };
    }

    return { kind: "line", html: inline(trimmed) };
}

export function toNotesHtml(body: string): string {
    if (HTML_MARKUP.test(body)) return body;

    const blocks: Block[] = [];
    for (const line of body.split(/\r?\n/)) {
        const block = classify(line);
        const previous = blocks[blocks.length - 1];

        if (
            block.kind === "list" &&
            previous?.kind === "list" &&
            previous.ordered === block.ordered
        ) {
            previous.items.push(...block.items);
        } else {
            blocks.push(block);
        }
    }

    const html: string[] = [];
    blocks.forEach((block, index) => {
        if (block.kind === "blank") {
            html.push("<div><br></div>");
            return;
        }
        if (block.kind === "line") {
            html.push(`<div>${block.html}</div>`);
            return;
        }

        const tag = block.ordered ? "ol" : "ul";
        html.push(`<${tag}>${block.items.map((i) => `<li>${i}</li>`).join("")}</${tag}>`);

        // Two adjacent lists would be merged into one by Notes.
        if (blocks[index + 1]?.kind === "list") html.push("<div><br></div>");
    });

    return html.join("");
}
