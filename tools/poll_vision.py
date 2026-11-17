"""One-shot vision poll: try each live candidate once; if a real description
comes back, review all 4 screenshots and write /tmp/vowlight-vision-review.txt.
Silent (no output) when nothing works, so cron stays quiet.
"""
from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

GW = "http://127.0.0.1:20128/v1"
GKEY = os.environ["HERMES_CUSTOM_CARTETHYIA_LOCAL_API_KEY"]
TIP = "https://tiprouter.my.id/v1"
TKEY = os.environ["HERMES_CUSTOM_TIPROUTER_MY_ID_API_KEY"]
DIR = "/home/ubuntu/makefun-btc/game-entry/screenshots"
OUT = "/tmp/vowlight-vision-review.txt"

CANDIDATES = [
    (TIP, "gemini-3.8-flash", TKEY),
    (GW, "bansosai-app/gemini-3.8-flash", GKEY),
]

IMAGES = [
    ("1-play.jpg", "This is the PLAY frame of an arena game. Review it as a judge: genre, what is happening, every entity and where, HUD elements (labels/positions/readability), colour palette, and one honest, specific critique of visual quality or legibility."),
    ("2-title.jpg", "This is the TITLE screen. Is the game title readable and stylish? What text/controls show and where? Is it appealing when shrunk small? One honest critique."),
    ("3-victory.jpg", "This is the VICTORY screen. What headline and stats show, are they legible/readable at small size, does it look finished and rewarding? One critique."),
    ("4-defeat.jpg", "This is the DEFEAT screen. Same questions as victory: headline, stats, restart prompt, legibility, polish. One critique."),
]


def ask(base, model, key, path, q):
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    body = json.dumps({"model": model, "messages": [{"role": "user", "content": [
        {"type": "text", "text": q},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64}},
    ]}], "max_tokens": 2400}).encode()
    req = urllib.request.Request(base + "/chat/completions", data=body, headers={
        "Authorization": "Bearer " + key, "Content-Type": "application/json"})
    try:
        return (json.load(urllib.request.urlopen(req, timeout=120))["choices"][0]["message"].get("content") or "").strip()
    except urllib.error.HTTPError:
        return ""
    except Exception:
        return ""


def real(ans):
    if not ans:
        return False
    low = ans.lower()
    return not ("no image" in low or "cannot see" in low or "attached" in low)


def main():
    chosen = None
    for base, model, key in CANDIDATES:
        try:
            ans = ask(base, model, key, os.path.join(DIR, "1-play.jpg"), "one sentence: what is in this image?")
        except Exception:
            ans = ""
        if real(ans):
            chosen = (base, model, key)
            break

    if not chosen:
        return  # silent: nothing works yet

    base, model, key = chosen
    lines = ["# VISION REVIEW — via %s (%s)\n" % (model, base)]
    for name, q in IMAGES:
        ans = ""
        for _ in range(2):
            ans = ask(base, model, key, os.path.join(DIR, name), q)
            if real(ans):
                break
            time.sleep(6)
        lines.append("===== %s =====" % name)
        lines.append(ans)
        lines.append("")
        time.sleep(5)
    open(OUT, "w").write("\n".join(lines))
    # Emit the actual review so a no_agent cron delivers it verbatim.
    sys.stdout.write("\n".join(lines))


if __name__ == "__main__":
    main()