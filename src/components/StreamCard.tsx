import { Stream } from "../types";

interface StreamCardProps {
  key?: string;
  stream: Stream;
}

export function StreamCard({ stream }: StreamCardProps) {
  const vibrate = () => {
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const handlePlayLive = () => {
    vibrate();
    const fallback = encodeURIComponent("https://play.google.com/store/apps/details?id=com.appnix.playify");
    window.location.href = `intent:${stream.url}#Intent;action=android.intent.action.VIEW;type=video/*;package=com.appnix.playify;S.browser_fallback_url=${fallback};end`;
  };

  return (
    <div className="glass-card p-3 sm:p-4 flex flex-col items-center text-center relative h-full">
      <span
        className="absolute top-2 right-2 text-[9px] bg-[#ff3b3b] px-1.5 py-0.5 rounded-md font-extrabold tracking-[0.5px] z-10"
        style={{ animation: "pulse-badge 2s infinite" }}
      >
        LIVE
      </span>
      
      <div className="w-full aspect-video rounded-lg mb-3 flex items-center justify-center p-2" style={{ backgroundColor: 'var(--img-bg)' }}>
        {stream.logo ? (
          <img
            src={stream.logo}
            className="max-h-full max-w-full object-contain drop-shadow-lg"
            alt="logo"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-xs text-[var(--text-muted)] font-medium">No Logo</span>
        )}
      </div>
      
      <h3 className="text-[clamp(14px,4vw,16px)] font-bold mb-1 leading-tight line-clamp-2 text-[var(--text-main)]">{stream.channel}</h3>
      <div className="text-[11px] text-[var(--text-muted)] mb-3 font-medium">
        {stream.language} • {stream.quality} {stream.format ? `• ${stream.format}` : ''}
      </div>
      
      <div className="w-full mt-auto">
        <button 
          className="player-btn btn-playify w-full text-[13px] sm:text-[14px] py-2.5 flex items-center justify-center gap-2" 
          onClick={handlePlayLive}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M8 5v14l11-7z"/>
          </svg>
          Play Live
        </button>
      </div>
    </div>
  );
}
