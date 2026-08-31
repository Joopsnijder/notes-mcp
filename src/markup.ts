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

/** Notes has three list styles: bullets, dashes, and numbers. */
type Style = "bullet" | "dash" | "number";

const OPEN: Record<Style, string> = {
    bullet: "<ul>",
    dash: '<ul class="Apple-dash-list">',
    number: "<ol>",
};

type Item = { indent: number; style: Style; html: string };

type Block =
    | { kind: "line"; html: string }
    | { kind: "blank" }
    | { kind: "list"; items: Item[] };

/** A tab indents as far as two spaces do; only the relative order matters. */
function indentOf(line: string): number {
    return /^[ \t]*/.exec(line)![0].replace(/\t/g, "  ").length;
}

function classify(line: string): Block {
    const trimmed = line.trim();
    const indent = indentOf(line);

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
        return {
            kind: "list",
            items: [{ indent, style: "bullet", html: `${box} ${inline(task[2])}` }],
        };
    }

    // Notes keeps a dash list as its own style, so "+" opts into one.
    const bullet = /^([-*+])\s+(.*)$/.exec(trimmed);
    if (bullet) {
        const style = bullet[1] === "+" ? "dash" : "bullet";
        return {
            kind: "list",
            items: [{ indent, style, html: inline(bullet[2]) }],
        };
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
        return {
            kind: "list",
            items: [{ indent, style: "number", html: inline(numbered[1]) }],
        };
    }

    return { kind: "line", html: inline(trimmed) };
}

/**
 * Indents can be any width, so they are ranked rather than measured: each new,
 * deeper indent in a list opens one more level.
 */
function depths(items: Item[]): number[] {
    const stack: number[] = [];

    return items.map((item) => {
        while (stack.length && item.indent < stack[stack.length - 1]) stack.pop();
        if (!stack.length || item.indent > stack[stack.length - 1]) stack.push(item.indent);
        return stack.length - 1;
    });
}

/**
 * Notes keeps a list nested inside another list, so depth survives. It merges
 * two lists that touch, though, so a switch of list type needs a spacer.
 */
function renderList(items: Item[]): string {
    const depth = depths(items);

    /** Renders one list at `level`, and returns where it stopped. */
    const list = (start: number, level: number): [string, number] => {
        const style = items[start].style;
        const parts: string[] = [];
        let i = start;

        while (i < items.length && depth[i] >= level) {
            if (depth[i] > level) {
                const [nested, next] = list(i, depth[i]);
                parts.push(nested);
                i = next;
            } else if (items[i].style !== style) {
                break;
            } else {
                parts.push(`<li>${items[i].html}</li>`);
                i++;
            }
        }

        const close = style === "number" ? "</ol>" : "</ul>";
        return [`${OPEN[style]}${parts.join("")}${close}`, i];
    };

    const lists: string[] = [];
    let index = 0;
    while (index < items.length) {
        const [html, next] = list(index, 0);
        lists.push(html);
        index = next;
    }

    return lists.join("<div><br></div>");
}

export function toNotesHtml(body: string): string {
    if (HTML_MARKUP.test(body)) return body;

    const blocks: Block[] = [];
    for (const line of body.split(/\r?\n/)) {
        const block = classify(line);
        const previous = blocks[blocks.length - 1];

        if (block.kind === "list" && previous?.kind === "list") {
            previous.items.push(...block.items);
        } else {
            blocks.push(block);
        }
    }

    const html: string[] = [];
    for (const block of blocks) {
        if (block.kind === "blank") {
            html.push("<div><br></div>");
        } else if (block.kind === "line") {
            html.push(`<div>${block.html}</div>`);
        } else {
            html.push(renderList(block.items));
        }
    }

    return html.join("");
}
