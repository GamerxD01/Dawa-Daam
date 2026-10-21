import { useEffect, useRef, useState } from 'preact/hooks';
import type { Index } from '../match/search';
import type { Hit } from '../match/types';
import { bridgeHealth, gemmaUrl, readStrip, type BridgeHealth } from '../photo';
import type { Ctx } from './ctx';

/**
 * Live Camera & Photo module for photographing medicine wrappers or boxes.
 * Runs 100% locally with Gemma 4.
 */
export function Photo({ ctx, index, onFound }: { ctx: Ctx; index: Index; onFound: (h: Hit) => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'confirm' | 'failed'>('idle');
  const [seen, setSeen] = useState<string[]>([]);
  const [packaging, setPackaging] = useState<string>('wrapper');
  const [candidate, setCandidate] = useState<Hit | null>(null);
  const [health, setHealth] = useState<BridgeHealth>({ ok: false, handwriting: false });
  const [file, setFile] = useState<File | null>(null);
  const [reader, setReader] = useState<'printed' | 'gemini'>('printed');
  const [offer, setOffer] = useState(false);

  // Live in-app camera states
  const [cameraOpen, setCameraOpen] = useState(false);
  const [snappedPreview, setSnappedPreview] = useState<string | null>(null);
  const [snappedBlob, setSnappedBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { t } = ctx;

  useEffect(() => {
    const url = gemmaUrl();
    if (url) bridgeHealth(url).then(setHealth);
  }, []);

  // Cleanup camera stream when component unmounts or camera closes
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopStream();
  }, []);

  if (!health.ok) return null;
  const canFallback = health.handwriting && reader === 'printed' && file !== null;

  const startCamera = async () => {
    setCameraOpen(true);
    setSnappedPreview(null);
    setSnappedBlob(null);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError(t.cameraDenied);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctxCanvas = canvas.getContext('2d');
    if (!ctxCanvas) return;
    ctxCanvas.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setSnappedBlob(blob);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setSnappedPreview(dataUrl);
        stopStream();
      },
      'image/jpeg',
      0.9,
    );
  };

  const uploadCapturedPhoto = () => {
    if (!snappedBlob) return;
    const capturedFile = new File([snappedBlob], 'medicine_capture.jpg', { type: 'image/jpeg' });
    closeCameraModal();
    onFile(capturedFile);
  };

  const closeCameraModal = () => {
    stopStream();
    setCameraOpen(false);
    setSnappedPreview(null);
    setSnappedBlob(null);
    setCameraError(null);
  };

  const onFile = async (f: File | undefined, mode: 'printed' | 'gemini' = 'printed') => {
    if (!f) return;
    setFile(f);
    setReader(mode);
    setOffer(false);
    setState('busy');
    try {
      const r = await readStrip(f, index, mode);
      setSeen(r.lines);
      setPackaging(r.packaging || 'wrapper');
      if (r.hit) {
        setCandidate(r.hit);
        setState('confirm');
      } else setState('failed');
    } catch {
      setState('failed');
    }
  };

  return (
    <div class="photo">
      {/* Tile Button: opens live camera */}
      <button
        class="tile photo-btn"
        onClick={startCamera}
        disabled={state === 'busy'}
        aria-label={state === 'busy' ? t.photoReading : t.tilePhoto}
      >
        <span class="tile-icon" aria-hidden="true">📷</span>
        {state === 'busy' ? t.photoReading : t.tilePhoto}
      </button>

      {/* Hidden file input for gallery upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        disabled={state === 'busy'}
        onChange={(e) => {
          closeCameraModal();
          onFile((e.target as HTMLInputElement).files?.[0]);
        }}
      />

      {/* In-App Live Camera Viewfinder Modal */}
      {cameraOpen && (
        <div class="camera-overlay" role="dialog" aria-modal="true">
          <div class="camera-header">
            <h2 class="camera-title">📷 {snappedPreview ? t.photoConfirm : t.openCamera}</h2>
            <button class="camera-close" onClick={closeCameraModal} aria-label={t.cancel}>
              ✕
            </button>
          </div>

          <div class="camera-viewfinder">
            {snappedPreview ? (
              <img src={snappedPreview} alt="Captured medicine wrapper/box" class="camera-preview-img" />
            ) : (
              <>
                <video ref={videoRef} playsinline autoplay muted class="camera-video" />
                <div class="camera-guide">
                  <span class="camera-guide-text">{t.cameraGuide}</span>
                </div>
              </>
            )}

            {cameraError && (
              <div style="position:absolute; background:rgba(0,0,0,0.85); color:#ff8f7a; padding:16px; border-radius:12px; margin:20px; text-align:center;">
                <p style="margin:0 0 10px 0;">{cameraError}</p>
                <button
                  class="camera-action-btn"
                  style="background:var(--green); color:#fff;"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t.pickFile}
                </button>
              </div>
            )}
          </div>

          <div class="camera-controls">
            {snappedPreview ? (
              <div style="display:flex; flex-direction:column; gap:10px; width:100%; max-width:400px;">
                <button
                  class="big primary"
                  style="min-height:54px; font-weight:800;"
                  onClick={uploadCapturedPhoto}
                >
                  {t.uploadConfirm}
                </button>
                <div style="display:flex; gap:10px;">
                  <button
                    class="big secondary"
                    style="flex:1; background:rgba(255,255,255,0.2); color:#fff; border-color:rgba(255,255,255,0.3);"
                    onClick={startCamera}
                  >
                    {t.retake}
                  </button>
                  <button
                    class="big secondary"
                    style="flex:1; background:rgba(255,255,255,0.1); color:#fff; border-color:rgba(255,255,255,0.2);"
                    onClick={closeCameraModal}
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div class="camera-shutter-row">
                  <button
                    class="camera-sub-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t.pickFile}
                  </button>

                  <button
                    class="camera-shutter-btn"
                    onClick={capturePhoto}
                    aria-label={t.clickPhoto}
                    title={t.clickPhoto}
                  >
                    📸
                  </button>

                  <button
                    class="camera-sub-btn"
                    onClick={closeCameraModal}
                  >
                    {t.cancel}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Medicine Confirmation Screen */}
      {state === 'confirm' && candidate && (
        <div class="card confirm">
          <p class="muted small">{reader === 'gemini' ? t.readByGemini : t.readByGemma} · {t.photoSeen}: “{seen.slice(0, 4).join(' · ')}”</p>
          <div class="packaging-badge" style="display:inline-block; margin-bottom:8px; padding:4px 10px; border-radius:8px; font-weight:700; background:var(--green-soft); color:var(--green); font-size:14px;">
            {packaging === 'box' ? t.packagingBox : packaging === 'bottle' ? t.packagingBottle : t.packagingWrapper}
          </div>
          <h2 class="card-title">{t.photoConfirm}</h2>
          <p class="choice-title">{candidate.type === 'brand' ? candidate.brand.name : candidate.group.items[0].name}</p>
          <div class="row">
            <button class="big primary" onClick={() => { onFound(candidate); setState('idle'); }}>{t.yes}</button>
            <button class="big secondary" onClick={() => (canFallback ? setOffer(true) : setState('idle'))}>{t.noType}</button>
          </div>
        </div>
      )}

      {canFallback && (offer || state === 'failed') && (
        <div class="consent">
          <b>{t.fallbackTitle}</b>
          <p class="small">{t.fallbackBody}</p>
          <div class="row">
            <button class="big primary" onClick={() => onFile(file ?? undefined, 'gemini')}>{t.fallbackGo}</button>
            <button class="big secondary" onClick={() => { setOffer(false); setState('idle'); }}>{t.cancel}</button>
          </div>
        </div>
      )}

      {state === 'failed' && !canFallback && (
        <p class="warn">
          {t.photoFailed}
          {seen.length > 0 && <span class="muted small"> ({t.photoSeen}: “{seen.slice(0, 3).join(' · ')}”)</span>}
        </p>
      )}
    </div>
  );
}
