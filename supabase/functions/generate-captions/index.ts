import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segments, startTime, endTime, style = "martell" } = await req.json();

    if (!segments || startTime === undefined || endTime === undefined) {
      return new Response(
        JSON.stringify({ error: "segments, startTime, and endTime are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter segments to only include those within the clip range
    const clipSegments = segments.filter((seg: any) => 
      seg.start >= startTime && seg.end <= endTime
    );

    // If we have word-level timestamps, use those for animated captions
    const captions: any[] = [];
    
    for (const segment of clipSegments) {
      if (segment.words && segment.words.length > 0) {
        // Word-by-word captions (Dan Martell style)
        for (const word of segment.words) {
          if (word.start >= startTime && word.end <= endTime) {
            captions.push({
              text: word.word.trim(),
              start: word.start - startTime, // Normalize to clip start
              end: word.end - startTime,
              type: "word",
            });
          }
        }
      } else {
        // Segment-level captions as fallback
        captions.push({
          text: segment.text,
          start: segment.start - startTime,
          end: segment.end - startTime,
          type: "segment",
        });
      }
    }

    // Generate styled caption groups (3-4 words at a time for readability)
    const styledCaptions: any[] = [];
    let currentGroup: any[] = [];
    let groupStart = 0;

    for (let i = 0; i < captions.length; i++) {
      const caption = captions[i];
      
      if (currentGroup.length === 0) {
        groupStart = caption.start;
      }
      
      currentGroup.push(caption);
      
      // Group 3-4 words together or break at punctuation
      const shouldBreak = 
        currentGroup.length >= 4 ||
        caption.text.match(/[.!?,;:]$/) ||
        i === captions.length - 1;
        
      if (shouldBreak && currentGroup.length > 0) {
        styledCaptions.push({
          words: currentGroup.map(c => ({
            text: c.text,
            start: c.start,
            end: c.end,
          })),
          fullText: currentGroup.map(c => c.text).join(" "),
          start: groupStart,
          end: caption.end,
          style: getStyleForCaption(style),
        });
        currentGroup = [];
      }
    }

    return new Response(
      JSON.stringify({
        captions: styledCaptions,
        totalDuration: endTime - startTime,
        wordCount: captions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Caption generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getStyleForCaption(style: string) {
  const styles: Record<string, any> = {
    martell: {
      fontFamily: "Impact, sans-serif",
      fontSize: "48px",
      fontWeight: "900",
      color: "#FFFFFF",
      textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
      textTransform: "uppercase",
      position: "center",
      animation: "pop",
      highlightColor: "#FFD700",
    },
    hormozi: {
      fontFamily: "Arial Black, sans-serif",
      fontSize: "44px",
      fontWeight: "900",
      color: "#FFFFFF",
      textShadow: "3px 3px 6px rgba(0,0,0,0.9)",
      textTransform: "uppercase",
      position: "center",
      animation: "bounce",
      highlightColor: "#FF4444",
    },
    minimal: {
      fontFamily: "Inter, sans-serif",
      fontSize: "36px",
      fontWeight: "600",
      color: "#FFFFFF",
      textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
      textTransform: "none",
      position: "bottom",
      animation: "fade",
      highlightColor: "#4A90D9",
    },
    bold: {
      fontFamily: "Montserrat, sans-serif",
      fontSize: "52px",
      fontWeight: "900",
      color: "#FFFFFF",
      textShadow: "4px 4px 8px rgba(0,0,0,1)",
      textTransform: "uppercase",
      position: "center",
      animation: "scale",
      highlightColor: "#00FF88",
    },
  };

  return styles[style] || styles.martell;
}
