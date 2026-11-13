"""Look at audio without ears: the music's energy map, tempo and beat grid; a waveform+spectrogram sheet of SFX takes.

  python3 tools/analyze_audio.py music audio/src/music/take1.mp3 out.png
  python3 tools/analyze_audio.py takes audio/src/eleven out.png
"""
import sys, subprocess, pathlib, json
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt

def load(path, sr=22050):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy(), sr

def music(path, out):
    x, sr = load(path)
    hop = 512; n = 2048
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, (n // 2, n // 2)), n)[::hop] * np.hanning(n)
    S = np.abs(np.fft.rfft(frames, axis=1))
    flux = np.maximum(0, np.diff(np.log1p(S), axis=0)).sum(1); flux = np.r_[0, flux]
    flux = (flux - flux.mean()) / (flux.std() + 1e-9)
    fps = sr / hop
    rms = np.sqrt((frames ** 2).mean(1) + 1e-12); db = 20 * np.log10(rms + 1e-9)
    # tempo by autocorrelation of the onset envelope (60–180 BPM)
    ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
    lags = np.arange(len(ac)) / fps; ok = (lags > 60 / 180) & (lags < 60 / 60)
    lag = np.argmax(np.where(ok, ac, -1e9)); period = lag / fps; bpm = 60 / period
    # beat phase: the offset that collects the most onset strength
    best, phase = -1e9, 0
    for ph in np.arange(0, period, 1 / fps):
        idx = np.round((ph + np.arange(0, len(x) / sr, period)) * fps).astype(int); idx = idx[idx < len(flux)]
        s = flux[idx].sum()
        if s > best: best, phase = s, ph
    beats = np.arange(phase, len(x) / sr, period)
    t = np.arange(len(db)) / fps
    print(f"duration {len(x) / sr:.2f}s  tempo {bpm:.1f} BPM  period {period:.3f}s  first beat {phase:.3f}s")
    # energy per half second, and where it drops out
    step = int(fps * 0.5)
    em = [db[i:i + step].mean() for i in range(0, len(db), step)]
    print("energy (dB per 0.5 s):"); print(" ".join(f"{v:5.0f}" for v in em))
    quiet = [(round(float(t[i]), 2)) for i in range(1, len(db)) if db[i] < db.max() - 35 and db[i - 1] >= db.max() - 35]
    print("drops below -35 dB rel at:", quiet[:20])
    fig, ax = plt.subplots(2, 1, figsize=(18, 6), sharex=True)
    ax[0].plot(t, db, lw=0.7); ax[0].set_ylabel("dB")
    for b in beats: ax[0].axvline(b, color="r", alpha=0.15, lw=0.6)
    ax[1].plot(t, flux, lw=0.5); ax[1].set_xticks(np.arange(0, len(x) / sr, 1))
    for a in ax: a.grid(alpha=0.2)
    plt.tight_layout(); plt.savefig(out, dpi=80)
    json.dump({"bpm": bpm, "period": period, "phase": phase, "beats": [round(float(b), 4) for b in beats]}, open(str(out) + ".json", "w"))

def takes(folder, out):
    files = sorted(pathlib.Path(folder).glob("*.mp3"))
    cols = 6; rows = (len(files) + cols - 1) // cols
    fig, axes = plt.subplots(rows * 2, cols, figsize=(cols * 3.2, rows * 2.6))
    for i, f in enumerate(files):
        x, sr = load(f, 22050)
        r, c = (i // cols) * 2, i % cols
        t = np.arange(len(x)) / sr
        axes[r, c].plot(t, x, lw=0.4); axes[r, c].set_title(f.stem, fontsize=8); axes[r, c].set_ylim(-1, 1)
        pk = np.abs(x).max(); on = np.argmax(np.abs(x) > pk * 0.1) / sr
        e = np.convolve(x ** 2, np.ones(441) / 441, "same"); tail = np.argmax(e[::-1] > (pk ** 2) * 0.001); dur = (len(x) - tail) / sr - on
        axes[r, c].text(0.02, 0.85, f"pk {20*np.log10(pk+1e-9):.0f}dB on {on:.2f}s len {dur:.2f}s", transform=axes[r, c].transAxes, fontsize=6)
        axes[r + 1, c].specgram(x, NFFT=512, Fs=sr, noverlap=384, cmap="magma"); axes[r + 1, c].set_ylim(0, 11000)
    for a in axes.flat: a.tick_params(labelsize=5)
    plt.tight_layout(); plt.savefig(out, dpi=70)

if __name__ == "__main__":
    {"music": music, "takes": takes}[sys.argv[1]](sys.argv[2], sys.argv[3])
