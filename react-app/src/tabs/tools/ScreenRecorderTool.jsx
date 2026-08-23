import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Output, Mp4OutputFormat, BufferTarget, MediaStreamVideoTrackSource, MediaStreamAudioTrackSource, QUALITY_HIGH } from 'mediabunny';

function fmtElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ScreenRecorderTool() {
  const [status, setStatus] = useState('idle'); // idle | recording | finishing | done | unsupported
  const [includeMic, setIncludeMic] = useState(true);
  const [micDevices, setMicDevices] = useState([]);
  const [micDeviceId, setMicDeviceId] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState('');

  const outputRef = useRef(null);
  const videoSourceRef = useRef(null);
  const audioSourceRef = useRef(null);
  const cleanupRef = useRef(() => {});
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!navigator.mediaDevices?.getDisplayMedia || typeof VideoEncoder === 'undefined') {
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

  // Muxes straight into a real MP4 via Mediabunny/WebCodecs (MediaStreamVideoTrackSource
  // + MediaStreamAudioTrackSource pull frames live off the tracks) instead of MediaRecorder —
  // Chrome's MediaRecorder essentially never actually produces video/mp4 in practice, silently
  // falling back to WebM, which is what made recordings hard to share (many apps on phones/
  // social platforms don't preview or accept .webm).
  const stopRecording = useCallback(async () => {
    clearInterval(intervalRef.current);
    if (!outputRef.current) return;
    setStatus('finishing');
    videoSourceRef.current?.close();
    audioSourceRef.current?.close();
    const output = outputRef.current;
    outputRef.current = null;
    try {
      await output.finalize();
      const blob = new Blob([output.target.buffer], { type: 'video/mp4' });
      setVideoUrl(URL.createObjectURL(blob));
      setStatus('done');
    } catch {
      setError("Couldn't finish the recording. Please try again.");
      setStatus('idle');
    }
    cleanupRef.current();
    cleanupRef.current = () => {};
  }, []);

  const startRecording = useCallback(async () => {
    setError('');
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      const videoTrack = displayStream.getVideoTracks()[0];
      let audioTrack = displayStream.getAudioTracks()[0] || null;
      const stopTracks = [...displayStream.getTracks()];
      let audioCtx = null;

      if (includeMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
          });
          audioCtx = new AudioContext();
          const dest = audioCtx.createMediaStreamDestination();
          if (audioTrack) audioCtx.createMediaStreamSource(new MediaStream([audioTrack])).connect(dest);
          audioCtx.createMediaStreamSource(micStream).connect(dest);
          audioTrack = dest.stream.getAudioTracks()[0];
          stopTracks.push(...micStream.getTracks());
        } catch {
          // Mic permission denied or unavailable — fall back to screen/tab audio only.
        }
      }

      const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
      const videoSource = new MediaStreamVideoTrackSource(videoTrack, { codec: 'avc', bitrate: QUALITY_HIGH });
      output.addVideoTrack(videoSource);
      let audioSource = null;
      if (audioTrack) {
        audioSource = new MediaStreamAudioTrackSource(audioTrack, { codec: 'aac', bitrate: 128_000 });
        output.addAudioTrack(audioSource);
      }

      cleanupRef.current = () => {
        stopTracks.forEach((t) => t.stop());
        audioCtx?.close();
      };
      videoTrack.onended = stopRecording;

      await output.start();
      outputRef.current = output;
      videoSourceRef.current = videoSource;
      audioSourceRef.current = audioSource;

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

  const downloadName = `screen-recording-${new Date().toISOString().slice(0, 10)}.mp4`;

  return (
    <div>
      <h3 className="tool-title">🎬 Screen Recorder</h3>
      <p className="tool-desc">
        Record your screen — with optional microphone narration — right in the browser. Saves as a real MP4,
        so it's easy to share on WhatsApp, Instagram, or wherever club members will watch it.
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

      {status === 'finishing' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--maroon)', flexShrink: 0 }}
          />
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 13 }}>Finishing up the MP4…</div>
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
