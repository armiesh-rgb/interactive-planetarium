let aladin = null;
let starCatalog = null;
let highlightCatalog = null;
let constellationOverlay = null;
let activeConstellation = null;

document.addEventListener("DOMContentLoaded", function() {
    initSearch();
    initAuth();
    initNotes();
});

// ПОИСК ЗВЕЗДЫ

function findStar(name) {
    return starData.find(function(star) {
        return star.name === name;
    });
}

// ИНИЦИАЛИЗАЦИЯ ALADIN

A.init.then(function() {
    aladin = A.aladin("#aladin-lite-div", {
        survey: "P/DSS2/color",
        projection: "TAN",
        fov: 60,
        cooFrame: "equatorial",
        showReticle: false,
        showZoomControl: true,
        showFullscreenControl: false,
        showLayersControl: false,
        showGotoControl: false,
        showCooGrid: false
    });

    const aladinElement = document.getElementById("aladin-lite-div");

    if (aladinElement) {
        aladinElement.addEventListener("click", function(event) {
            const target = event.target;

            if (
                target.closest(".aladin-fov") ||
                target.closest("canvas") ||
                target.tagName === "CANVAS"
            ) {
                const sidePanel = document.getElementById("side-panel");

                if (
                    sidePanel &&
                    sidePanel.classList.contains("mobile-open")
                ) {
                    sidePanel.classList.remove("mobile-open");
                }
            }
        });
    }

    // КАТАЛОГ ЗВЁЗД

    starCatalog = A.catalog({
        name: "Звёзды",
        sourceSize: 14,
        color: "#ffff00",
        shape: "circle",
        displayLabel: true,
        labelColumn: "name",
        labelColor: "#ffffff",
        labelFont: "14px sans-serif",

        onClick: function(source) {
            if (!source || !source.data || !source.data.name) {
                return;
            }

            const star = findStar(source.data.name);

            if (!star) {
                return;
            }

            if (activeConstellation) {
                const constellation =
                    constellationData[activeConstellation];

                if (
                    constellation &&
                    !constellation.stars.includes(star.name)
                ) {
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
        name: "Выделение",
        sourceSize: 30,
        color: "#ffffff",
        shape: "cross",
        displayLabel: false
    });

    aladin.addCatalog(highlightCatalog);

    // ЛИНИИ СОЗВЕЗДИЙ

    constellationOverlay = A.graphicOverlay({
        name: "Созвездия",
        color: "#ffffff",
        lineWidth: 3
    });

    aladin.addOverlay(constellationOverlay);
    constellationOverlay.hide();

    aladin.on("zoomChanged", function() {
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
        const constellation =
            constellationData[activeConstellation];

        if (
            constellation &&
            !constellation.stars.includes(starName)
        ) {
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
    const constellation =
        constellationData[constellationName];

    if (!constellation || !aladin) {
        return;
    }

    activeConstellation = constellationName;

    selectButton(button);

    if (highlightCatalog) {
        highlightCatalog.removeAll();
    }

    aladin.gotoRaDec(
        constellation.ra * 15,
        constellation.dec
    );

    aladin.setFov(25);

    drawConstellation(constellationName);
    showConstellationCard(constellationName);
}

// НАРИСОВАТЬ СОЗВЕЗДИЕ

function drawConstellation(constellationName) {
    if (!constellationOverlay) {
        return;
    }

    const constellation =
        constellationData[constellationName];

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
                color: "#ffffff",
                lineWidth: 3
            }
        );

        constellationOverlay.add(line);
    });

    constellationOverlay.show();
    updateConstellationVisibility();
}

// ВИДИМОСТЬ ЛИНИЙ

function updateConstellationVisibility() {
    if (
        !constellationOverlay ||
        !activeConstellation ||
        !aladin
    ) {
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

        return result.notes.find(function(item) {
            return (
                item.object_type === objectType &&
                item.object_name === objectName
            );
        }) || null;

    } catch (error) {
        console.error(
            "Ошибка получения заметки:",
            error
        );

        return null;
    }
}

// КАРТОЧКА ЗВЕЗДЫ

async function showStarCard(star) {
    const card = document.getElementById("info-card");
    const title = document.getElementById("card-title");
    const description =
        document.getElementById("card-description");
    const details =
        document.getElementById("card-details");

    if (!card || !title || !description || !details) {
        return;
    }

    title.textContent = star.name;
    description.textContent = star.description;

    details.innerHTML = `
        <strong>Координаты:</strong>
        <br>
        ${star.coordinates}
        <br><br>
        <strong>Расстояние от Земли:</strong>
        <br>
        ${star.distance}
    `;

    card.classList.add("visible");

    positionStarCard(star);

    // ЗАМЕТКИ ЗАГРУЖАЮТСЯ ТОЛЬКО ДЛЯ АВТОРИЗОВАННЫХ

    if (!window.currentUsername) {
        return;
    }

    const note = await getObjectNote(
        "star",
        star.name
    );

    if (!document.getElementById("card-details")) {
        return;
    }

    if (note) {
        details.innerHTML += `
            <br>
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
    } else {
        details.innerHTML += `
            <br>
            <button
                class="add-object-note"
                onclick="openObjectNote(
                    'star',
                    '${escapeHtml(star.name)}'
                )"
            >
                Добавить заметку
            </button>
        `;
    }
}

// ПОЗИЦИЯ КАРТОЧКИ ЗВЕЗДЫ

function positionStarCard(star) {
    if (!aladin) {
        return;
    }

    const card = document.getElementById("info-card");
    const main = document.querySelector("main");

    if (!card || !main) {
        return;
    }

    const pixel = aladin.world2pix(
        star.ra * 15,
        star.dec
    );

    if (!pixel) {
        return;
    }

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

    const panel = document.querySelector(".side-panel");

    if (panel) {
        const panelWidth =
            panel.offsetWidth + 30;

        if (
            left < panelWidth &&
            pixel[0] < panelWidth
        ) {
            left = panelWidth;
        }
    }

    card.style.right = "auto";
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
}

// КАРТОЧКА СОЗВЕЗДИЯ

async function showConstellationCard(constellationName) {
    const constellation =
        constellationData[constellationName];

    if (!constellation) {
        return;
    }

    const card =
        document.getElementById("info-card");

    const title =
        document.getElementById("card-title");

    const description =
        document.getElementById("card-description");

    const details =
        document.getElementById("card-details");

    if (
        !card ||
        !title ||
        !description ||
        !details
    ) {
        return;
    }

    card.style.left = "auto";
    card.style.right = "25px";
    card.style.top = "25px";

    title.textContent = constellationName;
    description.textContent = "Созвездие";

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
    `;

    details.innerHTML = html;
    card.classList.add("visible");

    // ЗАМЕТКИ ТОЛЬКО ДЛЯ АВТОРИЗОВАННЫХ

    if (!window.currentUsername) {
        return;
    }

    const note = await getObjectNote(
        "constellation",
        constellationName
    );

    if (!document.getElementById("card-details")) {
        return;
    }

    if (note) {
        details.innerHTML += `
            <br>
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
    } else {
        details.innerHTML += `
            <br>
            <button
                class="add-object-note"
                onclick="openObjectNote(
                    'constellation',
                    '${escapeHtml(constellationName)}'
                )"
            >
                Добавить заметку
            </button>
        `;
    }
}

// ЗАЩИТА HTML

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ЗВЕЗДА ИЗ КАРТОЧКИ

function openConstellationStar(event, element) {
    event.preventDefault();

    const starName = element.dataset.star;

    goToStarFromConstellation(starName);
}

// ЗАКРЫТЬ КАРТОЧКУ

function closeCard() {
    const card =
        document.getElementById("info-card");

    if (card) {
        card.classList.remove("visible");
    }
}

// ВЫБРАТЬ КНОПКУ

function selectButton(button) {
    document
        .querySelectorAll(".object-button")
        .forEach(function(item) {
            item.classList.remove("selected");
        });

    if (button) {
        button.classList.add("selected");
    }
}

// ПОИСК

function normalizeSearchText(text) {
    return String(text)
        .toLowerCase()
        .replace(/\s+/g, "");
}

// ИНИЦИАЛИЗАЦИЯ ПОИСКА

function initSearch() {
    const form =
        document.getElementById("search-form");

    const button =
        document.querySelector(".search-button");

    const wrapper =
        document.getElementById("search-wrapper");

    const input =
        document.getElementById("search-input");

    const error =
        document.getElementById("search-error");

    const result =
        document.getElementById("search-result");

    if (
        !form ||
        !button ||
        !wrapper ||
        !input ||
        !error ||
        !result
    ) {
        return;
    }

    // УБИРАЕМ СТАРЫЙ INLINE onclick
    // ЧТОБЫ КНОПКА НЕ СРАБАТЫВАЛА ДВАЖДЫ

    button.onclick = null;

    // ОТПРАВКА ПОИСКА

    form.addEventListener(
        "submit",
        function(event) {
            event.preventDefault();
            performSearch();
        }
    );

    // КНОПКА ПОИСКА

    button.addEventListener(
        "click",
        function(event) {
            event.preventDefault();

            if (wrapper.classList.contains("active")) {
                if (input.value.trim()) {
                    performSearch();
                } else {
                    closeSearch();
                }

                return;
            }

            openSearch();
        }
    );
}

// ОТКРЫТЬ ПОИСК

function openSearch() {
    const wrapper =
        document.getElementById("search-wrapper");

    const input =
        document.getElementById("search-input");

    const error =
        document.getElementById("search-error");

    const result =
        document.getElementById("search-result");

    if (!wrapper || !input || !error || !result) {
        return;
    }

    wrapper.classList.add("active");
    error.classList.remove("visible");

    if (result.classList.contains("visible")) {
        input.value = result.textContent;
    } else {
        input.value = "";
    }

    setTimeout(function() {
        input.focus();
    }, 0);
}

// ЗАКРЫТЬ ПОИСК

function closeSearch() {
    const wrapper =
        document.getElementById("search-wrapper");

    const input =
        document.getElementById("search-input");

    const error =
        document.getElementById("search-error");

    const result =
        document.getElementById("search-result");

    if (!wrapper || !input || !error || !result) {
        return;
    }

    wrapper.classList.remove("active");
    error.classList.remove("visible");

    if (result.classList.contains("visible")) {
        input.value = result.textContent;
    }
}

// ОСТАВЛЯЕМ ЭТУ ФУНКЦИЮ ДЛЯ index.html

function toggleSearch() {
    const wrapper =
        document.getElementById("search-wrapper");

    if (!wrapper) {
        return;
    }

    if (wrapper.classList.contains("active")) {
        closeSearch();
    } else {
        openSearch();
    }
}

// ВЫПОЛНИТЬ ПОИСК

function performSearch() {
    const input =
        document.getElementById("search-input");

    const wrapper =
        document.getElementById("search-wrapper");

    const error =
        document.getElementById("search-error");

    const result =
        document.getElementById("search-result");

    if (
        !input ||
        !wrapper ||
        !error ||
        !result
    ) {
        return;
    }

    const searchText =
        normalizeSearchText(input.value);

    error.classList.remove("visible");

    // ПУСТОЙ ПОИСК

    if (!searchText) {
        closeSearch();
        return;
    }

    // ИЩЕМ СОЗВЕЗДИЕ

    let foundConstellation = null;

    for (
        const constellationName in constellationData
    ) {
        if (
            normalizeSearchText(constellationName) ===
            searchText
        ) {
            foundConstellation =
                constellationName;

            break;
        }
    }

    if (foundConstellation) {
        searchSelectConstellation(
            foundConstellation
        );

        closeSearch();

        result.textContent =
            foundConstellation;

        result.classList.add("visible");

        return;
    }

    // ИЩЕМ ЗВЕЗДУ

    const foundStar = starData.find(
        function(star) {
            return (
                normalizeSearchText(star.name) ===
                searchText
            );
        }
    );

    if (foundStar) {
        searchSelectStar(foundStar);

        closeSearch();

        result.textContent =
            foundStar.name;

        result.classList.add("visible");

        return;
    }

    // НЕ НАШЛИ

    error.classList.add("visible");
}

// ПОИСК ЗВЕЗДЫ

function searchSelectStar(star) {
    if (!aladin) {
        return;
    }

    if (activeConstellation) {
        const constellation =
            constellationData[activeConstellation];

        if (
            constellation &&
            !constellation.stars.includes(star.name)
        ) {
            clearConstellation();
        }
    }

    aladin.gotoRaDec(
        star.ra * 15,
        star.dec
    );

    aladin.setFov(2);

    highlightStar(star);
    showStarCard(star);
}

// ПОИСК СОЗВЕЗДИЯ

function searchSelectConstellation(
    constellationName
) {
    if (!aladin) {
        return;
    }

    const constellation =
        constellationData[constellationName];

    if (!constellation) {
        return;
    }

    activeConstellation =
        constellationName;

    if (highlightCatalog) {
        highlightCatalog.removeAll();
    }

    aladin.gotoRaDec(
        constellation.ra * 15,
        constellation.dec
    );

    aladin.setFov(25);

    drawConstellation(
        constellationName
    );

    showConstellationCard(
        constellationName
    );
}

// СВОРАЧИВАНИЕ КАТАЛОГА

function toggleCatalogSection(button) {
    const content =
        button.nextElementSibling;

    if (!content) {
        return;
    }

    const isOpen =
        content.classList.contains("open");

    content.classList.toggle("open");
    button.classList.toggle("open");

    const symbol =
        button.querySelector("span");

    if (symbol) {
        symbol.textContent =
            isOpen ? "+" : "−";
    }
}

// ИНИЦИАЛИЗАЦИЯ АВТОРИЗАЦИИ

function initAuth() {
    const loginForm =
        document.getElementById("login-form");

    const registerForm =
        document.getElementById("register-form");

    if (loginForm) {
        loginForm.addEventListener(
            "submit",
            async function(event) {
                event.preventDefault();

                const error =
                    document.getElementById(
                        "login-error"
                    );

                if (error) {
                    error.textContent = "";
                }

                const formData =
                    new FormData(loginForm);

                try {
                    const response =
                        await fetch("/login", {
                            method: "POST",
                            body: formData
                        });

                    const result =
                        await response.json();

                    if (result.success) {
                        closeAuthCard();
                        location.reload();
                    } else if (error) {
                        error.textContent =
                            result.error ||
                            "Неверный логин или пароль";
                    }

                } catch (error) {
                    console.error(
                        "Ошибка входа:",
                        error
                    );

                    if (error) {
                        error.textContent =
                            "Не удалось выполнить вход";
                    }
                }
            }
        );
    }

    if (registerForm) {
        registerForm.addEventListener(
            "submit",
            async function(event) {
                event.preventDefault();

                const error =
                    document.getElementById(
                        "register-error"
                    );

                if (error) {
                    error.textContent = "";
                }

                const formData =
                    new FormData(registerForm);

                try {
                    const response =
                        await fetch("/register", {
                            method: "POST",
                            body: formData
                        });

                    const result =
                        await response.json();

                    if (result.success) {
                        closeAuthCard();
                        location.reload();
                    } else if (error) {
                        error.textContent =
                            result.error ||
                            "Не удалось зарегистрироваться";
                    }

                } catch (error) {
                    console.error(
                        "Ошибка регистрации:",
                        error
                    );

                    if (error) {
                        error.textContent =
                            "Не удалось выполнить регистрацию";
                    }
                }
            }
        );
    }
}

// ВХОД И РЕГИСТРАЦИЯ

function openAuthCard() {
    const overlay =
        document.getElementById("auth-overlay");

    if (!overlay) {
        return;
    }

    overlay.style.display = "flex";
    showLogin();
}

function closeAuthCard() {
    const overlay =
        document.getElementById("auth-overlay");

    if (!overlay) {
        return;
    }

    overlay.style.display = "none";
}

function showLogin() {
    const loginForm =
        document.getElementById("login-form");

    const registerForm =
        document.getElementById("register-form");

    const title =
        document.getElementById("auth-title");

    const switchText =
        document.getElementById("switch-text");

    const switchButton =
        document.getElementById("switch-button");

    if (
        !loginForm ||
        !registerForm ||
        !title ||
        !switchText ||
        !switchButton
    ) {
        return;
    }

    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");

    title.textContent = "Вход";
    switchText.textContent = "Нет аккаунта?";
    switchButton.textContent = "Регистрация";

    switchButton.onclick =
        showRegister;
}

function showRegister() {
    const loginForm =
        document.getElementById("login-form");

    const registerForm =
        document.getElementById("register-form");

    const title =
        document.getElementById("auth-title");

    const switchText =
        document.getElementById("switch-text");

    const switchButton =
        document.getElementById("switch-button");

    if (
        !loginForm ||
        !registerForm ||
        !title ||
        !switchText ||
        !switchButton
    ) {
        return;
    }

    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");

    title.textContent = "Регистрация";
    switchText.textContent = "Уже есть аккаунт?";
    switchButton.textContent = "Войти";

    switchButton.onclick =
        showLogin;
}

// ИНИЦИАЛИЗАЦИЯ ЗАМЕТОК

function initNotes() {
    const noteForm =
        document.getElementById("note-form");

    if (!noteForm) {
        return;
    }

    noteForm.addEventListener(
        "submit",
        async function(event) {
            event.preventDefault();

            const textarea =
                document.getElementById(
                    "note-text"
                );

            if (!textarea) {
                return;
            }

            const text =
                textarea.value.trim();

            if (!text) {
                return;
            }

            const formData =
                new FormData();

            formData.append(
                "text",
                text
            );

            try {
                const response =
                    await fetch("/notes", {
                        method: "POST",
                        body: formData
                    });

                const result =
                    await response.json();

                if (result.success) {
                    textarea.value = "";
                    loadNotes();
                } else {
                    alert(result.error);
                }

            } catch (error) {
                console.error(
                    "Ошибка добавления заметки:",
                    error
                );
            }
        }
    );
}

// МОИ ЗАМЕТКИ

function openNotesCard() {
    const overlay =
        document.getElementById(
            "notes-overlay"
        );

    if (!overlay) {
        return;
    }

    overlay.style.display = "flex";
    loadNotes();
}

function closeNotesCard() {
    const overlay =
        document.getElementById(
            "notes-overlay"
        );

    if (!overlay) {
        return;
    }

    overlay.style.display = "none";
}

// ЗАГРУЗКА ЗАМЕТОК

async function loadNotes() {
    const list =
        document.getElementById(
            "notes-list"
        );

    if (!list) {
        return;
    }

    list.innerHTML = "Загрузка...";

    try {
        const response =
            await fetch("/notes");

        const result =
            await response.json();

        if (!result.success) {
            list.innerHTML =
                result.error ||
                "Не удалось загрузить заметки";

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

        result.notes.forEach(
            function(note) {
                const noteElement =
                    document.createElement(
                        "div"
                    );

                noteElement.className =
                    "note-item";

                let objectInfo = "";

                if (
                    note.object_type &&
                    note.object_name
                ) {
                    if (
                        note.object_type ===
                        "star"
                    ) {
                        objectInfo = `
                            <div class="note-object">
                                ⭐ ${escapeHtml(
                                    note.object_name
                                )}
                            </div>
                        `;
                    } else {
                        objectInfo = `
                            <div class="note-object">
                                ✦ ${escapeHtml(
                                    note.object_name
                                )}
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

                list.appendChild(
                    noteElement
                );
            }
        );

    } catch (error) {
        console.error(
            "Ошибка загрузки заметок:",
            error
        );

        list.innerHTML =
            "Не удалось загрузить заметки.";
    }
}

// УДАЛЕНИЕ ЗАМЕТКИ

async function deleteNote(noteId) {
    try {
        const response =
            await fetch(
                `/notes/delete/${noteId}`,
                {
                    method: "POST"
                }
            );

        const result =
            await response.json();

        if (result.success) {
            loadNotes();
        } else {
            alert(result.error);
        }

    } catch (error) {
        console.error(
            "Ошибка удаления заметки:",
            error
        );
    }
}

// ЗАМЕТКА К ОБЪЕКТУ

let currentNoteObjectType = null;
let currentNoteObjectName = null;

// ОТКРЫТЬ ОКНО ЗАМЕТКИ

function openObjectNote(
    objectType,
    objectName
) {
    if (!window.currentUsername) {
        openAuthCard();
        return;
    }

    currentNoteObjectType =
        objectType;

    currentNoteObjectName =
        objectName;

    const overlay =
        document.getElementById(
            "object-note-overlay"
        );

    const title =
        document.getElementById(
            "object-note-title"
        );

    const textarea =
        document.getElementById(
            "object-note-text"
        );

    const error =
        document.getElementById(
            "object-note-error"
        );

    if (
        !overlay ||
        !title ||
        !textarea ||
        !error
    ) {
        return;
    }

    if (objectType === "star") {
        title.textContent =
            "Заметка к звезде: " +
            objectName;
    } else {
        title.textContent =
            "Заметка к созвездию: " +
            objectName;
    }

    textarea.value = "";
    error.textContent = "";

    overlay.style.display = "flex";
    textarea.focus();
}

// ЗАКРЫТЬ ОКНО ЗАМЕТКИ

function closeObjectNote() {
    const overlay =
        document.getElementById(
            "object-note-overlay"
        );

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

    const textarea =
        document.getElementById(
            "object-note-text"
        );

    const error =
        document.getElementById(
            "object-note-error"
        );

    if (!textarea || !error) {
        return;
    }

    const text =
        textarea.value.trim();

    if (!text) {
        error.textContent =
            "Введите текст заметки";

        return;
    }

    const formData =
        new FormData();

    formData.append(
        "text",
        text
    );

    formData.append(
        "object_type",
        currentNoteObjectType
    );

    formData.append(
        "object_name",
        currentNoteObjectName
    );

    try {
        const response =
            await fetch("/notes", {
                method: "POST",
                body: formData
            });

        const result =
            await response.json();

        if (result.success) {
            closeObjectNote();

            if (
                currentNoteObjectType ===
                "star"
            ) {
                const star =
                    findStar(
                        currentNoteObjectName
                    );

                if (star) {
                    showStarCard(star);
                }
            } else {
                showConstellationCard(
                    currentNoteObjectName
                );
            }

            loadNotes();

        } else {
            error.textContent =
                result.error;
        }

    } catch (e) {
        console.error(
            "Ошибка сохранения заметки:",
            e
        );

        error.textContent =
            "Не удалось сохранить заметку";
    }
}

// УДАЛИТЬ ЗАМЕТКУ К ОБЪЕКТУ

async function deleteObjectNote(noteId) {
    if (!window.currentUsername) {
        return;
    }

    try {
        const response =
            await fetch(
                `/notes/delete/${noteId}`,
                {
                    method: "POST"
                }
            );

        const result =
            await response.json();

        if (!result.success) {
            alert(result.error);
            return;
        }

        if (
            currentNoteObjectType ===
            "star"
        ) {
            const star =
                findStar(
                    currentNoteObjectName
                );

            if (star) {
                showStarCard(star);
            }

        } else if (
            currentNoteObjectType ===
            "constellation"
        ) {
            showConstellationCard(
                currentNoteObjectName
            );
        }

        loadNotes();

    } catch (error) {
        console.error(
            "Ошибка удаления заметки:",
            error
        );
    }
}
