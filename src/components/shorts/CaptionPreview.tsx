import { useState, useEffect } from 'react';

interface Caption {
  words: { text: string; start: number; end: number }[];
  fullText: string;
  start: number;
  end: number;
  style: {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    color: string;
    textShadow: string;
    textTransform: string;
    position: string;
    animation: string;
    highlightColor: string;
  };
}

interface CaptionPreviewProps {
  captions: Caption[];
  currentTime: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
}

export function CaptionPreview({ captions, currentTime, aspectRatio = '9:16' }: CaptionPreviewProps) {
  const [activeCaption, setActiveCaption] = useState<Caption | null>(null);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);

  useEffect(() => {
    // Find the active caption
    const current = captions.find(
      (cap) => currentTime >= cap.start && currentTime < cap.end
    );
    setActiveCaption(current || null);

    // Find the active word within the caption
    if (current) {
      const wordIdx = current.words.findIndex(
        (word) => currentTime >= word.start && currentTime < word.end
      );
      setActiveWordIndex(wordIdx);
    } else {
      setActiveWordIndex(-1);
    }
  }, [captions, currentTime]);

  if (!activeCaption) return null;

  const getPositionClass = (position: string) => {
    switch (position) {
      case 'top':
        return 'top-8';
      case 'bottom':
        return 'bottom-8';
      case 'center':
      default:
        return 'top-1/2 -translate-y-1/2';
    }
  };

  const getAnimationClass = (animation: string, isActive: boolean) => {
    if (!isActive) return 'opacity-50';
    
    switch (animation) {
      case 'pop':
        return 'scale-110 opacity-100';
      case 'bounce':
        return 'animate-bounce opacity-100';
      case 'scale':
        return 'scale-125 opacity-100';
      case 'fade':
      default:
        return 'opacity-100';
    }
  };

  const aspectRatioClass = {
    '9:16': 'aspect-[9/16]',
    '16:9': 'aspect-video',
    '1:1': 'aspect-square',
  }[aspectRatio];

  return (
    <div className={`relative ${aspectRatioClass} bg-black/90 rounded-lg overflow-hidden`}>
      <div
        className={`absolute left-4 right-4 ${getPositionClass(activeCaption.style.position)} text-center`}
      >
        <div className="flex flex-wrap justify-center gap-x-2">
          {activeCaption.words.map((word, idx) => {
            const isActive = idx === activeWordIndex;
            const isPast = idx < activeWordIndex;
            
            return (
              <span
                key={idx}
                className={`inline-block transition-all duration-100 ${
                  getAnimationClass(activeCaption.style.animation, isActive || isPast)
                }`}
                style={{
                  fontFamily: activeCaption.style.fontFamily,
                  fontSize: activeCaption.style.fontSize,
                  fontWeight: activeCaption.style.fontWeight,
                  color: isActive ? activeCaption.style.highlightColor : activeCaption.style.color,
                  textShadow: activeCaption.style.textShadow,
                  textTransform: activeCaption.style.textTransform as any,
                }}
              >
                {word.text}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
