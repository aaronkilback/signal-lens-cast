import { useRef, useEffect, memo } from 'react';
import aegisAvatar from '@/assets/aegis-avatar.png';

interface SplitScreenPreviewProps {
  webcamStream: MediaStream | null;
  isAiSpeaking: boolean;
  guestName?: string;
  onWebcamVideoReady?: (video: HTMLVideoElement) => void;
}

export const SplitScreenPreview = memo(function SplitScreenPreview({
  webcamStream,
  isAiSpeaking,
  guestName = 'Guest',
  onWebcamVideoReady,
}: SplitScreenPreviewProps) {
  const webcamRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (webcamRef.current && webcamStream) {
      webcamRef.current.srcObject = webcamStream;
      onWebcamVideoReady?.(webcamRef.current);
    }
  }, [webcamStream, onWebcamVideoReady]);

  return (
    <div className="relative w-full aspect-video bg-[#0A192F] rounded-lg overflow-hidden">
      {/* Split screen container */}
      <div className="absolute inset-0 flex">
        {/* Aegis side (left) */}
        <div className="relative w-1/2 h-full overflow-hidden">
          <img
            src={aegisAvatar}
            alt="Aegis"
            className={`w-full h-full object-cover transition-all duration-300 ${
              isAiSpeaking ? 'ring-4 ring-[#D4AF37] ring-inset shadow-[0_0_30px_rgba(212,175,55,0.5)]' : ''
            }`}
          />
          {/* Name label */}
          <div className="absolute bottom-4 left-4 bg-black/70 px-4 py-2 rounded">
            <p className="text-white font-bold text-sm">AEGIS</p>
            <p className="text-[#D4AF37] text-xs">Host</p>
          </div>
          {/* Speaking indicator */}
          {isAiSpeaking && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#D4AF37]/20 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-pulse" />
              <span className="text-[#D4AF37] text-xs font-medium">Speaking</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-1 bg-[#1E3A5F]" />

        {/* Guest side (right) */}
        <div className="relative w-1/2 h-full bg-[#0D2137] overflow-hidden">
          {webcamStream ? (
            <video
              ref={webcamRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }} // Mirror for natural feel
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-muted/20 flex items-center justify-center">
                  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <p className="text-sm">Webcam will appear here</p>
              </div>
            </div>
          )}
          {/* Name label */}
          <div className="absolute bottom-4 left-4 bg-black/70 px-4 py-2 rounded">
            <p className="text-white font-bold text-sm uppercase">{guestName}</p>
            <p className="text-slate-400 text-xs">Interview</p>
          </div>
        </div>
      </div>

      {/* Recording indicator overlay */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className="bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2">
          <span className="text-white/80 text-xs font-medium">LIVE</span>
        </div>
      </div>
    </div>
  );
});
