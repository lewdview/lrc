import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseAudioClock {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number; // in milliseconds
  duration: number; // in milliseconds
  playbackRate: number;
  setAudioUrl: (url: string | null) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (ms: number) => void;
  skip: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
}

export function useAudioClock(): UseAudioClock {
  const [audioUrl, setAudioUrlState] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRateState] = useState<number>(1.0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Initialize Audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      // Direct update in case RAF is not running
      setCurrentTime(audio.currentTime * 1000);
    };
    const handleDurationChange = () => {
      setDuration(audio.duration * 1000 || 0);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration * 1000 || 0);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Update URL source
  const setAudioUrl = useCallback((url: string | null) => {
    setAudioUrlState(url);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setCurrentTime(0);
      if (url) {
        audioRef.current.src = url;
        audioRef.current.load();
      } else {
        audioRef.current.src = '';
      }
    }
  }, []);

  // Set Playback Rate
  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  // Animation Frame Loop for precise time updates
  const tick = useCallback(() => {
    if (!audioRef.current) return;
    
    setCurrentTime(audioRef.current.currentTime * 1000);
    
    if (audioRef.current.paused) {
      setIsPlaying(false);
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  // Start RAF loop when playing starts
  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, tick]);

  // Actions
  const play = useCallback(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play().catch((err) => {
        console.error('Playback error:', err);
      });
    }
  }, [audioUrl]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  }, []);

  const seek = useCallback((ms: number) => {
    if (audioRef.current) {
      const timeInSecs = ms / 1000;
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration || 0, timeInSecs));
      setCurrentTime(ms);
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime + seconds;
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration || 0, newTime));
      setCurrentTime(audioRef.current.currentTime * 1000);
    }
  }, []);

  return {
    audioUrl,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    setAudioUrl,
    play,
    pause,
    stop,
    seek,
    skip,
    setPlaybackRate,
    audioRef,
  };
}
