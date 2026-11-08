"""matte.py in.mp4 out_alpha.mp4 [downsample] — RobustVideoMatting (ONNX) → greyscale alpha video, same size/fps."""
import sys, subprocess, numpy as np, onnxruntime as ort, json
src, out = sys.argv[1], sys.argv[2]; ds = float(sys.argv[3]) if len(sys.argv) > 3 else 0.25
M = "/tmp/claude-0/-home-user-TOMERZOR/57893ae3-acda-505c-b44d-0e56fba7243b/scratchpad/models/rvm_mobilenetv3_fp32.onnx"
pr = json.loads(subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries","stream=width,height,r_frame_rate","-of","json",src],capture_output=True,text=True).stdout)["streams"][0]
W, H, fps = pr["width"], pr["height"], pr["r_frame_rate"]
dec = subprocess.Popen(["ffmpeg","-v","error","-i",src,"-f","rawvideo","-pix_fmt","rgb24","-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","gray","-s",f"{W}x{H}","-r",fps,"-i","-","-c:v","libx264","-crf","12","-pix_fmt","yuv420p",out], stdin=subprocess.PIPE)
so = ort.SessionOptions(); so.intra_op_num_threads = 4
sess = ort.InferenceSession(M, so, providers=["CPUExecutionProvider"])
rec = [np.zeros([1,1,1,1], np.float32)] * 4; dsr = np.array([ds], np.float32); n = 0
while True:
    b = dec.stdout.read(W * H * 3)
    if len(b) < W * H * 3: break
    x = np.frombuffer(b, np.uint8).reshape(H, W, 3).transpose(2, 0, 1)[None].astype(np.float32) / 255
    fgr, pha, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": dsr})
    enc.stdin.write((np.clip(pha[0, 0], 0, 1) * 255).astype(np.uint8).tobytes()); n += 1
enc.stdin.close(); enc.wait(); print("frames", n)
