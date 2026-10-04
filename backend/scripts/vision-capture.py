#!/usr/bin/env python3
"""
DeepSee UVC camera helper (Phase 6E).
Requires: Python + opencv-python (cv2). No other dependencies.

Commands (JSON request per line on stdin is NOT used — simple argv CLI):
  python vision-capture.py discover [--max-index 3]
      Probes DirectShow indices 0..max-index, prints JSON list to stdout:
      [{"index": 0, "name": "...", "width": 640, "height": 480, "fps": 30.0}]

  python vision-capture.py capture --device 0 [--width 1280] [--height 720]
      Captures ONE frame, writes raw JPEG bytes to stdout, prints a JSON
      summary line to stderr: {"ok": true, "width": .., "height": ..,
      "bytes": .., "captureMs": ..}

Exit codes: 0 ok · 2 no OpenCV · 3 no camera / capture failed · 4 bad args.
Device names on Windows come from DirectShow when resolvable, else
"Integrated Camera #<index>". Nothing is fabricated: absent hardware yields
exit 3, never synthetic pixels.
"""
import json
import sys
import time

try:
    import cv2
except ImportError:
    print(json.dumps({"ok": False, "error": "OPENCV_NOT_INSTALLED"}))
    sys.exit(2)


def open_camera(device: str):
    try:
        index = int(device)
        cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        return cap, f"Camera index {index}"
    except (ValueError, TypeError):
        pass
    # Named device: try every index and match backend-reported name.
    for index in range(4):
        cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap.release()
            continue
        name = cap.getBackendName() if hasattr(cap, "getBackendName") else "DirectShow"
        cap.release()
        if device.lower() in str(name).lower() or device == str(index):
            found = cv2.VideoCapture(index, cv2.CAP_DSHOW)
            return found, str(name)
    return None, None


def cmd_discover(max_index: int):
    devices = []
    for index in range(max_index + 1):
        cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap.release()
            continue
        # Warm up + read backend properties (measured where available).
        time.sleep(0.4)
        ok, _ = cap.read()
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
        cap.release()
        if not ok:
            continue
        devices.append({
            "index": index,
            "name": f"DirectShow device {index}",
            "width": width or None,
            "height": height or None,
            "fps": fps if fps and fps > 0 else None,
        })
    print(json.dumps(devices))
    return 0


def cmd_capture(device: str, width: int, height: int, timeout_s: float):
    cap, name = open_camera(device)
    if cap is None or not cap.isOpened():
        print(json.dumps({"ok": False, "error": "CAMERA_DEVICE_NOT_FOUND"}))
        return 3
    try:
        if width > 0:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        if height > 0:
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        # Discard warm-up frames (auto-exposure settles), then capture.
        t0 = time.perf_counter()
        frame = None
        ok = False
        for _ in range(10):
            if time.perf_counter() - t0 > timeout_s:
                break
            ok, frame = cap.read()
            if ok and frame is not None:
                break
        if not ok or frame is None:
            print(json.dumps({"ok": False, "error": "CAPTURE_FAILED"}))
            return 3
        actual_h, actual_w = frame.shape[0], frame.shape[1]
        ok_enc, jpeg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        if not ok_enc:
            print(json.dumps({"ok": False, "error": "ENCODE_FAILED"}))
            return 3
        capture_ms = round((time.perf_counter() - t0) * 1000, 1)
        sys.stdout.buffer.write(jpeg.tobytes())
        sys.stdout.buffer.flush()
        print(json.dumps({
            "ok": True, "width": int(actual_w), "height": int(actual_h),
            "bytes": int(len(jpeg)), "captureMs": capture_ms, "device": name,
        }), file=sys.stderr, flush=True)
        return 0
    finally:
        cap.release()


def main(argv):
    if len(argv) < 2 or argv[1] not in ("discover", "capture"):
        print("usage: vision-capture.py discover [--max-index N] | capture --device D [--width W] [--height H] [--timeout S]",
              file=sys.stderr)
        return 4
    args = argv[2:]
    if argv[1] == "discover":
        max_index = 3
        if "--max-index" in args:
            try:
                max_index = int(args[args.index("--max-index") + 1])
            except (ValueError, IndexError):
                return 4
        return cmd_discover(max(0, min(max_index, 9)))
    device, width, height, timeout = "0", 0, 0, 10.0
    try:
        if "--device" in args:
            device = args[args.index("--device") + 1]
        if "--width" in args:
            width = int(args[args.index("--width") + 1])
        if "--height" in args:
            height = int(args[args.index("--height") + 1])
        if "--timeout" in args:
            timeout = float(args[args.index("--timeout") + 1])
    except (ValueError, IndexError):
        return 4
    return cmd_capture(device, width, height, timeout)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
