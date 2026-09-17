import json
import re
import sys
from pathlib import Path
# 使い方: python add_page.py ComponentName "表示名"

def main():
    if len(sys.argv) != 3 or not re.fullmatch(r"[A-Z][A-Za-z0-9_$]*", sys.argv[1]):
        sys.exit('使い方: python add_page.py ComponentName "表示名"')
    name, label = sys.argv[1:]
    root = Path(__file__).resolve().parent
    if not any((root / "src/pages" / (name + ext)).is_file() for ext in (".jsx", ".js")):
        sys.exit(f"ページがありません: src/pages/{name}.jsx または {name}.js")

    app_path = root / "src/App.jsx"
    menu_path = root / "src/data/menuItems.js"
    # 改行コードを含め、既存部分はそのまま保つ。
    app = original_app = app_path.read_bytes().decode("utf-8")
    menu = original_menu = menu_path.read_bytes().decode("utf-8")
    app_nl = "\r\n" if "\r\n" in app else "\n"
    menu_nl = "\r\n" if "\r\n" in menu else "\n"
    page_import = re.search(
        rf"import\s+([\w$]+)\s+from\s+['\"]\./pages/{re.escape(name)}(?:\.jsx|\.js)?['\"];?", app
    )
    component = page_import[1] if page_import else name
    if not page_import:
        imports = list(re.finditer(r"^import .+;[\r\n]*", app, re.M))
        if not imports:
            sys.exit("App.jsx の import が見つかりません。変更しませんでした。")
        pos = imports[-1].end()
        app = app[:pos] + f"import {name} from './pages/{name}';{app_nl}" + app[pos:]

    routes = list(re.finditer(r"<Route\b[^\r\n]*", app))
    existing = next((r for r in routes if re.search(
        rf"element\s*=\s*\{{\s*<{re.escape(component)}\s*/>\s*\}}", r[0]
    )), None)
    url = "/" + name.lower()
    if existing:
        path = re.search(r"\bpath=['\"]([^'\"]*)['\"]", existing[0])
        # 既存ページの URL は変更しない。
        url = "/" + path[1].lstrip("/") if path else "/"
    else:
        if any(re.search(rf"\bpath=['\"]/?{re.escape(name.lower())}['\"]", r[0]) for r in routes):
            sys.exit(f"URL {url} は別のページで使用済みです。変更しませんでした。")
        anchor = re.search(r"^(\s*)<Route path=['\"]\*['\"]", app, re.M)
        if not anchor:
            sys.exit("App.jsx の末尾の Route が見つかりません。変更しませんでした。")
        pos = anchor.start()
        route = f'{anchor[1]}<Route path="{name.lower()}" element={{<{component} />}} />{app_nl}'
        app = app[:pos] + route + app[pos:]

    menu_array = re.search(r"export const menuItems = \[([\s\S]*?)\n\];", menu)
    if not menu_array:
        sys.exit("menuItems 配列が見つかりません。変更しませんでした。")
    if not re.search(rf"\bpath:\s*['\"]{re.escape(url)}['\"]", menu_array[1]):
        if re.search(rf"\bid:\s*['\"]{re.escape(name.lower())}['\"]", menu_array[1]):
            sys.exit("同じメニュー ID が使用済みです。変更しませんでした。")
        entry = (
            f"  {{ id: '{name.lower()}', label: {json.dumps(label, ensure_ascii=False)}, "
            f"icon: FileText, path: '{url}', category: 'ワークスペース' }},{menu_nl}"
        )
        pos = menu_array.end() - 2  # 配列を閉じる ]; の直前
        menu = menu[:pos] + entry + menu[pos:]
        icons = re.search(r"import\s*\{([^}]*)\}\s*from\s*['\"]lucide-react['\"];?", menu)
        if icons:
            if "FileText" not in [item.strip() for item in icons[1].split(",")]:
                names = icons[1].strip().rstrip(",")
                menu = menu[:icons.start(1)] + f" {names}, FileText " + menu[icons.end(1):]
        else:
            menu = f"import {{ FileText }} from 'lucide-react';{menu_nl}" + menu

    if app != original_app:
        app_path.write_bytes(app.encode("utf-8"))
    if menu != original_menu:
        menu_path.write_bytes(menu.encode("utf-8"))
    print("登録済みです。" if (app, menu) == (original_app, original_menu) else f"登録しました: {url}")


if __name__ == "__main__":
    try:
        main()
    except OSError as error:
        sys.exit(str(error))
