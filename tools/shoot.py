"""Capture a screenshot of a page through the already-running headless Chrome (CDP at :9222).

Usage:
    python3 shoot.py <url> <out.png> [width] [height] [--wait flag|ms]

Waits for window.__shotReady when --wait flag is given (the game's shot scenes set it),
otherwise waits the given milliseconds.
"""

from __future__ import annotations

import base64
import json
import sys
import time
import urllib.request

import websocket

CDP_HTTP = "http://127.0.0.1:9222"


class Session:
    def __init__(self) -> None:
        version = json.load(urllib.request.urlopen(CDP_HTTP + "/json/version", timeout=10))
        self.ws = websocket.create_connection(version["webSocketDebuggerUrl"], timeout=60)
        self.next_id = 0

    def send(self, method: str, params: dict | None = None, session_id: str | None = None) -> dict:
        self.next_id += 1
        message = {"id": self.next_id, "method": method, "params": params or {}}
        if session_id:
            message["sessionId"] = session_id
        self.ws.send(json.dumps(message))
        while True:
            reply = json.loads(self.ws.recv())
            if reply.get("id") == self.next_id:
                if "error" in reply:
                    raise RuntimeError(f"{method}: {reply['error']}")
                return reply.get("result", {})


def capture(url: str, out: str, width: int, height: int, wait_ms: int, wait_flag: bool) -> None:
    session = Session()
    target = session.send("Target.createTarget", {"url": "about:blank"})["targetId"]
    attached = session.send("Target.attachToTarget", {"targetId": target, "flatten": True})
    sid = attached["sessionId"]
    try:
        session.send("Page.enable", {}, sid)
        session.send(
            "Emulation.setDeviceMetricsOverride",
            {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False},
            sid,
        )
        session.send("Page.navigate", {"url": url}, sid)
        deadline = time.time() + 25
        ready = False
        while time.time() < deadline:
            time.sleep(0.2)
            result = session.send(
                "Runtime.evaluate",
                {"expression": "Boolean(window.__shotReady)", "returnByValue": True},
                sid,
            )
            if result.get("result", {}).get("value") is True:
                ready = True
                break
        if wait_flag and not ready:
            raise RuntimeError("window.__shotReady never became true")
        time.sleep(wait_ms / 1000)
        shot = session.send("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}, sid)
        with open(out, "wb") as handle:
            handle.write(base64.b64decode(shot["data"]))
        print(f"wrote {out} (ready={ready})")
    finally:
        session.send("Target.closeTarget", {"targetId": target})


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    url, out = argv[1], argv[2]
    rest = argv[3:]
    wait_ms = 400
    wait_flag = False
    positional: list[str] = []
    index = 0
    while index < len(rest):
        if rest[index] == "--wait":
            mode = rest[index + 1] if len(rest) > index + 1 else "flag"
            if mode == "flag":
                wait_flag = True
            else:
                wait_ms = int(mode)
            index += 2
            continue
        positional.append(rest[index])
        index += 1
    width = int(positional[0]) if len(positional) > 0 else 1280
    height = int(positional[1]) if len(positional) > 1 else 720
    capture(url, out, width, height, wait_ms, wait_flag)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
