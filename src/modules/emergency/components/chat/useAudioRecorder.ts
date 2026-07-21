import { useEffect, useRef, useState } from 'react';

// Item 10: gravação de áudio no navegador (estilo WhatsApp) via MediaRecorder.
// `start()` pede permissão de microfone; `stop()` resolve com o File gravado;
// `cancel()` descarta. `supported` cobre o fallback (sem microfone → anexar arquivo).
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((f: File | null) => void) | null>(null);

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const stopTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes('mp4') || type.includes('mpeg') ? 'm4a' : 'webm';
      const file = new File([blob], `audio-${Date.now()}.${ext}`, { type });
      stopTimer();
      releaseStream();
      resolveRef.current?.(file);
      resolveRef.current = null;
    };

    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    setSeconds(0);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stop = () =>
    new Promise<File | null>((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      resolveRef.current = resolve;
      setIsRecording(false);
      recorder.stop(); // dispara onstop → resolve com o File
    });

  const cancel = () => {
    const recorder = recorderRef.current;
    setIsRecording(false);
    stopTimer();
    resolveRef.current = null;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null; // descarta sem resolver
      recorder.stop();
    }
    releaseStream();
    chunksRef.current = [];
  };

  // Cleanup em unmount (evita microfone preso se sair no meio da gravação).
  useEffect(() => cancel, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isRecording, seconds, supported, start, stop, cancel };
}
