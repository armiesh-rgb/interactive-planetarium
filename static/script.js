let aladin = null;
let starCatalog = null;
let highlightCatalog = null;
let constellationOverlay = null;
let activeConstellation = null;

// ПОИСК ЗВЕЗДЫ

function findStar(name) {
    return starData.find(function(star) {
        return star.name === name;
    });
}

// ИНИЦИАЛИЗАЦИЯ ALADIN

A.init.then(function() {
    aladin = A.aladin('#aladin-lite-div', {
        survey: 'P/DSS2/color',
        projection: 'TAN',
        fov: 60,
        cooFrame: 'equatorial',
        showReticle: false,
        showZoomControl: true,
        showFullscreenControl: false,
        showLayersControl: false,
        showGotoControl: false,
        showCooGrid: false
    });

    document.getElementById("aladin-lite-div").addEventListener("click", function(event) {
        const target = event.target;

        if (
            target.closest(".aladin-fov") ||
            target.closest("canvas") ||
            target.tagName === "CANVAS"
        ) {
            const sidePanel = document.getElementById("side-panel");

            if (sidePanel && sidePanel.classList.contains("mobile-open")) {
                sidePanel.classList.remove("mobile-open");
            }
        }
    });

    // КАТАЛОГ ЗВЁЗД

    starCatalog = A.catalog({
        name: 'Звёзды',
        sourceSize: 14,
        color: '#ffff00',
        shape: 'circle',
        displayLabel: true,
        labelColumn: 'name',
        labelColor: '#ffffff',
        labelFont: '14px sans-serif',
        onClick: function(source) {
            console.log('Клик по звезде:', source);

            if (!source || !source.data || !source.data.name) {
                return;
            }

            const star = findStar(source.data.name);

            if (!star) {
                return;
            }

            if (activeConstellation) {
                const constellation = constellationData[activeConstellation];

                if (!constellation.stars.includes(star.name)) {
                    clearConstellation();
                }
            }

            highlightStar(star);
            showStarCard(star);
            updateConstellationVisibility();
        }
    });

    // ДОБАВЛЯЕМ ЗВЁЗДЫ НА КАРТУ

    starData.forEach(function(star) {
        starCatalog.addSources(
            A.source(star.ra * 15, star.dec, {
                name: star.name
            })
        );
    });

    aladin.addCatalog(starCatalog);

    // ВЫДЕЛЕНИЕ ЗВЕЗДЫ

    highlightCatalog = A.catalog({
        name: 'Выделение',
        sourceSize: 30,
        color: '#ffffff',
        shape: 'cross',
        displayLabel: false
    });

    aladin.addCatalog(highlightCatalog);

    // ЛИНИИ СОЗВЕЗДИЙ

    constellationOverlay = A.graphicOverlay({
        name: 'Созвездия',
        color: '#ffffff',
        lineWidth: 3
    });

    aladin.addOverlay(constellationOverlay);
    constellationOverlay.hide();

    aladin.on('zoomChanged', function() {
        updateConstellationVisibility();
    });
});

// ВЫДЕЛИТЬ ЗВЕЗДУ

function highlightStar(star) {
    if (!highlightCatalog) {
        return;
    }

    highlightCatalog.removeAll();

    highlightCatalog.addSources(
        A.source(star.ra * 15, star.dec, {
            name: star.name
        })
    );
}

// ПЕРЕЙТИ К ЗВЕЗДЕ

function goToStar(starName, button) {
    const star = findStar(starName);

    if (!star || !aladin) {
        return;
    }

    if (activeConstellation) {
        const constellation = constellationData[activeConstellation];

        if (!constellation.stars.includes(starName)) {
            clearConstellation();
        }
    }

    selectButton(button);

    aladin.gotoRaDec(star.ra * 15, star.dec);
    aladin.setFov(2);

    highlightStar(star);
    showStarCard(star);
}

// ПЕРЕЙТИ К ЗВЕЗДЕ ИЗ КАРТОЧКИ СОЗВЕЗДИЯ

function goToStarFromConstellation(starName) {
    const star = findStar(starName);

    if (!star || !aladin) {
        return;
    }

    aladin.gotoRaDec(star.ra * 15, star.dec);
    aladin.setFov(2);

    highlightStar(star);
    showStarCard(star);
}

// ПЕРЕЙТИ К СОЗВЕЗДИЮ

function goToConstellation(constellationName, button) {
    const constellation = constellationData[constellationName];

    if (!constellation || !aladin) {
        return;
    }

    activeConstellation = constellationName;
    selectButton(button);
    highlightCatalog.removeAll();

    aladin.gotoRaDec(constellation.ra * 15, constellation.dec);
    aladin.setFov(25);

    drawConstellation(constellationName);
    showConstellationCard(constellationName);
}

// НАРИСОВАТЬ СОЗВЕЗДИЕ

function drawConstellation(constellationName) {
    if (!constellationOverlay) {
        return;
    }

    const constellation = constellationData[constellationName];

    if (!constellation) {
        return;
    }

    constellationOverlay.removeAll();

    constellation.lines.forEach(function(pair) {
        const star1 = findStar(pair[0]);
        const star2 = findStar(pair[1]);

        if (!star1 || !star2) {
            return;
        }

        const line = A.polyline(
            [
                [star1.ra * 15, star1.dec],
                [star2.ra * 15, star2.dec]
            ],
            {
                color: '#ffffff',
                lineWidth: 3
            }
        );

        constellationOverlay.add(line);
    });

    constellationOverlay.show();

    console.log('Созвездие нарисовано:', constellationName);

    updateConstellationVisibility();
}

// ВИДИМОСТЬ ЛИНИЙ

function updateConstellationVisibility() {
    if (!constellationOverlay || !activeConstellation || !aladin) {
        return;
    }

    constellationOverlay.show();
}

// УБРАТЬ СОЗВЕЗДИЕ

function clearConstellation() {
    activeConstellation = null;

    if (constellationOverlay) {
        constellationOverlay.removeAll();
        constellationOverlay.hide();
    }
}

// ПОЛУЧИТЬ ЗАМЕТКУ К ОБЪЕКТУ

async function getObjectNote(objectType, objectName) {
    try {
        const response = await fetch("/notes");
        const result = await response.json();

        if (!result.success || !result.notes) {
            return null;
        }

        const note = result.notes.find(function(item) {
            return (
                item.object_type === objectType &&
                item.object_name === objectName
            );
        });

        return note || null;
    } catch (error) {
        console.error("Ошибка получения заметки:", error);
        return null;
    }
}

// КАРТОЧКА ЗВЕЗДЫ

async function showStarCard(star) {
    const card = document.getElementById('info-card');

    document.getElementById('card-title').textContent = star.name;
    document.getElementById('card-description').textContent = star.description;

    document.getElementById('card-details').innerHTML = `
        <strong>Координаты:</strong>
        <br>
        ${star.coordinates}
        <br><br>
        <strong>Расстояние от Земли:</strong>
        <br>
        ${star.distance}
        <br><br>
        <div class="object-note-container">
            Загрузка заметки...
        </div>
    `;

    card.classList.add('visible');
    positionStarCard(star);

    const note = await getObjectNote('star', star.name);
    const details = document.getElementById('card-details');

    if (!details) {
        return;
    }

    const noteContainer = details.querySelector('.object-note-container');

    if (!noteContainer) {
        return;
    }

    if (note) {
        noteContainer.innerHTML = `
            <div class="object-note">
                <strong>📝 Моя заметка:</strong>
                <div class="object-note-text">
                    ${escapeHtml(note.text)}
                </div>
                <button
                    class="add-object-note"
                    onclick="deleteObjectNote(${note.id})"
                >
                    Удалить заметку
                </button>
            </div>
        `;
    } else if (window.currentUsername) {
        noteContainer.innerHTML = `
            <button
                class="add-object-note"
                onclick="openObjectNote('star', '${escapeHtml(star.name)}')"
            >
                Добавить заметку
            </button>
        `;
    } else {
        noteContainer.innerHTML = "";
    }

    positionStarCard(star);
}

// ПОЗИЦИЯ КАРТОЧКИ ЗВЕЗДЫ

function positionStarCard(star) {
    if (!aladin) {
        return;
    }

    const card = document.getElementById('info-card');
    const pixel = aladin.world2pix(star.ra * 15, star.dec);

    if (!pixel) {
        return;
    }

    const main = document.querySelector('main');
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const mainWidth = main.clientWidth;
    const mainHeight = main.clientHeight;

    let left = pixel[0] + 25;
    let top = pixel[1] - cardHeight / 2;

    if (left + cardWidth > mainWidth - 15) {
        left = pixel[0] - cardWidth - 25;
    }

    if (top < 15) {
        top = 15;
    }

    if (top + cardHeight > mainHeight - 15) {
        top = mainHeight - cardHeight - 15;
    }

    const panel = document.querySelector('.side-panel');

    if (panel) {
        const panelWidth = panel.offsetWidth + 30;

        if (left < panelWidth && pixel[0] < panelWidth) {
            left = panelWidth;
        }
    }

    card.style.right = 'auto';
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
}

// КАРТОЧКА СОЗВЕЗДИЯ

async function showConstellationCard(constellationName) {
    const constellation = constellationData[constellationName];

    if (!constellation) {
        return;
    }

    const card = document.getElementById('info-card');

    card.style.left = 'auto';
    card.style.right = '25px';
    card.style.top = '25px';

    document.getElementById('card-title').textContent = constellationName;
    document.getElementById('card-description').textContent = 'Созвездие';

    let html = `
        <div class="constellation-list-title">
            Звёзды созвездия:
        </div>
        <div class="constellation-stars">
    `;

    constellation.stars.forEach(function(starName) {
        html += `
            <a
                href="#"
                class="constellation-star-link"
                data-star="${escapeHtml(starName)}"
                onclick="openConstellationStar(event, this)"
            >
                ${escapeHtml(starName)}
            </a>
        `;
    });

    html += `
        </div>
        <div class="object-note-container">
            Загрузка заметки...
        </div>
    `;

    document.getElementById('card-details').innerHTML = html;
    card.classList.add('visible');

    const note = await getObjectNote(
        'constellation',
        constellationName
    );

    const details = document.getElementById('card-details');

    if (!details) {
        return;
    }

    const noteContainer = details.querySelector('.object-note-container');

    if (!noteContainer) {
        return;
    }

    if (note) {
        noteContainer.innerHTML = `
            <div class="object-note">
                <strong>📝 Моя заметка:</strong>
                <div class="object-note-text">
                    ${escapeHtml(note.text)}
                </div>
                <button
                    class="add-object-note"
                    onclick="deleteObjectNote(${note.id})"
                >
                    Удалить заметку
                </button>
            </div>
        `;
    } else if (window.currentUsername) {
        noteContainer.innerHTML = `
            <button
                class="add-object-note"
                onclick="openObjectNote('constellation', '${escapeHtml(constellationName)}')"
            >
                Добавить заметку
            </button>
        `;
    } else {
        noteContainer.innerHTML = "";
    }
}

// ЗАЩИТА HTML

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ЗВЕЗДА ИЗ КАРТОЧКИ

function openConstellationStar(event, element) {
    event.preventDefault();

    const starName = element.dataset.star;
    goToStarFromConstellation(starName);
}

// ЗАКРЫТЬ КАРТОЧКУ

function closeCard() {
    document.getElementById('info-card').classList.remove('visible');
}

// ВЫБРАТЬ КНОПКУ

function selectButton(button) {
    document.querySelectorAll('.object-button').forEach(function(item) {
        item.classList.remove('selected');
    });

    if (button) {
        button.classList.add('selected');
    }
}

// ПОИСК

function normalizeSearchText(text) {
    return String(text).toLowerCase().replace(/\s+/g, '');
}

// ОТКРЫТЬ / ЗАКРЫТЬ ПОИСК

function toggleSearch() {
    const wrapper = document.getElementById('search-wrapper');
    const input = document.getElementById('search-input');
    const error = document.getElementById('search-error');
    const result = document.getElementById('search-result');

    if (wrapper.classList.contains('active')) {
        wrapper.classList.remove('active');
        error.classList.remove('visible');
        return;
    }

    wrapper.classList.add('active');
    error.classList.remove('visible');
    result.classList.remove('visible');
    input.value = '';
    input.focus();
}

// КНОПКА ПОИСКА

document.querySelector(".search-button").addEventListener("click", function() {
    const wrapper = document.getElementById("search-wrapper");
    const input = document.getElementById("search-input");

    if (!wrapper.classList.contains("active")) {
        toggleSearch();
        input.focus();
        return;
    }

    if (input.value.trim()) {
        performSearch();
    }
});

// ENTER В ПОИСКЕ

function handleSearchKey(event) {
    if (event.key !== 'Enter') {
        return;
    }

    event.preventDefault();
    performSearch();
}

// ВЫПОЛНИТЬ ПОИСК

function performSearch() {
    const input = document.getElementById('search-input');
    const wrapper = document.getElementById('search-wrapper');
    const error = document.getElementById('search-error');
    const result = document.getElementById('search-result');
    const searchText = normalizeSearchText(input.value);

    error.classList.remove('visible');
    result.classList.remove('visible');

    if (!searchText) {
        error.classList.add('visible');
        return;
    }

    // ИЩЕМ СОЗВЕЗДИЕ

    let foundConstellation = null;

    for (const constellationName in constellationData) {
        if (normalizeSearchText(constellationName) === searchText) {
            foundConstellation = constellationName;
            break;
        }
    }

    if (foundConstellation) {
        searchSelectConstellation(foundConstellation);
        wrapper.classList.remove('active');
        result.textContent = foundConstellation;
        result.classList.add('visible');
        return;
    }

    // ИЩЕМ ЗВЕЗДУ

    const foundStar = starData.find(function(star) {
        return normalizeSearchText(star.name) === searchText;
    });

    if (foundStar) {
        searchSelectStar(foundStar);
        wrapper.classList.remove('active');
        result.textContent = foundStar.name;
        result.classList.add('visible');
        return;
    }

    // НЕ НАШЛИ

    error.classList.add('visible');
}

// ПОИСК ЗВЕЗДЫ

function searchSelectStar(star) {
    if (!aladin) {
        return;
    }

    if (activeConstellation) {
        const constellation = constellationData[activeConstellation];

        if (!constellation.stars.includes(star.name)) {
            clearConstellation();
        }
    }

    aladin.gotoRaDec(star.ra * 15, star.dec);
    aladin.setFov(2);

    highlightStar(star);
    showStarCard(star);
}

// ПОИСК СОЗВЕЗДИЯ

function searchSelectConstellation(constellationName) {
    if (!aladin) {
        return;
    }

    const constellation = constellationData[constellationName];

    if (!constellation) {
        return;
    }

    activeConstellation = constellationName;
    highlightCatalog.removeAll();

    aladin.gotoRaDec(constellation.ra * 15, constellation.dec);
    aladin.setFov(25);

    drawConstellation(constellationName);
    showConstellationCard(constellationName);
}

// СВОРАЧИВАНИЕ КАТАЛОГА

function toggleCatalogSection(button) {
    const content = button.nextElementSibling;
    const isOpen = content.classList.contains('open');

    content.classList.toggle('open');
    button.classList.toggle('open');

    const symbol = button.querySelector('span');

    if (symbol) {
        symbol.textContent = isOpen ? '+' : '−';
    }
}

// ВХОД И РЕГИСТРАЦИЯ

function openAuthCard() {
    document.getElementById("auth-overlay").style.display = "flex";
    showLogin();
}

function closeAuthCard() {
    document.getElementById("auth-overlay").style.display = "none";
}

function showLogin() {
    document.getElementById("login-form").classList.remove("hidden");
    document.getElementById("register-form").classList.add("hidden");
    document.getElementById("auth-title").textContent = "Вход";
    document.getElementById("switch-text").textContent = "Нет аккаунта?";
    document.getElementById("switch-button").textContent = "Регистрация";
    document.getElementById("switch-button").onclick = showRegister;
}

function showRegister() {
    document.getElementById("login-form").classList.add("hidden");
    document.getElementById("register-form").classList.remove("hidden");
    document.getElementById("auth-title").textContent = "Регистрация";
    document.getElementById("switch-text").textContent = "Уже есть аккаунт?";
    document.getElementById("switch-button").textContent = "Войти";
    document.getElementById("switch-button").onclick = showLogin;
}

// ВХОД

document.getElementById("login-form").addEventListener(
    "submit",
    async function(event) {
        event.preventDefault();

        const formData = new FormData(this);

        const response = await fetch("/login", {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        const error = document.getElementById("login-error");

        if (result.success) {
            closeAuthCard();
            location.reload();
        } else {
            error.textContent = result.error;
        }
    }
);

// РЕГИСТРАЦИЯ

document.getElementById("register-form").addEventListener(
    "submit",
    async function(event) {
        event.preventDefault();

        const formData = new FormData(this);

        const response = await fetch("/register", {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        const error = document.getElementById("register-error");

        if (result.success) {
            closeAuthCard();
            location.reload();
        } else {
            error.textContent = result.error;
        }
    }
);

// МОИ ЗАМЕТКИ

function openNotesCard() {
    const overlay = document.getElementById("notes-overlay");

    if (!overlay) {
        return;
    }

    overlay.style.display = "flex";
    loadNotes();
}

function closeNotesCard() {
    const overlay = document.getElementById("notes-overlay");

    if (!overlay) {
        return;
    }

    overlay.style.display = "none";
}

// ЗАГРУЗКА ЗАМЕТОК

async function loadNotes() {
    const list = document.getElementById("notes-list");

    if (!list) {
        return;
    }

    list.innerHTML = "Загрузка...";

    try {
        const response = await fetch("/notes");
        const result = await response.json();

        if (!result.success) {
            list.innerHTML = result.error || "Не удалось загрузить заметки";
            return;
        }

        if (result.notes.length === 0) {
            list.innerHTML = `
                <div class="no-notes">
                    У вас пока нет заметок.
                </div>
            `;
            return;
        }

        list.innerHTML = "";

        result.notes.forEach(function(note) {
            const noteElement = document.createElement("div");
            noteElement.className = "note-item";

            let objectInfo = "";

            if (note.object_type && note.object_name) {
                if (note.object_type === "star") {
                    objectInfo = `
                        <div class="note-object">
                            ⭐ ${escapeHtml(note.object_name)}
                        </div>
                    `;
                } else {
                    objectInfo = `
                        <div class="note-object">
                            ✦ ${escapeHtml(note.object_name)}
                        </div>
                    `;
                }
            }

            noteElement.innerHTML = `
                ${objectInfo}
                <div class="note-text">
                    ${escapeHtml(note.text)}
                </div>
                <button
                    class="note-delete"
                    onclick="deleteNote(${note.id})"
                >
                    ×
                </button>
            `;

            list.appendChild(noteElement);
        });
    } catch (error) {
        console.error("Ошибка загрузки заметок:", error);
        list.innerHTML = "Не удалось загрузить заметки.";
    }
}

// ДОБАВЛЕНИЕ ОБЫЧНОЙ ЗАМЕТКИ

const noteForm = document.getElementById("note-form");

if (noteForm) {
    noteForm.addEventListener(
        "submit",
        async function(event) {
            event.preventDefault();

            const textarea = document.getElementById("note-text");
            const text = textarea.value.trim();

            if (!text) {
                return;
            }

            const formData = new FormData();
            formData.append("text", text);

            try {
                const response = await fetch("/notes", {
                    method: "POST",
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    textarea.value = "";
                    loadNotes();
                } else {
                    alert(result.error);
                }
            } catch (error) {
                console.error("Ошибка добавления заметки:", error);
            }
        }
    );
}

// УДАЛЕНИЕ ЗАМЕТКИ

async function deleteNote(noteId) {
    try {
        const response = await fetch(
            `/notes/delete/${noteId}`,
            { method: "POST" }
        );

        const result = await response.json();

        if (result.success) {
            loadNotes();
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error("Ошибка удаления заметки:", error);
    }
}

// ЗАМЕТКА К ОБЪЕКТУ

let currentNoteObjectType = null;
let currentNoteObjectName = null;

// ОТКРЫТЬ ОКНО ЗАМЕТКИ

function openObjectNote(objectType, objectName) {
    if (!window.currentUsername) {
        openAuthCard();
        return;
    }

    currentNoteObjectType = objectType;
    currentNoteObjectName = objectName;

    const overlay = document.getElementById("object-note-overlay");
    const title = document.getElementById("object-note-title");
    const textarea = document.getElementById("object-note-text");
    const error = document.getElementById("object-note-error");

    if (!overlay) {
        return;
    }

    if (objectType === "star") {
        title.textContent = "Заметка к звезде: " + objectName;
    } else {
        title.textContent = "Заметка к созвездию: " + objectName;
    }

    textarea.value = "";
    error.textContent = "";
    overlay.style.display = "flex";
    textarea.focus();
}

// ЗАКРЫТЬ ОКНО ЗАМЕТКИ

function closeObjectNote() {
    const overlay = document.getElementById("object-note-overlay");

    if (!overlay) {
        return;
    }

    overlay.style.display = "none";
}

// СОХРАНИТЬ ЗАМЕТКУ К ОБЪЕКТУ

async function saveObjectNote() {
    if (!window.currentUsername) {
        closeObjectNote();
        openAuthCard();
        return;
    }

    const textarea = document.getElementById("object-note-text");
    const error = document.getElementById("object-note-error");
    const text = textarea.value.trim();

    if (!text) {
        error.textContent = "Введите текст заметки";
        return;
    }

    const formData = new FormData();
    formData.append("text", text);
    formData.append("object_type", currentNoteObjectType);
    formData.append("object_name", currentNoteObjectName);

    try {
        const response = await fetch("/notes", {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            closeObjectNote();

            // ОБНОВЛЯЕМ ТЕКУЩУЮ КАРТОЧКУ

            if (currentNoteObjectType === "star") {
                const star = findStar(currentNoteObjectName);

                if (star) {
                    showStarCard(star);
                }
            } else {
                showConstellationCard(currentNoteObjectName);
            }

            // ОБНОВЛЯЕМ СПИСОК ЗАМЕТОК

            loadNotes();
        } else {
            error.textContent = result.error;
        }
    } catch (e) {
        console.error("Ошибка сохранения заметки:", e);
        error.textContent = "Не удалось сохранить заметку";
    }
}

// УДАЛИТЬ ЗАМЕТКУ К ОБЪЕКТУ

async function deleteObjectNote(noteId) {
    if (!window.currentUsername) {
        return;
    }

    try {
        const response = await fetch(
            `/notes/delete/${noteId}`,
            { method: "POST" }
        );

        const result = await response.json();

        if (!result.success) {
            alert(result.error);
            return;
        }

        // ПОСЛЕ УДАЛЕНИЯ ОБНОВЛЯЕМ КАРТОЧКУ

        if (currentNoteObjectType === "star") {
            const star = findStar(currentNoteObjectName);

            if (star) {
                showStarCard(star);
            }
        } else if (currentNoteObjectType === "constellation") {
            showConstellationCard(currentNoteObjectName);
        }

        loadNotes();
    } catch (error) {
        console.error("Ошибка удаления заметки:", error);
    }
}
