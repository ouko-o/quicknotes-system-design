
const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadButton = document.getElementById("load-btn");
const statusMessage = document.getElementById("status");
const notesList = document.getElementById("notes-list");
const noteForm = document.getElementById("note-form");

// Shared request function for communicating with the API.
async function request(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    // DELETE responses may not contain JSON.
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

        const title = document.createElement("h3");
        title.textContent = note.title || "Untitled";

        const body = document.createElement("p");
        body.textContent = note.body || "No body provided.";

        item.append(title, body);
        notesList.appendChild(item);
    });
}

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

// Prevent the unfinished form from refreshing the page.
// The POST functionality will be added in the next task.
noteForm.addEventListener("submit", (event) => {
    event.preventDefault();
});

loadButton.addEventListener("click", loadNotes);
