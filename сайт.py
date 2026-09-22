from flask import Flask, render_template, request, redirect, url_for, session
import os
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "astronomy-secret-key")


def get_db_path():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "users.db")


def init_db():
    conn = sqlite3.connect(get_db_path())
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            object_type TEXT,
            object_name TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    conn.commit()
    conn.close()


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/register", methods=["POST"])
def register():
    username = request.form["username"].strip()
    password = request.form["password"]
    password_repeat = request.form["password_repeat"]

    if password != password_repeat:
        return {"success": False, "error": "Пароли не совпадают"}

    if len(username) < 3:
        return {"success": False, "error": "Логин должен содержать минимум 3 символа"}

    if len(password) < 4:
        return {"success": False, "error": "Пароль должен содержать минимум 4 символа"}

    conn = sqlite3.connect(get_db_path())

    try:
        password_hash = generate_password_hash(password)

        conn.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (username, password_hash)
        )
        conn.commit()

    except sqlite3.IntegrityError:
        conn.close()
        return {"success": False, "error": "Такой логин уже занят"}

    conn.close()

    session["username"] = username
    return {"success": True, "username": username}


@app.route("/login", methods=["POST"])
def login():
    username = request.form["username"].strip()
    password = request.form["password"]

    conn = sqlite3.connect(get_db_path())

    user = conn.execute(
        "SELECT username, password FROM users WHERE username = ?",
        (username,)
    ).fetchone()

    conn.close()

    if user is None or not check_password_hash(user[1], password):
        return {"success": False, "error": "Неверный логин или пароль"}

    session["username"] = user[0]

    return {"success": True, "username": user[0]}


@app.route("/notes", methods=["GET", "POST"])
def notes():
    if "username" not in session:
        return {"success": False, "error": "Необходимо войти в аккаунт"}

    conn = sqlite3.connect(get_db_path())

    user = conn.execute(
        "SELECT id FROM users WHERE username = ?",
        (session["username"],)
    ).fetchone()

    if user is None:
        conn.close()
        return {"success": False, "error": "Пользователь не найден"}

    user_id = user[0]

    if request.method == "POST":
        text = request.form.get("text", "").strip()
        object_type = request.form.get("object_type")
        object_name = request.form.get("object_name")

        if not text:
            conn.close()
            return {"success": False, "error": "Заметка не может быть пустой"}

        conn.execute(
            """
            INSERT INTO notes (user_id, text, object_type, object_name)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, text, object_type, object_name)
        )

        conn.commit()
        conn.close()

        return {"success": True}

    notes_list = conn.execute(
        """
        SELECT id, text, object_type, object_name
        FROM notes
        WHERE user_id = ?
        ORDER BY id DESC
        """,
        (user_id,)
    ).fetchall()

    conn.close()

    notes_result = [
        {
            "id": note[0],
            "text": note[1],
            "object_type": note[2],
            "object_name": note[3]
        }
        for note in notes_list
    ]

    return {"success": True, "notes": notes_result}


@app.route("/notes/delete/<int:note_id>", methods=["POST"])
def delete_note(note_id):
    if "username" not in session:
        return {"success": False, "error": "Необходимо войти в аккаунт"}

    conn = sqlite3.connect(get_db_path())

    user = conn.execute(
        "SELECT id FROM users WHERE username = ?",
        (session["username"],)
    ).fetchone()

    if user is None:
        conn.close()
        return {"success": False, "error": "Пользователь не найден"}

    conn.execute(
        "DELETE FROM notes WHERE id = ? AND user_id = ?",
        (note_id, user[0])
    )

    conn.commit()
    conn.close()

    return {"success": True}


@app.route("/")
def index():
    return render_template("index.html", username=session.get("username"))


@app.route("/logout")
def logout():
    session.pop("username", None)
    return redirect(url_for("index"))


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)
