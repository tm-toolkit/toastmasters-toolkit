import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

function fmtElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ScreenRecorderTool() {
  const [status, setStatus] = useState('idle'); // idle | recording | done | unsupported
  const [includeMic, setIncludeMic] = useState(true);
  const [micDevices, setMicDevices] = useState([]);
  const [micDeviceId, setMicDeviceId] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [mimeType, setMimeType] = useState('');
  const [error, setError] = useState('');

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const cleanupRef = useRef(() => {});
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      setStatus('unsupported');
    }
  }, []);

  const refreshMicDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === 'audioinput');
      setMicDevices(mics);
      setMicDeviceId((prev) => (mics.some((m) => m.deviceId === prev) ? prev : (mics[0]?.deviceId || '')));
    } catch {
      // Device enumeration unsupported or blocked — recording still falls back to the OS default mic.
    }
  }, []);

  useEffect(() => {
    if (status === 'unsupported') return;
    refreshMicDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshMicDevices);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshMicDevices);
  }, [status, refreshMicDevices]);

  // Device labels are blank until mic permission has been granted once — prime it
  // so the dropdown shows real names (e.g. "Blue Yeti") instead of "Microphone 1".
  useEffect(() => {
    if (!includeMic || status !== 'idle' || micDevices.some((d) => d.label)) return;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        refreshMicDevices();
      } catch {
        // Permission denied or no mic present — leave the list as-is.
      }
    })();
  }, [includeMic, status, micDevices, refreshMicDevices]);

  useEffect(() => () => {
    clearInterval(intervalRef.current);
    cleanupRef.current();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    // Only meant to run on unmount — deps intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRecording = useCallback(() => {
    clearInterval(intervalRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError('');
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      const videoTrack = displayStream.getVideoTracks()[0];
      let audioTracks = displayStream.getAudioTracks();
      const stopTracks = [...displayStream.getTracks()];
      let audioCtx = null;

      if (includeMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
          });
          audioCtx = new AudioContext();
          const dest = audioCtx.createMediaStreamDestination();
          if (audioTracks.length) audioCtx.createMediaStreamSource(new MediaStream(audioTracks)).connect(dest);
          audioCtx.createMediaStreamSource(micStream).connect(dest);
          audioTracks = dest.stream.getAudioTracks();
          stopTracks.push(...micStream.getTracks());
        } catch {
          // Mic permission denied or unavailable — fall back to screen/tab audio only.
        }
      }

      const combined = new MediaStream([videoTrack, ...audioTracks]);
      const chosenMime = pickMimeType();
      setMimeType(chosenMime);
      const recorder = new MediaRecorder(combined, chosenMime ? { mimeType: chosenMime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: chosenMime || 'video/webm' });
        setVideoUrl(URL.createObjectURL(blob));
        setStatus('done');
        stopTracks.forEach((t) => t.stop());
        audioCtx?.close();
      };

      cleanupRef.current = () => {
        stopTracks.forEach((t) => t.stop());
        audioCtx?.close();
      };
      videoTrack.onended = stopRecording;

      recorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
      setElapsed(0);
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      if (err.name !== 'NotAllowedError') setError("Couldn't start screen recording. Please try again.");
    }
  }, [includeMic, micDeviceId, stopRecording]);

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setStatus('idle');
    setElapsed(0);
  };

  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const downloadName = `screen-recording-${new Date().toISOString().slice(0, 10)}.${ext}`;

  return (
    <div>
      <h3 className="tool-title">🎬 Screen Recorder</h3>
      <p className="tool-desc">
        Record your screen — with optional microphone narration — right in the browser. No extra software,
        great for quick tutorials or walkthroughs for club members.
      </p>

      {status === 'unsupported' && (
        <div style={{ background: '#fce4ec', color: '#c62828', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 14 }}>
          This browser doesn't support screen recording. Try a recent Chrome or Edge on desktop.
        </div>
      )}
      {error && (
        <div style={{ background: '#fce4ec', color: '#c62828', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {status === 'idle' && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeMic} onChange={(e) => setIncludeMic(e.target.checked)} />
            🎙️ Include microphone narration
          </label>
          {includeMic && micDevices.length > 0 && (
            <div className="fg" style={{ maxWidth: 280, marginBottom: 14 }}>
              <span className="fl">Microphone</span>
              <select className="fs" value={micDeviceId} onChange={(e) => setMicDeviceId(e.target.value)}>
                {micDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>
                ))}
              </select>
            </div>
          )}
          <motion.button className="btn-b" whileTap={{ scale: 0.96 }} onClick={startRecording}>
            ⏺ Start Recording
          </motion.button>
        </>
      )}

      {status === 'recording' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: 420 }}>
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            style={{ width: 12, height: 12, borderRadius: '50%', background: '#e53935', flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 13 }}>Recording… {fmtElapsed(elapsed)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pick "Stop sharing" in the browser bar, or click Stop.</div>
          </div>
          <button className="btn-d" onClick={stopRecording}>⏹ Stop</button>
        </motion.div>
      )}

      {status === 'done' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          {videoUrl && (
            /* eslint-disable-next-line jsx-a11y/media-has-caption -- user-recorded clip, no captions to add */
            <video src={videoUrl} controls style={{ width: '100%', maxWidth: 480, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', background: '#0d1b2a' }} />
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            {videoUrl && (
              <motion.a
                className="btn-b" whileTap={{ scale: 0.96 }} href={videoUrl} download={downloadName}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                ⬇ Download Recording
              </motion.a>
            )}
            <motion.button className="btn-s" whileTap={{ scale: 0.96 }} onClick={reset}>⟳ Record another</motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
