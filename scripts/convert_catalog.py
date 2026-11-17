#!/usr/bin/env python3
"""アプリのカタログから、Web公開用のカタログと画像を作る。

アプリ側のリポジトリは読むだけで、書き込みは行わない。
出力はこのリポジトリの assets/catalog/ 配下にだけ作る。

使い方:
    python3 scripts/convert_catalog.py [アプリの arloupe ディレクトリ]

既定の入力元は ../ARLoupe/arloupe。Pillow が必要。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from PIL import Image

CARD_WIDTH = 480
DETAIL_WIDTH = 960
WEBP_QUALITY = 80

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_IMAGE_DIR = REPO_ROOT / "assets" / "catalog" / "images"
OUTPUT_CATALOG = REPO_ROOT / "assets" / "catalog" / "catalog.json"

FAMILY_PATTERN = re.compile(r"^(\S+科)")


def resolve_source_root(arguments: list[str]) -> Path:
    if arguments:
        return Path(arguments[0]).expanduser().resolve()
    return (REPO_ROOT.parent / "ARLoupe" / "arloupe").resolve()


def extract_family(classification: str | None) -> str | None:
    if not classification:
        return None
    normalized = classification.replace("　", " ").strip()
    matched = FAMILY_PATTERN.match(normalized)
    return matched.group(1) if matched else None


def find_primary_image(insect: dict) -> dict | None:
    images = insect.get("images") or []
    primary_id = insect.get("primaryImageId")
    for image in images:
        if image.get("imageId") == primary_id:
            return image
    return images[0] if images else None


def write_web_image(source_path: Path, destination: Path, width: int) -> None:
    with Image.open(source_path) as opened:
        converted = opened.convert("RGB")
        if converted.width > width:
            height = round(converted.height * width / converted.width)
            converted = converted.resize((width, height), Image.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        converted.save(destination, "WEBP", quality=WEBP_QUALITY, method=6)


def build_entry(insect: dict, source_root: Path) -> dict | None:
    japanese_name = (insect.get("names") or {}).get("ja")
    if not japanese_name:
        return None

    image = find_primary_image(insect)
    if not image or not image.get("assetPath"):
        return None

    source_path = source_root / image["assetPath"]
    if not source_path.exists():
        print(f"  画像が見つかりません: {insect['insectId']} ({image['assetPath']})")
        return None

    insect_id = insect["insectId"]
    card_name = f"{insect_id}-card.webp"
    detail_name = f"{insect_id}-detail.webp"
    write_web_image(source_path, OUTPUT_IMAGE_DIR / card_name, CARD_WIDTH)
    write_web_image(source_path, OUTPUT_IMAGE_DIR / detail_name, DETAIL_WIDTH)

    classification = insect.get("classificationJa") or None
    return {
        "id": insect_id,
        "name": japanese_name,
        "scientificName": insect.get("scientificName") or None,
        "classification": classification,
        "family": extract_family(classification),
        "basicInformation": [
            {"label": fact.get("label"), "value": fact.get("value")}
            for fact in (insect.get("basicInformation") or [])
            if fact.get("value")
        ],
        "featurePoints": [point for point in (insect.get("featurePoints") or []) if point],
        "similarSpeciesNote": insect.get("similarSpeciesNote") or None,
        "nameReviewedAt": insect.get("nameReviewedAt") or None,
        "image": {
            "card": f"assets/catalog/images/{card_name}",
            "detail": f"assets/catalog/images/{detail_name}",
            "credit": image.get("credit") or None,
            "license": image.get("license") or None,
            "sourceUrl": image.get("sourceUrl") or None,
        },
    }


def main() -> int:
    source_root = resolve_source_root(sys.argv[1:])
    catalog_path = source_root / "assets" / "catalog" / "insect_catalog.json"
    if not catalog_path.exists():
        print(f"アプリのカタログが見つかりません: {catalog_path}")
        return 1

    source_catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    insects = source_catalog.get("insects") or []
    print(f"読み込み: {catalog_path}（{len(insects)}件）")

    entries = []
    for insect in insects:
        entry = build_entry(insect, source_root)
        if entry:
            entries.append(entry)

    entries.sort(key=lambda entry: entry["name"])

    OUTPUT_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_CATALOG.write_text(
        json.dumps(
            {
                "sourceSchemaVersion": source_catalog.get("schemaVersion"),
                "sourceCatalogVersion": source_catalog.get("catalogVersion"),
                "cardImageWidth": CARD_WIDTH,
                "detailImageWidth": DETAIL_WIDTH,
                "insects": entries,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    with_family = sum(1 for entry in entries if entry["family"])
    print(f"書き出し: {OUTPUT_CATALOG.relative_to(REPO_ROOT)}（{len(entries)}件、うち科あり{with_family}件）")
    print(f"画像: {OUTPUT_IMAGE_DIR.relative_to(REPO_ROOT)}（{len(entries) * 2}枚）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
