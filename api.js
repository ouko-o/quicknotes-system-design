
const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadButton = document.getElementById("load-btn");
const statusMessage = document.getElementById("status");
const notesList = document.getElementById("notes-list");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitButton = document.getElementById("submit-btn");

// Reusable function for communicating with the API.
async function request(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

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
        const item = document.createElement("li");
        item.className = "note-item";
        item.dataset.id = note.id;

        const title = document.createElement("h3");
        title.textContent = note.title || "Untitled";

        const body = document.createElement("p");
        body.textContent = note.body || "No body provided.";

        item.append(title, body);
        notesList.appendChild(item);
    });
}

// Task 1: GET notes
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

// Task 2: POST a new note
async function createNote(event) {
    event.preventDefault();

    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();

    // Validate the title before sending a request.
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
                title: title,
                body: body,
                userId: 1
            })
        });

        const newNote = result.data;

        // JSONPlaceholder simulates POST requests; created notes
        // are not permanently saved on its server.
        const existingNotes = Array.from(notesList.children);

        if (
            existingNotes.length === 1 &&
            existingNotes[0].classList.contains("empty-state")
        ) {
            notesList.replaceChildren();
        }

        const item = document.createElement("li");
        item.className = "note-item";
        item.dataset.id = newNote.id;

        const noteTitle = document.createElement("h3");
        noteTitle.textContent = newNote.title || "Untitled";

        const noteBody = document.createElement("p");
        noteBody.textContent = newNote.body || "No body provided.";

        item.append(noteTitle, noteBody);
        notesList.prepend(item);

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

loadButton.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);
