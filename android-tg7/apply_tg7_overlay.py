#!/usr/bin/env python3
"""
Applies TG7 Editor rebrand (com.tg7.editor, TG7 Editor) and Black & Neon Red
gamer theme overlays cleanly onto the cloned LibreCuts Android project.
"""
import os
import re
import shutil
import sys
import xml.etree.ElementTree as ET


def update_gradle_application_id(build_dir: str) -> None:
    candidates = [
        os.path.join(build_dir, "app", "build.gradle.kts"),
        os.path.join(build_dir, "app", "build.gradle"),
    ]
    for path in candidates:
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        # Replace applicationId while leaving namespace untouched so R imports stay valid
        content = re.sub(
            r'(applicationId\s*=?\s*["\'])[^"\']+(["\'])',
            r'\1com.tg7.editor\2',
            content,
        )
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[TG7] Updated applicationId to com.tg7.editor in {path}")


def update_strings_xml(build_dir: str) -> None:
    strings_path = os.path.join(build_dir, "app", "src", "main", "res", "values", "strings.xml")
    if not os.path.exists(strings_path):
        return
    tree = ET.parse(strings_path)
    root = tree.getroot()
    updated = False
    for elem in root.findall("string"):
        if elem.attrib.get("name") == "app_name":
            elem.text = "TG7 Editor"
            updated = True
    if not updated:
        el = ET.SubElement(root, "string", {"name": "app_name"})
        el.text = "TG7 Editor"
    tree.write(strings_path, encoding="utf-8", xml_declaration=True)
    print(f"[TG7] Updated app_name to TG7 Editor in {strings_path}")


def update_manifest(build_dir: str) -> None:
    manifest_path = os.path.join(build_dir, "app", "src", "main", "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        return
    with open(manifest_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Ensure label points to @string/app_name and hardware acceleration + largeHeap are enabled
    content = re.sub(r'android:label="[^"]*"', 'android:label="@string/app_name"', content, count=1)
    if 'android:largeHeap=' not in content:
        content = content.replace('<application', '<application\n        android:largeHeap="true"', 1)
    if 'android:hardwareAccelerated=' not in content:
        content = content.replace('<application', '<application\n        android:hardwareAccelerated="true"', 1)

    # Make any FileProvider authority dynamic so com.tg7.editor doesn't collide
    content = re.sub(
        r'android:authorities="[^"]*\.fileprovider"',
        'android:authorities="${applicationId}.fileprovider"',
        content,
    )
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[TG7] Patched AndroidManifest.xml at {manifest_path}")


def install_theme_resources(build_dir: str, overlay_dir: str) -> None:
    res_values = os.path.join(build_dir, "app", "src", "main", "res", "values")
    res_drawable = os.path.join(build_dir, "app", "src", "main", "res", "drawable")
    os.makedirs(res_values, exist_ok=True)
    os.makedirs(res_drawable, exist_ok=True)

    shutil.copy2(os.path.join(overlay_dir, "colors.xml"), os.path.join(res_values, "tg7_colors.xml"))
    shutil.copy2(os.path.join(overlay_dir, "themes.xml"), os.path.join(res_values, "tg7_themes.xml"))
    shutil.copy2(
        os.path.join(overlay_dir, "bg_tg7_neon_button.xml"),
        os.path.join(res_drawable, "bg_tg7_neon_button.xml"),
    )
    shutil.copy2(
        os.path.join(overlay_dir, "bg_tg7_timeline_active.xml"),
        os.path.join(res_drawable, "bg_tg7_timeline_active.xml"),
    )
    print("[TG7] Installed Black & Neon Red XML colors, themes, and drawables")


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: apply_tg7_overlay.py <librecuts_dir> <overlay_dir>")
        sys.exit(1)

    build_dir = sys.argv[1]
    overlay_dir = sys.argv[2]

    update_gradle_application_id(build_dir)
    update_strings_xml(build_dir)
    update_manifest(build_dir)
    install_theme_resources(build_dir, overlay_dir)


if __name__ == "__main__":
    main()
