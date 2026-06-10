"""
PDF → JSON extractor using Claude vision.
Usage: python scripts/extract_pdf.py <path-to-pdf> [output.json]

Resumes automatically if interrupted — just run again.
"""

import anthropic
import base64
import json
import os
import sys
import time
from pathlib import Path

PROMPT = """Extract all text from this D&D book page.
Return ONLY valid JSON (no markdown fences) with this structure:
{
  "chapter": "chapter title if visible on this page, else null",
  "section": "nearest section/heading title, else null",
  "content": "all body text, paragraphs separated by \\n\\n",
  "tables": ["any table content as plain text, one entry per table"],
  "page_number": page number as integer if visible, else null
}
Be accurate. If the page is mostly decorative art, return empty content string."""


def img_to_b64(page, scale: float = 2.0) -> str:
    import fitz
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat)
    return base64.standard_b64encode(pix.tobytes("png")).decode()


def parse_response(text: str) -> dict:
    text = text.strip()
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip().lstrip("json").strip()
            if part.startswith("{"):
                text = part
                break
    return json.loads(text)


def extract(pdf_path: str, output_path: str) -> None:
    try:
        import fitz
    except ImportError:
        print("Missing dependency. Run:  pip install pymupdf")
        sys.exit(1)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        # try loading from .env in project root
        env_file = Path(__file__).parent.parent / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("ANTHROPIC_API_KEY="):
                    api_key = line.split("=", 1)[1].strip().strip('"')
                    break
    if not api_key:
        print("ANTHROPIC_API_KEY not found. Set it in .env or environment.")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    doc = fitz.open(pdf_path)
    total = len(doc)

    # load existing progress
    data: dict[str, dict] = {}
    if os.path.exists(output_path):
        with open(output_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        print(f"Resuming — {len(data)}/{total} pages already done.")

    errors = 0
    for i in range(total):
        page_num = i + 1
        key = str(page_num)

        if key in data:
            print(f"  [{page_num:>3}/{total}] skip (cached)")
            continue

        print(f"  [{page_num:>3}/{total}] extracting...", end=" ", flush=True)

        try:
            img_b64 = img_to_b64(doc[i])

            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=2048,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": img_b64,
                            },
                        },
                        {"type": "text", "text": PROMPT},
                    ],
                }],
            )

            page_data = parse_response(response.content[0].text)
            data[key] = page_data
            print(f"ok — {page_data.get('section') or page_data.get('chapter') or '(no heading)'}")

        except json.JSONDecodeError as e:
            raw = response.content[0].text if "response" in dir() else "no response"
            data[key] = {"error": f"json parse: {e}", "raw": raw, "content": ""}
            print(f"json error")
            errors += 1
        except Exception as e:
            data[key] = {"error": str(e), "content": ""}
            print(f"error: {e}")
            errors += 1
            time.sleep(2)  # brief pause on error

        # save after every page
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nDone. {total} pages → {output_path}  (errors: {errors})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        pdf = r"C:\Users\It_Sadtawut\Downloads\Dungeon Master's Guide.pdf"
    else:
        pdf = sys.argv[1]

    out = sys.argv[2] if len(sys.argv) > 2 else Path(pdf).stem.lower().replace(" ", "-").replace("'", "") + ".json"
    out = str(Path(__file__).parent.parent / out)

    print(f"PDF : {pdf}")
    print(f"OUT : {out}")
    extract(pdf, out)
