import { useCallback, useEffect, useRef, useState } from "react";

const MIN_SUBMIT_OVERLAY_MS = 1250;
const COMPLETE_HOLD_MS = 350;
const PROGRESS_INTERVAL_MS = 150;
const PROGRESS_MAX_BEFORE_COMPLETE = 92;
const PROGRESS_INCREMENT = 3;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export function useSubmitProgressOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);

  const submitStartedAtRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iconPreviewUrlRef = useRef<string | null>(null);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const revokePreviewUrl = useCallback(() => {
    if (iconPreviewUrlRef.current) {
      URL.revokeObjectURL(iconPreviewUrlRef.current);
      iconPreviewUrlRef.current = null;
    }
    setIconPreviewUrl(null);
  }, []);

  const start = useCallback(
    (iconFile?: File | null) => {
      clearProgressTimer();
      submitStartedAtRef.current = Date.now();
      setIsVisible(true);
      setProgress(0);

      revokePreviewUrl();
      if (iconFile) {
        const objectUrl = URL.createObjectURL(iconFile);
        iconPreviewUrlRef.current = objectUrl;
        setIconPreviewUrl(objectUrl);
      }

      progressTimerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= PROGRESS_MAX_BEFORE_COMPLETE) return prev;
          return Math.min(
            prev + PROGRESS_INCREMENT,
            PROGRESS_MAX_BEFORE_COMPLETE,
          );
        });
      }, PROGRESS_INTERVAL_MS);
    },
    [clearProgressTimer, revokePreviewUrl],
  );

  const finalize = useCallback(async () => {
    const elapsed = Date.now() - submitStartedAtRef.current;
    const waitMs = Math.max(0, MIN_SUBMIT_OVERLAY_MS - elapsed);

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    clearProgressTimer();
    setProgress(100);
    await sleep(COMPLETE_HOLD_MS);
  }, [clearProgressTimer]);

  const cancel = useCallback(() => {
    clearProgressTimer();
    setIsVisible(false);
    setProgress(0);
    revokePreviewUrl();
  }, [clearProgressTimer, revokePreviewUrl]);

  useEffect(() => {
    return () => {
      clearProgressTimer();
      revokePreviewUrl();
    };
  }, [clearProgressTimer, revokePreviewUrl]);

  return {
    isVisible,
    progress,
    iconPreviewUrl,
    start,
    finalize,
    cancel,
  };
}
