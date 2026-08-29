import { executeOSAScript } from "./osascript";
import { toNotesHtml } from "./markup";

export type Note = {
    id: string;
    name: string;
    creationDate: string;
    modificationDate: string;
    plaintext: string;
};

export type Folder = {
    id: string;
    name: string;
};

/**
 * Creating a note makes Notes put the note name on the first line of the body,
 * where it renders as the title. Replacing a body loses that line, so put it
 * back — otherwise an updated note opens without a heading.
 */
function titledBody(name: string | undefined, body: string): string {
    const html = toNotesHtml(body);
    return name === undefined ? html : `<div>${name}</div>${html}`;
}

export async function createNote(
    folderId: string,
    note: {
        name: string;
        body: string;
    }
): Promise<Omit<Note, "plaintext">> {
    const result = await executeOSAScript(`
        const Notes = Application('Notes');

        const folder = Notes.folders.whose({ id: ${JSON.stringify(folderId)} })[0];
        const note = Notes.Note({
            name: ${JSON.stringify(note.name)},
            body: ${JSON.stringify(toNotesHtml(note.body))}
        });

        folder.notes.push(note);
        const n = note.properties();

        JSON.stringify({
            id: n.id,
            name: n.name,
            creationDate: n.creationDate,
            modificationDate: n.modificationDate
        });
    `);

    return JSON.parse(result) as Omit<Note, "body" | "plaintext">;
}

export async function updateNote(
    id: string,
    update: {
        name?: string;
        body?: string;
    }
): Promise<Omit<Note, "plaintext">> {
    if (update.name === undefined && update.body === undefined) {
        throw new Error("updateNote needs a name, a body, or both");
    }

    // The body has to be written first: Notes rewrites the note name from the
    // first line of a new body, so a name assigned before it would be lost.
    const assignments = [
        update.body !== undefined
            ? `note.body = ${JSON.stringify(titledBody(update.name, update.body))};`
            : "",
        update.name !== undefined
            ? `note.name = ${JSON.stringify(update.name)};`
            : "",
    ].join("\n        ");

    // Notes derives the displayed title from the first line of the body, so
    // writing a body silently renames the note. Put the name back unless the
    // caller asked for a new one.
    const restoreName =
        update.body !== undefined && update.name === undefined
            ? "note.name = previousName;"
            : "";

    const result = await executeOSAScript(`
        const Notes = Application('Notes');
        const note = Notes.notes.byId(${JSON.stringify(id)});
        const previousName = note.name();

        ${assignments}
        ${restoreName}

        const n = note.properties();

        JSON.stringify({
            id: n.id,
            name: n.name,
            creationDate: n.creationDate,
            modificationDate: n.modificationDate
        });
    `);

    return JSON.parse(result) as Omit<Note, "plaintext">;
}

export async function getFolders(): Promise<Folder[]> {
    const result = await executeOSAScript(`
        const Notes = Application('Notes');
        const folders = Notes.folders();

        JSON.stringify(folders.map(folder => {
            const f = folder.properties();

            return {
                id: f.id,
                name: f.name
            };
        }));
    `);

    return JSON.parse(result) as Folder[];
}

export async function getNotes(
    folderId: string
): Promise<Omit<Note, "plaintext">[]> {
    const result = await executeOSAScript(`
        const Notes = Application('Notes');
        
        const targetFolder = Notes.folders.byId(${JSON.stringify(folderId)});
        const notes = targetFolder.notes();

        JSON.stringify(notes.map(n => {
            const p = n.properties();

            return {
                id: p.id,
                name: p.name,
                creationDate: p.creationDate,
                modificationDate: p.modificationDate,
            };
        }))
    `);

    const notes = JSON.parse(result);

    return notes as Omit<Note, "plaintext">[];
}

export async function getNoteById(id: string): Promise<Note> {
    const result = await executeOSAScript(`
        const Notes = Application('Notes');
        const note = Notes.notes.byId(${JSON.stringify(id)});

        const n = note.properties();

        JSON.stringify({
            id: n.id,
            name: n.name,
            plaintext: n.plaintext,
            creationDate: n.creationDate,
            modificationDate: n.modificationDate
        });
    `);

    return JSON.parse(result);
}

export async function getNoteByTitle(title: string): Promise<Note> {
    const result = await executeOSAScript(`
        const Notes = Application('Notes');
        
        const notes = Notes.notes.whose({name: ${JSON.stringify(title)}});        
        const note = notes[0];

        const n = note.properties();

        JSON.stringify({
            id: n.id,
            name: n.name,
            plaintext: n.plaintext,
            creationDate: n.creationDate,
            modificationDate: n.modificationDate
        });
    `);

    return JSON.parse(result);
}

export async function noteCount(): Promise<number> {
    const result = await executeOSAScript(`const Notes = Application('Notes');
const notes = Notes.notes();
notes.length`);

    return parseInt(result);
}
