#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_project_context.py
الأداة الهندسية الشاملة لدمج وتلخيص أي برنامج أو موقع ويب في ملف سياقي واحد (full-project-context.txt)
مناسب للإرسال المباشر للذكاء الاصطناعي لقراءة المعمارية والأكواد بدقة 100%.
"""

import os
import re
import json
from pathlib import Path
from datetime import datetime

# ==============================================================================
# 1. إعدادات الفلترة والملفات المستهدفة
# ==============================================================================
OUTPUT_FILENAME = "full-project-context.txt"

# المجلدات التي يتم تجاهلها تماماً لمنع تضخم الملف
IGNORED_DIRS = {
    "node_modules", ".git", "__pycache__", "dist", "build", "out",
    ".gherbi_time_machine", ".vscode", ".idea", "coverage", "backups",
    "vendor", "venv", ".venv", "env"
}

# امتدادات الملفات البرمجية التي نقرؤها
ALLOWED_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".mjs", ".cjs", ".ts", ".tsx",
    ".jsx", ".json", ".py", ".sql", ".md", ".sh", ".bat"
}

# ملفات المكتبات الجاهزة أو المصغرة التي نتجنب نسخ كودها الداخلي الطويل
SKIP_MINIFIED_FILES = {
    "tailwind.min.js", "chart.umd.min.js", "package-lock.json",
    "yarn.lock", "pnpm-lock.yaml", "svg-icons.js", "fonts.css",
    "material-symbols.css", "v4-ready-context.txt", OUTPUT_FILENAME
}

# الحد الأقصى لحجم الملف العادي ليُنسخ بالكامل (بالبايت) — فوق هذا الحجم يُطبق المستخرج الذكي
MAX_FULL_FILE_BYTES = 250 * 1024  # 180 KB


def is_ignored_file(file_path: Path) -> bool:
    name = file_path.name
    if name in SKIP_MINIFIED_FILES:
        return True
    if name.endswith(".min.js") or name.endswith(".min.css") or name.endswith(".map"):
        return True
    if ".bak" in name or name.startswith("~$"):
        return True
    # تجاهل سكربتات التثبيت المؤقتة إذا كان مخرجاتها موجودة في gherbi-*.js
    if name.startswith(("apply-v", "fix-v", "fix-part", "fix-all", "stage1-", "stage2-", "stage3-")):
        return True
    return False


# ==============================================================================
# 2. توليد شجرة المشروع الهيكليـة (Project Directory Tree)
# ==============================================================================
def generate_project_tree(root_dir: Path) -> str:
    lines = [f"📁 {root_dir.name}/"]

    def walk_dir(current_path: Path, prefix: str = ""):
        try:
            entries = sorted(
                list(current_path.iterdir()),
                key=lambda x: (not x.is_dir(), x.name.lower())
            )
        except PermissionError:
            return

        filtered = []
        for entry in entries:
            if entry.is_dir():
                if entry.name not in IGNORED_DIRS and not entry.name.startswith("."):
                    filtered.append(entry)
            else:
                if not is_ignored_file(entry) and (entry.suffix.lower() in ALLOWED_EXTENSIONS or entry.suffix.lower() in {".db", ".sqlite", ".sqlite3"}):
                    filtered.append(entry)

        for idx, entry in enumerate(filtered):
            is_last = idx == len(filtered) - 1
            connector = "└── " if is_last else "├── "
            if entry.is_dir():
                lines.append(f"{prefix}{connector}📂 {entry.name}/")
                extension_prefix = "    " if is_last else "│   "
                walk_dir(entry, prefix + extension_prefix)
            else:
                size_kb = entry.stat().st_size / 1024.0
                lines.append(f"{prefix}{connector}📄 {entry.name} ({size_kb:.1f} KB)")

    walk_dir(root_dir)
    return "\n".join(lines)


# ==============================================================================
# 3. تحليل index.html لاستخراج السكربتات المربوطة بالترتيب الفعلي
# ==============================================================================
def extract_active_html_links(root_dir: Path) -> str:
    index_path = root_dir / "index.html"
    if not index_path.exists():
        return "لا يوجد ملف index.html في الجذر."

    content = index_path.read_text(encoding="utf-8", errors="replace")
    scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', content, flags=re.IGNORECASE)
    styles = re.findall(r'<link[^>]+href=["\']([^"\']+)["\']', content, flags=re.IGNORECASE)

    out = ["--- [ملفات CSS المربوطة في index.html] ---"]
    for i, s in enumerate(styles, 1):
        out.append(f"  {i}. {s}")

    out.append("\n--- [ملفات JavaScript المربوطة في index.html بالترتيب التنفيذي] ---")
    for i, sc in enumerate(scripts, 1):
        clean_name = sc.replace("./", "")
        exists_flag = "✅ موجود" if (root_dir / clean_name).exists() else "❌ مفقود!"
        out.append(f"  {i}. {sc}  [{exists_flag}]")

    return "\n".join(out)


# ==============================================================================
# 4. المعالج الذكي للملفات الضخمة جداً (مثل renderer-rc-100.js أو styles.css)
# ==============================================================================
def summarize_giant_file(file_path: Path, content: str) -> str:
    lines = content.splitlines()
    total_lines = len(lines)

    # أ) إذا كان ملف CSS طويلاً: نأخذ أول 150 سطراً + آخر 550 سطراً (حيث توجد جميع إضافاتنا وتعديلاتنا)
    if file_path.suffix.lower() == ".css":
        if total_lines <= 800:
            return content
        head = "\n".join(lines[:150])
        tail = "\n".join(lines[-550:])
        return (
            f"/* [ملف CSS كبير ({total_lines} سطراً) — تم عرض أول 150 سطراً وآخر 550 سطراً شاملة لكل التعديلات] */\n\n"
            f"{head}\n\n"
            f"/* ... [تم اختصار الأسطر الوسطى ({total_lines - 700} سطراً)] ... */\n\n"
            f"{tail}"
        )

    # ب) إذا كان ملف JavaScript عملاقاً (مثل renderer-rc-100.js):
    # نستخرج قائمة الدوال + الدوال الحيوية للكاشير والمخزن والباركود
    func_matches = re.findall(
        r'(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(|([a-zA-Z0-9_]+)\s*:\s*(?:async\s*)?function\s*\(|([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{',
        content
    )
    func_names = []
    for m in func_matches:
        fn = m[0] or m[1] or m[2]
        if fn and fn not in {"if", "for", "while", "switch", "catch", "function"} and fn not in func_names:
            func_names.append(fn)

    important_targets = [
        "recalcCart", "recalcAndRenderCart", "renderCartItems", "renderCartTabs",
        "addProductToCart", "updateCartItemQty", "updateCartItemPrice",
        "closeCartTab", "newCartTab", "holdCurrentCart", "openDraftsModal",
        "openProductModal", "saveProduct", "handleBarcodeScan",
        "openCheckoutModal", "submitSale", "instantConfirmAndCheckout",
        "openCustomerModal", "saveCustomer", "renderAnalyticsView",
        "openPosScaleModal", "loadSaleIntoPosForEdit"
    ]

    extracted_snippets = []
    for target in important_targets:
        idx = content.find(target)
        if idx != -1:
            start = max(0, idx - 80)
            end = min(len(content), idx + 1500)
            extracted_snippets.append(f"// === [مقتطف الدالة: {target}] ===\n{content[start:end]}\n")

    head_part = "\n".join(lines[:120])
    tail_part = "\n".join(lines[-150:])

    return (
        f"// [ملف ضخم جداً ({total_lines} سطراً | {len(content)/1024:.1f} KB)]\n"
        f"// إجمالي الدوال المكتشفة ({len(func_names)}): {', '.join(func_names[:120])}...\n\n"
        f"// --- [بداية الملف (أول 120 سطراً)] ---\n{head_part}\n\n"
        f"// --- [أهم الدوال المحورية المستخرجة من داخل الملف] ---\n"
        + "\n".join(extracted_snippets) +
        f"\n// --- [نهاية الملف (آخر 150 سطراً)] ---\n{tail_part}"
    )


# ==============================================================================
# 5. تجميع وترتيب كافة ملفات المشروع في ملف واحد
# ==============================================================================
def collect_and_bundle_project(root_dir: Path):
    output_parts = []
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. الترويسة العامة
    output_parts.append("======================================================================")
    output_parts.append(f"📦 GHERBI.AI PROJECT FULL CONTEXT SNAPSHOT")
    output_parts.append(f"🕒 تاريخ التوليد: {now_str}")
    output_parts.append(f"📍 المسار الأساسي: {root_dir.resolve()}")
    output_parts.append("======================================================================\n")

    # 2. شجرة الملفات
    output_parts.append("==================== 1. PROJECT DIRECTORY TREE ====================")
    output_parts.append(generate_project_tree(root_dir))
    output_parts.append("\n")

    # 3. ترتيب السكربتات النشطة في index.html
    output_parts.append("==================== 2. ACTIVE SCRIPTS IN INDEX.HTML ====================")
    output_parts.append(extract_active_html_links(root_dir))
    output_parts.append("\n")

    # 4. جمع كل الملفات القابلة للقراءة وترتيبها حسب الأهمية
    all_files = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # تعديل dirnames في مكانها لتجاهل المجلدات غير المرغوبة
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS and not d.startswith(".")]

        for fname in filenames:
            fpath = Path(dirpath) / fname
            if is_ignored_file(fpath):
                continue
            if fpath.suffix.lower() not in ALLOWED_EXTENSIONS:
                continue
            if fpath.name == "export_project_context.py":
                continue
            all_files.append(fpath)

    # ترتيب ذكي: ملفات الجذر الأساسية أولاً، ثم إضافات gherbi-*، ثم المجلدات الفرعية
    def sort_priority(p: Path):
        rel = p.relative_to(root_dir).as_posix()
        name = p.name.lower()
        if name == "package.json":
            return (0, rel)
        if name == "index.html":
            return (1, rel)
        if name == "styles.css":
            return (2, rel)
        if name in {"db-write-queue.js", "database.js", "server.js", "main.js", "preload.js"}:
            return (3, rel)
        if name.startswith("gherbi-") or name == "kiosk-client.html":
            return (4, rel)
        if "/" not in rel:
            return (5, rel)
        return (6, rel)

    all_files.sort(key=sort_priority)

    # 5. قراءة ودمج محتوى كل ملف
    for fpath in all_files:
        rel_path = fpath.relative_to(root_dir).as_posix()
        size_bytes = fpath.stat().st_size
        try:
            content = fpath.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            content = f"<< خطأ في قراءة الملف: {e} >>"

        output_parts.append(f"\n==================== FILE: {rel_path} ({size_bytes / 1024:.1f} KB) ====================")

        if size_bytes > MAX_FULL_FILE_BYTES or fpath.name == "styles.css":
            output_parts.append(summarize_giant_file(fpath, content))
        else:
            output_parts.append(content)

    final_text = "\n".join(output_parts)
    out_path = root_dir / OUTPUT_FILENAME
    out_path.write_text(final_text, encoding="utf-8")

    total_kb = out_path.stat().st_size / 1024.0
    print("======================================================================")
    print(f"✅ تم دمج ملفات المشروع بنجاح في ملف واحد: {OUTPUT_FILENAME}")
    print(f"📊 عدد الملفات المدمجة: {len(all_files)} ملفاً")
    print(f"📦 حجم الملف النهائي الجاهز للرفع: {total_kb:.1f} KB ({total_kb/1024:.2f} MB)")
    print("======================================================================")
    print(f"👈 الآن قم برفع وإرسال الملف ({OUTPUT_FILENAME}) في المحادثة!")


if __name__ == "__main__":
    current_folder = Path(__file__).resolve().parent
    target_dir = current_folder / "Gherbi_Ai_POS_Clean" if (current_folder / "Gherbi_Ai_POS_Clean").exists() else current_folder
    collect_and_bundle_project(target_dir)