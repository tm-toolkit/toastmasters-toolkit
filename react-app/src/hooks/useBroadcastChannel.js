import { useEffect, useRef, useCallback } from 'react';

// Wraps BroadcastChannel(name) — same channel name ('tm_display') the vanilla
// app used to sync the live timer to the popped-out OBS overlay window.
// onMessage is optional (the main window only sends; the DisplayOverlay only listens).
export function useBroadcastChannel(name, onMessage) {
  const channelRef = useRef(null);

  useEffect(() => {
    const bc = new BroadcastChannel(name);
    channelRef.current = bc;
    if (onMessage) {
      bc.onmessage = (e) => onMessage(e.data);
    }
    return () => bc.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const post = useCallback((data) => {
    channelRef.current?.postMessage(data);
  }, []);

  return post;
}
