import { useRef, useState, useCallback, useEffect } from 'react';

interface UseVideoRecordingOptions {
  width?: number;
  height?: number;
  frameRate?: number;
}

export function useVideoRecording(options: UseVideoRecordingOptions = {}) {
  const { width = 1920, height = 1080, frameRate = 30 } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sources for compositing
  const avatarImageRef = useRef<HTMLImageElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const loadAvatarImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        avatarImageRef.current = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  const setWebcamVideo = useCallback((video: HTMLVideoElement | null) => {
    webcamVideoRef.current = video;
  }, []);

  const setAudioStream = useCallback((stream: MediaStream | null) => {
    audioStreamRef.current = stream;
  }, []);

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, isAiSpeaking: boolean) => {
    const canvasWidth = width;
    const canvasHeight = height;
    const halfWidth = canvasWidth / 2;
    
    // Clear canvas with dark background
    ctx.fillStyle = '#0A192F';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw avatar on left side
    if (avatarImageRef.current) {
      const img = avatarImageRef.current;
      const imgAspect = img.width / img.height;
      const targetAspect = halfWidth / canvasHeight;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (imgAspect > targetAspect) {
        // Image is wider - fit to height
        drawHeight = canvasHeight;
        drawWidth = drawHeight * imgAspect;
        drawX = (halfWidth - drawWidth) / 2;
        drawY = 0;
      } else {
        // Image is taller - fit to width
        drawWidth = halfWidth;
        drawHeight = drawWidth / imgAspect;
        drawX = 0;
        drawY = (canvasHeight - drawHeight) / 2;
      }
      
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      
      // Add speaking indicator glow when AI is speaking
      if (isAiSpeaking) {
        ctx.shadowColor = '#D4AF37';
        ctx.shadowBlur = 30;
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, halfWidth - 4, canvasHeight - 4);
        ctx.shadowBlur = 0;
      }
    }
    
    // Draw divider line
    ctx.fillStyle = '#1E3A5F';
    ctx.fillRect(halfWidth - 2, 0, 4, canvasHeight);
    
    // Draw webcam on right side
    if (webcamVideoRef.current && webcamVideoRef.current.readyState >= 2) {
      const video = webcamVideoRef.current;
      const videoAspect = video.videoWidth / video.videoHeight;
      const targetAspect = halfWidth / canvasHeight;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (videoAspect > targetAspect) {
        // Video is wider - fit to height
        drawHeight = canvasHeight;
        drawWidth = drawHeight * videoAspect;
        drawX = halfWidth + (halfWidth - drawWidth) / 2;
        drawY = 0;
      } else {
        // Video is taller - fit to width
        drawWidth = halfWidth;
        drawHeight = drawWidth / videoAspect;
        drawX = halfWidth;
        drawY = (canvasHeight - drawHeight) / 2;
      }
      
      ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
    } else {
      // Placeholder when no webcam
      ctx.fillStyle = '#0D2137';
      ctx.fillRect(halfWidth, 0, halfWidth, canvasHeight);
      ctx.fillStyle = '#4A5568';
      ctx.font = '24px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Webcam', halfWidth + halfWidth / 2, canvasHeight / 2);
    }
    
    // Add name labels
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(20, canvasHeight - 80, 200, 50);
    ctx.fillRect(halfWidth + 20, canvasHeight - 80, 200, 50);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('AEGIS', 40, canvasHeight - 48);
    ctx.fillText('GUEST', halfWidth + 40, canvasHeight - 48);
    
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#D4AF37';
    ctx.fillText('Host', 40, canvasHeight - 30);
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Interview', halfWidth + 40, canvasHeight - 30);
  }, [width, height]);

  const startRecording = useCallback(async (isAiSpeakingGetter: () => boolean) => {
    if (!canvasRef.current) {
      // Create canvas if not exists
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvasRef.current = canvas;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    chunksRef.current = [];
    setRecordedBlob(null);
    
    // Start animation loop
    const renderLoop = () => {
      drawFrame(ctx, isAiSpeakingGetter());
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    
    // Get canvas stream
    const canvasStream = canvas.captureStream(frameRate);
    
    // Combine with audio if available
    let combinedStream: MediaStream;
    if (audioStreamRef.current) {
      const audioTracks = audioStreamRef.current.getAudioTracks();
      combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ]);
    } else {
      combinedStream = canvasStream;
    }
    
    // Create MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';
    
    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 5000000, // 5 Mbps for good quality
    });
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000); // Collect data every second
    
    startTimeRef.current = Date.now();
    setRecordingDuration(0);
    
    // Update duration every second
    durationIntervalRef.current = setInterval(() => {
      setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    
    setIsRecording(true);
  }, [width, height, frameRate, drawFrame]);

  const stopRecording = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
  }, []);

  const downloadRecording = useCallback((filename?: string) => {
    if (!recordedBlob) return;
    
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `aegis-interview-${new Date().toISOString().slice(0, 10)}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recordedBlob]);

  const getPreviewCanvas = useCallback(() => canvasRef.current, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    recordedBlob,
    recordingDuration,
    loadAvatarImage,
    setWebcamVideo,
    setAudioStream,
    startRecording,
    stopRecording,
    downloadRecording,
    getPreviewCanvas,
  };
}
