
const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadButton = document.getElementById("load-btn");
const statusMessage = document.getElementById("status");
const notesList = document.getElementById("notes-list");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitButton = document.getElementById("submit-btn");

// Reusable function for API requests.
async function request(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    // DELETE responses may have no JSON body.
    if (response.status === 204) {
        return { data: null, status: response.status };
    }

    const data = await response.json();

    return {
        data,
        status: response.status
    };
}

function showStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = type;
}

function createNoteElement(note) {
    const item = document.createElement("li");
    item.className = "note-item";
    item.dataset.id = note.id;

    const title = document.createElement("h3");
    title.textContent = note.title || "Untitled";

    const body = document.createElement("p");
    body.textContent = note.body || "No body provided.";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.className = "delete-btn";

    // Store the ID so the correct note can be deleted.
    deleteButton.dataset.id = note.id;
    deleteButton.addEventListener("click", () => deleteNote(note.id, item));

    item.append(title, body, deleteButton);

    return item;
}

function renderNotes(notes) {
    notesList.replaceChildren();

    if (notes.length === 0) {
        const item = document.createElement("li");
        item.textContent = "No notes found. Load notes or create one.";
        item.className = "empty-state";
        notesList.appendChild(item);
        return;
    }

    notes.forEach((note) => {
        notesList.appendChild(createNoteElement(note));
    });
}

// Task 1: GET notes.
async function loadNotes() {
    loadButton.disabled = true;
    showStatus("Loading notes...");

    try {
        const result = await request(`${API_URL}?_limit=10`);
        renderNotes(result.data);

        if (result.data.length === 0) {
            showStatus("No notes were returned by the server.");
        } else {
            showStatus(
                `Loaded ${result.data.length} notes from the server.`,
                "status-success"
            );
        }
    } catch (error) {
        showStatus(
            "Sorry, we couldn't load the notes. Please try again.",
            "status-error"
        );
        console.error("Loading notes failed:", error);
    } finally {
        loadButton.disabled = false;
    }
}

// Task 2: POST a new note.
async function createNote(event) {
    event.preventDefault();

    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();

    if (!title) {
        showStatus("Please enter a title.", "status-error");
        titleInput.focus();
        return;
    }

    if (title.length > 100) {
        showStatus(
            "The title must not exceed 100 characters.",
            "status-error"
        );
        titleInput.focus();
        return;
    }

    submitButton.disabled = true;
    showStatus("Creating note...");

    try {
        const result = await request(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=UTF-8"
            },
            body: JSON.stringify({
                title,
                body,
                userId: 1
            })
        });

        const newNote = result.data;

        // JSONPlaceholder simulates creation but does not persist
        // new notes, so we update the current page locally.
        const emptyState = notesList.querySelector(".empty-state");
        if (emptyState) {
            notesList.replaceChildren();
        }

        notesList.prepend(createNoteElement(newNote));

        showStatus(
            `Note created (status ${result.status}, id ${newNote.id}).`,
            "status-success"
        );

        noteForm.reset();
    } catch (error) {
        showStatus(
            "Sorry, we couldn't create the note. Please try again.",
            "status-error"
        );
        console.error("Creating note failed:", error);
    } finally {
        submitButton.disabled = false;
    }
}

// Task 3: DELETE a note.
async function deleteNote(noteId, noteElement) {
    const deleteButton = noteElement.querySelector(".delete-btn");

    if (!deleteButton) {
        return;
    }

    deleteButton.disabled = true;
    showStatus(`Deleting note ${noteId}...`);

    try {
        const result = await request(`${API_URL}/${noteId}`, {
            method: "DELETE"
        });

        // JSONPlaceholder does not permanently delete its sample data.
        // Remove the note locally after the simulated DELETE succeeds.
        noteElement.remove();

        if (notesList.children.length === 0) {
            const emptyItem = document.createElement("li");
            emptyItem.className = "empty-state";
            emptyItem.textContent = "No notes remaining. Load notes or create one.";
            notesList.appendChild(emptyItem);
        }

        showStatus(
            `Note ${noteId} deleted successfully (status ${result.status}).`,
            "status-success"
        );
    } catch (error) {
        showStatus(
            `Sorry, we couldn't delete note ${noteId}. Please try again.`,
            "status-error"
        );
        console.error("Deleting note failed:", error);
    } finally {
        deleteButton.disabled = false;
    }
}

loadButton.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);
