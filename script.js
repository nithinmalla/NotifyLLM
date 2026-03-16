const DOM = {
    notesContainer: document.getElementById('notes-container'),
    newNoteBtn: document.getElementById('new-note-btn'),
    searchInput: document.getElementById('search-input'),
    themeToggle: document.getElementById('theme-toggle'),
    noteTemplate: document.getElementById('note-template'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    importFile: document.getElementById('import-file'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    mobileMenuToggle: document.querySelector('.mobile-menu-toggle'),
    navLinksContainer: document.querySelector('.nav-links')
};

let notes = [];
let saveTimeout = null;
let isDown = false;
let startX;
let scrollLeft;

// Initialize app
function init() {
    loadTheme();
    loadNotes();
    setupEventListeners();
    renderNotes();
}

// Data Management
function loadNotes() {
    let saved = localStorage.getItem('notify_app_notes');
    if (!saved) {
        // Upgrading legacy storage key
        saved = localStorage.getItem('progress_dashboard_notes');
        if (saved) {
            localStorage.setItem('notify_app_notes', saved);
        }
    }

    if (saved) {
        try {
            notes = JSON.parse(saved);
            // Default properties backwards compatibility
            notes.forEach(note => {
                if(!note.status) note.status = 'Not Started';
                if(note.percentage === undefined) note.percentage = 0;
            });
        } catch (e) {
            console.error("Error parsing saved notes", e);
            notes = [];
        }
    }
}

function saveNotes() {
    localStorage.setItem('notify_app_notes', JSON.stringify(notes));
}

function createNote() {
    const newNote = {
        id: 'note_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
        title: '',
        progress: '',
        nextStep: '',
        status: 'Not Started',
        percentage: 0,
        timestamp: Date.now()
    };
    
    // Add to beginning of array
    notes.unshift(newNote);
    saveNotes();
    
    DOM.searchInput.value = ''; // Clear search
    renderNotes();
    
    // Focus the title of the new note
    setTimeout(() => {
        const firstCard = DOM.notesContainer.querySelector('.note-card');
        if(firstCard) firstCard.querySelector('.note-title').focus();
    }, 100);
}

// Shows save indicator briefly
function flashSaveIndicator(noteElement) {
    const saveIndicator = noteElement.querySelector('.save-indicator');
    saveIndicator.classList.add('show');
    
    if (noteElement.saveTimeoutId) clearTimeout(noteElement.saveTimeoutId);
    
    noteElement.saveTimeoutId = setTimeout(() => {
        saveIndicator.classList.remove('show');
    }, 2000);
}

function updateNote(id, field, value, noteElement, isManualSave = false) {
    const index = notes.findIndex(n => n.id === id);
    if (index !== -1) {
        notes[index][field] = value;
        notes[index].timestamp = Date.now();
        
        const timestampSpan = noteElement.querySelector('.timestamp');
        timestampSpan.textContent = `Last updated: Just now`;
        
        if (isManualSave) {
            flashSaveIndicator(noteElement);
            saveNotes();
        } else {
            // Auto-save debounce without flash
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                saveNotes();
            }, 500);
        }
    }
}

function deleteNote(id, element) {
    if(confirm('Are you sure you want to delete this note?')) {
        element.classList.add('deleting');
        
        setTimeout(() => {
            notes = notes.filter(n => n.id !== id);
            saveNotes();
            element.remove();
            
            if(notes.length === 0) renderNotes(); // Show empty state
        }, 300); // Wait for animation
    }
}

// Slider Interaction (Mouse Drag to Scroll)
function initSliderDrag() {
    const slider = DOM.notesContainer;

    slider.addEventListener('mousedown', (e) => {
        // Prevent drag if clicking on an input or button
        if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
        
        isDown = true;
        slider.style.scrollBehavior = 'auto'; // Disable smooth scroll snap during manual drag
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.style.scrollBehavior = 'smooth';
    });

    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.style.scrollBehavior = 'smooth';
    });

    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault(); // Prevent text selection
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed multiplier
        slider.scrollLeft = scrollLeft - walk;
    });
}

// Observer to track which card is closest to center
function initCenterObserver() {
    // We listen to the scroll event to find the center card dynamically
    DOM.notesContainer.addEventListener('scroll', () => {
        const containerCenter = DOM.notesContainer.offsetLeft + DOM.notesContainer.offsetWidth / 2;
        let closestCard = null;
        let minDistance = Infinity;

        const cards = DOM.notesContainer.querySelectorAll('.note-card');
        cards.forEach(card => {
            const cardCenter = card.offsetLeft + card.offsetWidth / 2 - DOM.notesContainer.scrollLeft;
            const distance = Math.abs(containerCenter - cardCenter);

            if (distance < minDistance) {
                minDistance = distance;
                closestCard = card;
            }
        });

        cards.forEach(card => card.classList.remove('active'));
        if (closestCard) {
            closestCard.classList.add('active');
        }
    });
}

// Rendering
function renderNotes() {
    DOM.notesContainer.innerHTML = '';
    const searchTerm = DOM.searchInput.value.toLowerCase();

    const filteredNotes = notes.filter(note => {
        return note.title.toLowerCase().includes(searchTerm) || 
               note.progress.toLowerCase().includes(searchTerm) ||
               note.nextStep.toLowerCase().includes(searchTerm);
    });

    if (filteredNotes.length === 0) {
        if (searchTerm) {
            DOM.notesContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No notes match your search.</div>`;
        } else {
            DOM.notesContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">Click "New Note" to get started!</div>`;
        }
        return;
    }

    filteredNotes.forEach(note => renderNote(note));
    
    // Trigger scroll event manually to assign initial active card
    setTimeout(() => {
        DOM.notesContainer.dispatchEvent(new Event('scroll'));
    }, 100);
}

function renderNote(note) {
    const clone = DOM.noteTemplate.content.cloneNode(true);
    const card = clone.querySelector('.note-card');
    card.dataset.id = note.id; // Store id
    const titleInput = card.querySelector('.note-title');
    const progressInput = card.querySelector('.progress-input');
    const nextStepInput = card.querySelector('.next-step-input');
    const statusChips = card.querySelectorAll('.status-chip');
    const progressSlider = card.querySelector('.progress-slider');
    const progressText = card.querySelector('.progress-text');
    const timestampSpan = card.querySelector('.timestamp');
    const deleteBtn = card.querySelector('.delete-btn');
    const editBtn = card.querySelector('.edit-btn');
    const saveBtn = card.querySelector('.save-btn');

    // Populate fields
    titleInput.value = note.title;
    progressInput.value = note.progress;
    nextStepInput.value = note.nextStep;
    progressSlider.value = note.percentage;
    progressText.textContent = `${note.percentage}%`;
    progressSlider.style.backgroundSize = `${note.percentage}% 100%`;
    timestampSpan.textContent = `Last updated: ${formatDate(note.timestamp)}`;

    // Initialize Status Chips
    statusChips.forEach(chip => {
        if (chip.dataset.status === note.status) {
            chip.classList.add('active');
        }
        
        chip.addEventListener('click', () => {
            // Remove active from all
            statusChips.forEach(c => c.classList.remove('active'));
            // Add to clicked
            chip.classList.add('active');
            // Update note
            updateNote(note.id, 'status', chip.dataset.status, card);
        });
    });

    // Auto-resize
    autoResize(progressInput);
    autoResize(nextStepInput);

    // Event Listeners for Typing/Updates
    titleInput.addEventListener('input', (e) => updateNote(note.id, 'title', e.target.value, card));
    progressInput.addEventListener('input', (e) => {
        autoResize(e.target);
        updateNote(note.id, 'progress', e.target.value, card);
    });
    nextStepInput.addEventListener('input', (e) => {
        autoResize(e.target);
        updateNote(note.id, 'nextStep', e.target.value, card);
    });



    // Progress percentage
    progressSlider.addEventListener('input', (e) => {
        progressText.textContent = `${e.target.value}%`;
        progressSlider.style.backgroundSize = `${e.target.value}% 100%`;
        updateNote(note.id, 'percentage', parseInt(e.target.value), card);
    });
    progressSlider.addEventListener('change', () => flashSaveIndicator(card));

    // Action Buttons
    deleteBtn.addEventListener('click', () => deleteNote(note.id, card));
    editBtn.addEventListener('click', () => titleInput.focus());
    saveBtn.addEventListener('click', () => {
        saveNotes();
        flashSaveIndicator(card);
    });

    DOM.notesContainer.appendChild(card);
    return card;
}

// Utils
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Within last minute
    if (diff < 60000) return 'Just now';
    
    // Format appropriately
    return date.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function triggerSearch() {
    renderNotes();
}

function loadTheme() {
    const isDark = localStorage.getItem('dark_theme') === 'true';
    if (isDark) {
        document.body.classList.add('dark-theme');
        DOM.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        // System preference default maybe?
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && localStorage.getItem('dark_theme') === null) {
            document.body.classList.add('dark-theme');
            DOM.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('dark_theme', isDark);
    
    if (isDark) {
        DOM.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        DOM.themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
}

function exportJSON() {
    const dataStr = JSON.stringify(notes, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `notify_export_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedNotes = JSON.parse(e.target.result);
            if(Array.isArray(importedNotes)) {
                // Merge strategies could go here, but for now we'll overwrite or append.
                // Let's ask user.
                if(confirm("Do you want to clear existing notes and replace with imported ones? (Cancel to append instead)")) {
                    notes = importedNotes;
                } else {
                    notes = [...importedNotes, ...notes];
                }
                saveNotes();
                renderNotes();
                alert("Notes imported successfully!");
            } else {
                alert("Invalid JSON format. Expected an array of notes.");
            }
        } catch(err) {
            alert("Error parsing JSON file. Make sure it's valid.");
            console.error(err);
        }
    };
    reader.readAsText(file);
    
    // Clear input so same file can be imported again if needed
    event.target.value = '';
}

function setupEventListeners() {
    DOM.newNoteBtn.addEventListener('click', createNote);
    DOM.searchInput.addEventListener('input', triggerSearch);
    DOM.themeToggle.addEventListener('click', toggleTheme);
    DOM.exportBtn.addEventListener('click', exportJSON);
    
    DOM.importBtn.addEventListener('click', () => {
        DOM.importFile.click();
    });
    DOM.importFile.addEventListener('change', importJSON);
    
    // Slider Navigation Arrows
    if(DOM.prevBtn) {
        DOM.prevBtn.addEventListener('click', () => {
            const cardWidth = 380 + 48; // card + gap
            DOM.notesContainer.scrollBy({ left: -cardWidth, behavior: 'smooth' });
        });
    }
    
    if(DOM.nextBtn) {
        DOM.nextBtn.addEventListener('click', () => {
            const cardWidth = 380 + 48;
            DOM.notesContainer.scrollBy({ left: cardWidth, behavior: 'smooth' });
        });
    }
    
    // Mobile Menu Toggle
    if (DOM.mobileMenuToggle && DOM.navLinksContainer) {
        DOM.mobileMenuToggle.addEventListener('click', () => {
            DOM.navLinksContainer.classList.toggle('mobile-open');
        });
    }
    
    // Init Drag Logic
    initSliderDrag();
    initCenterObserver();
    
    // Re-adjust textarea sizes on window resize
    window.addEventListener('resize', () => {
        document.querySelectorAll('textarea').forEach(autoResize);
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);
