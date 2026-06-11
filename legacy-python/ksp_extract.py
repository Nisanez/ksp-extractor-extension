"""Extract KSP product info from an HTML fragment into a format suited for LLMs.

Usage:
    python ksp_extract.py                         # read HTML from clipboard (default)
    python ksp_extract.py input.html              # read from file
    python ksp_extract.py -                       # read from stdin
    python ksp_extract.py --format text           # compact text output

Tip: copy the product grid <div> in DevTools (right-click > Copy > Copy outerHTML),
then run the script with no args.

Output formats:
    json  - machine-readable list of products (default)
    text  - compact human/LLM-readable bullet list
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from typing import Optional

from bs4 import BeautifulSoup, Tag

KSP_BASE = "https://ksp.co.il"


@dataclass
class Product:
    name: str
    brand: Optional[str]
    sku: Optional[str]
    item_id: Optional[str]
    price_nis: Optional[int]
    eilat_price_nis: Optional[int]
    url: Optional[str]
    image_url: Optional[str]


def _price_to_int(text: str) -> Optional[int]:
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


def _abs_url(href: Optional[str]) -> Optional[str]:
    if not href:
        return None
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    return KSP_BASE + href


def _first_text(node: Optional[Tag]) -> Optional[str]:
    if node is None:
        return None
    text = node.get_text(" ", strip=True)
    return text or None


def parse_product(card: Tag) -> Optional[Product]:
    title_a = card.select_one("a.productTitle-0-3-341, a[class*='productTitle']")
    if title_a is None:
        return None

    name = _first_text(title_a) or ""
    url = _abs_url(title_a.get("href"))

    item_id = None
    if url:
        m = re.search(r"/item/(\d+)", url)
        if m:
            item_id = m.group(1)

    sku = None
    sku_wrap = card.select_one("[class*='skuWrapper']")
    if sku_wrap is not None:
        aria = sku_wrap.get("aria-label", "")
        m = re.search(r"(\d+)", aria)
        if m:
            sku = m.group(1)
        else:
            txt = sku_wrap.get_text(" ", strip=True)
            m = re.search(r"(\d{4,})", txt)
            if m:
                sku = m.group(1)

    brand = None
    brand_img = card.select_one("[class*='brandWrapper'] img")
    if brand_img is not None:
        brand = brand_img.get("alt") or None

    price_nis = None
    price_node = card.select_one("[class*='regularPriceWrapper'] [aria-label^='מחיר המוצר']")
    if price_node is not None:
        aria = price_node.get("aria-label", "")
        m = re.search(r"([\d,]+)", aria)
        if m:
            price_nis = _price_to_int(m.group(1))
    if price_nis is None:
        any_price = card.select_one("[class*='currentPrice']")
        if any_price is not None:
            price_nis = _price_to_int(any_price.get_text(" ", strip=True))

    eilat_price_nis = None
    eilat_wrap = card.select_one("[class*='eilatPriceWrapper']")
    if eilat_wrap is not None:
        eilat_node = eilat_wrap.select_one("[class*='currentPrice']")
        if eilat_node is not None:
            eilat_price_nis = _price_to_int(eilat_node.get_text(" ", strip=True))

    image_url = None
    img = card.select_one("[class*='imageWrapper'] img")
    if img is not None:
        src = img.get("src") or img.get("data-src")
        image_url = _abs_url(src) if src else None

    return Product(
        name=name,
        brand=brand,
        sku=sku,
        item_id=item_id,
        price_nis=price_nis,
        eilat_price_nis=eilat_price_nis,
        url=url,
        image_url=image_url,
    )


_CARD_CLASS_RE = re.compile(r"(^|\s)product-0-3-\d+(\s|$)")


def extract(html: str) -> list[Product]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.find_all(
        "div",
        class_=lambda c: bool(c and _CARD_CLASS_RE.search(c)),
    )
    products: list[Product] = []
    for card in cards:
        p = parse_product(card)
        if p and p.name:
            products.append(p)
    return products


def format_text(products: list[Product]) -> str:
    lines = [f"Found {len(products)} products:\n"]
    for i, p in enumerate(products, 1):
        lines.append(f"{i}. {p.name}")
        meta = []
        if p.brand:
            meta.append(f"brand: {p.brand}")
        if p.sku:
            meta.append(f"sku: {p.sku}")
        if p.price_nis is not None:
            meta.append(f"price: ₪{p.price_nis:,}")
        if p.eilat_price_nis is not None:
            meta.append(f"eilat: ₪{p.eilat_price_nis:,}")
        if meta:
            lines.append("   " + " | ".join(meta))
        if p.url:
            lines.append(f"   {p.url}")
    return "\n".join(lines)


def read_clipboard() -> str:
    try:
        import tkinter
    except ImportError as e:
        raise SystemExit(f"clipboard read needs tkinter: {e}")
    root = tkinter.Tk()
    root.withdraw()
    try:
        return root.clipboard_get()
    except tkinter.TclError:
        raise SystemExit("clipboard is empty or doesn't contain text")
    finally:
        root.destroy()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "input",
        nargs="?",
        help="HTML file path, '-' for stdin, or omit to read from clipboard",
    )
    ap.add_argument("--format", choices=["json", "text"], default="json")
    args = ap.parse_args()

    if args.input is None:
        html = read_clipboard()
    elif args.input == "-":
        html = sys.stdin.read()
    else:
        with open(args.input, "r", encoding="utf-8") as f:
            html = f.read()

    products = extract(html)

    if args.format == "json":
        print(json.dumps([asdict(p) for p in products], ensure_ascii=False, indent=2))
    else:
        print(format_text(products))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
