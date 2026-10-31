import os

# ==============================
# الإعدادات
# ==============================

OUTPUT_FILE = "project_structuregherbiaiposCLEANnew2.md"
MAX_DEPTH = 3                 # أقصى عمق للشجرة
MAX_FILE_SIZE = 200 * 1024    # 200KB

IGNORE_DIRS = {
    ".git",
    ".github",
    ".idea",
    ".vscode",
    "node_modules",
    "fet-engine",
    "__pycache__",
    ".venv",
    "venv",
    "env",
    "build",
    "dist",
    "release",
    "out",
    "target",
    "bin",
    "obj",
    "coverage",
    ".next"
}

IGNORE_FILES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    ".gitignore",
    ".DS_Store",
    "Thumbs.db"
}

IGNORE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif",
    ".svg", ".ico",
    ".pdf",
    ".zip", ".rar", ".7z",
    ".mp3", ".mp4", ".wav",
    ".exe", ".dll",
    ".pyc",
    ".log"
}

CODE_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".json",
    ".css",
    ".html",
    ".md",
    ".sql"
}


def language(ext):
    ext = ext.lower()

    if ext == ".py":
        return "python"

    if ext in [".js", ".jsx"]:
        return "javascript"

    if ext in [".ts", ".tsx"]:
        return "typescript"

    if ext == ".css":
        return "css"

    if ext == ".html":
        return "html"

    if ext == ".json":
        return "json"

    if ext == ".sql":
        return "sql"

    if ext == ".md":
        return "markdown"

    return "text"


def generate(directory):

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:

        ##################################################
        # Project Tree
        ##################################################

        f.write("# Project Structure\n\n")
        f.write("```text\n")

        for root, dirs, files in os.walk(directory):

            dirs[:] = sorted([d for d in dirs if d not in IGNORE_DIRS])

            level = os.path.relpath(root, directory).count(os.sep)

            if level > MAX_DEPTH:
                dirs.clear()
                continue

            indent = "    " * level

            folder = os.path.basename(root)

            if root == directory:
                f.write(f"{os.path.basename(directory)}/\n")
            else:
                f.write(f"{indent}├── {folder}/\n")

            sub = "    " * (level + 1)

            for file in sorted(files):

                if file in IGNORE_FILES:
                    continue

                ext = os.path.splitext(file)[1].lower()

                if ext in IGNORE_EXTENSIONS:
                    continue

                f.write(f"{sub}├── {file}\n")

        f.write("```\n\n")

        ##################################################
        # Source Code
        ##################################################

        f.write("\n---\n\n")
        f.write("# Source Code\n\n")

        for root, dirs, files in os.walk(directory):

            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

            for file in sorted(files):

                if file in IGNORE_FILES:
                    continue

                ext = os.path.splitext(file)[1].lower()

                if ext not in CODE_EXTENSIONS:
                    continue

                path = os.path.join(root, file)

                if os.path.getsize(path) > MAX_FILE_SIZE:
                    continue

                relative = os.path.relpath(path, directory)

                f.write(f"## `{relative}`\n\n")

                f.write(f"```{language(ext)}\n")

                try:
                    with open(path, "r", encoding="utf-8") as code:
                        f.write(code.read())
                except UnicodeDecodeError:
                    f.write("// Unable to read file (encoding).")
                except Exception as e:
                    f.write(f"// {e}")

                f.write("\n```\n\n---\n\n")

    print("Done!")
    print("Output:", OUTPUT_FILE)


if __name__ == "__main__":
    generate(os.getcwd())