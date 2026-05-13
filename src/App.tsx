import { useEffect, useState } from "react";
import { StreamCard } from "./components/StreamCard";
import { LoadingSection } from "./components/LoadingSection";
import { Stream } from "./types";
import { parseM3U } from "./utils";
import { Tv, Folder, ArrowLeft, Sun, Moon, Search } from "lucide-react";

interface SectionData {
  id: string;
  title: string;
  url: string;
  type: 'json' | 'm3u';
  streams: Stream[];
  loading: boolean;
  error: boolean;
  fetched: boolean;
  logo?: string;
}

const INITIAL_SECTIONS: SectionData[] = [
  {
    id: "sony",
    title: "Sony Channels",
    url: "https://raw.githubusercontent.com/Sflex0719/SonGharLive/main/SL.m3u",
    type: "m3u",
    streams: [],
    loading: false,
    error: false,
    fetched: false,
    logo: "https://upload.wikimedia.org/wikipedia/commons/f/f7/SonyLIV_2020.png",
  },
  {
    id: "star",
    title: "Star",
    url: "https://raw.githubusercontent.com/alex4528x/m3u/refs/heads/main/jstar.m3u",
    type: "m3u",
    streams: [],
    loading: false,
    error: false,
    fetched: false,
    logo: "https://play-lh.googleusercontent.com/Sxf3AYnBhBjW6yT28hiFD2OIUP_GirIDPQdY1-jiOxlDfnGLear_3GxVHE_8N2EP9Q",
  },
  {
    id: "zee5",
    title: "Zee 5",
    url: "https://raw.githubusercontent.com/alex4528x/m3u/refs/heads/main/z5.m3u",
    type: "m3u",
    streams: [],
    loading: false,
    error: false,
    fetched: false,
    logo: "https://m.media-amazon.com/images/I/51DI1Se1SQL._AC_UF894,1000_QL80_.jpg",
  },
  {
    id: "jiocinema",
    title: "Jio Cinema",
    url: "https://raw.githubusercontent.com/alex4528x/m3u/refs/heads/main/jcinema.m3u",
    type: "m3u",
    streams: [],
    loading: false,
    error: false,
    fetched: false,
    logo: "https://m.media-amazon.com/images/I/31LNEBVsjUL.png",
  },
  {
    id: "fancode",
    title: "Fancode",
    url: "https://raw.githubusercontent.com/srhady/Fancode-bd/refs/heads/main/main_playlist.m3u",
    type: "m3u",
    streams: [],
    loading: false,
    error: false,
    fetched: false,
    logo: "https://play-lh.googleusercontent.com/lp1Tdhp75MQyrHqrsyRBV74HxoL3Ko8KRAjOUI1wUHREAxuuVwKR6vnamgvMEn4C4Q",
  },
  {
    id: "json3",
    title: "Extra Streams",
    url: "https://gentle-moon-6383.lrl45.workers.dev/stream.json",
    type: "json",
    streams: [],
    loading: false,
    error: false,
    fetched: false,
    logo: "https://upload.wikimedia.org/wikipedia/commons/4/40/VLC_Icon.svg",
  },
];

export default function App() {
  const [sections, setSections] = useState<SectionData[]>(INITIAL_SECTIONS);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const fetchSectionData = async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section || section.fetched) return;

    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, loading: true } : s));

    try {
      const res = await fetch(section.url);
      let fetchedStreams: Stream[] = [];

      if (section.type === 'json') {
        const data = await res.json();
        let rawStreams = Array.isArray(data) ? data : (data.streams || []);
        fetchedStreams = rawStreams.map((s: any) => {
          if (typeof s === "string") {
            return { channel: "Stream", language: "Stream", quality: "HD", format: "HLS", url: s, logo: "" };
          }
          // Swap language and channel for JSON to match StreamCard expectations
          return {
            ...s,
            channel: s.language && s.language !== "-" ? s.language : s.channel,
            language: s.channel !== s.language ? s.channel : "Live"
          };
        });
      } else if (section.type === 'm3u') {
        const text = await res.text();
        fetchedStreams = parseM3U(text);
      }

      // Filter and Sort
      fetchedStreams = fetchedStreams.filter((s) => s.url && s.url.trim() !== "");
      
      fetchedStreams.sort((a, b) => {
        const getLangPriority = (s: Stream) => {
          const text = (s.language + " " + s.channel).toLowerCase();
          if (text.includes("telugu")) return 1;
          if (text.includes("english")) return 2;
          return 3;
        };
        const pA = getLangPriority(a);
        const pB = getLangPriority(b);
        if (pA !== pB) return pA - pB;

        const order = ["4K", "1080p", "720p", "HD", "SD"];
        const qA = order.indexOf(a.quality) !== -1 ? order.indexOf(a.quality) : 99;
        const qB = order.indexOf(b.quality) !== -1 ? order.indexOf(b.quality) : 99;
        return qA - qB;
      });

      setSections(prev => prev.map(s => 
        s.id === sectionId ? { ...s, streams: fetchedStreams, loading: false, fetched: true } : s
      ));
    } catch (err) {
      console.error(`Error fetching ${sectionId}:`, err);
      setSections(prev => prev.map(s => 
        s.id === sectionId ? { ...s, loading: false, error: true, fetched: true } : s
      ));
    }
  };

  const openSection = (id: string) => {
    setActiveSectionId(id);
    setSearchQuery("");
    const section = sections.find(s => s.id === id);
    if (section && !section.fetched) {
      fetchSectionData(id);
    }
  };

  const activeSection = sections.find(s => s.id === activeSectionId);

  const filterStreams = (streams: Stream[]) => {
    if (!searchQuery) return streams;
    const lowerQuery = searchQuery.toLowerCase();
    return streams.filter(s => 
      s.channel.toLowerCase().includes(lowerQuery) || 
      s.language.toLowerCase().includes(lowerQuery)
    );
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-5">
      <div className="flex flex-col items-center mb-6 relative">
        <img 
          src="https://ik.imagekit.io/kff5oshkqj/IMG_20250911_201953.jpg?updatedAt=1764274502089" 
          alt="Logo" 
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mb-3 shadow-lg object-cover border-2 border-[var(--accent)]" 
          referrerPolicy="no-referrer"
        />
        <div className="relative flex items-center justify-center w-full min-h-[40px]">
          {activeSectionId && (
            <button 
              onClick={() => setActiveSectionId(null)} 
              className="absolute left-0 flex items-center gap-1 text-[var(--accent)] font-bold bg-[var(--card-bg)] border border-[var(--card-border)] px-3 py-1.5 rounded-lg shadow-sm hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
            </button>
          )}
          
          <h1 
            className="text-center text-[clamp(20px,5vw,28px)] font-bold tracking-[-0.5px] uppercase text-[var(--accent)]"
            style={{ textShadow: isDarkMode ? "0 4px 12px rgba(0,0,0,0.3)" : "none" }}
          >
            gandreti raghu
          </h1>

          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="absolute right-0 p-2 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm text-[var(--text-main)] hover:scale-105 transition-transform"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {!activeSectionId ? (
        <div className="space-y-8 animate-in fade-in duration-300 mt-4">
          {/* Live IPL Section (Static) */}
          <div>
            <div className="flex items-center gap-3 mb-4 pl-2 border-l-4 border-[var(--accent)]">
              <h2 className="text-xl font-bold text-[var(--text-main)] uppercase tracking-wide">Live IPL</h2>
              <span className="text-xs font-bold bg-[var(--card-border)] px-2.5 py-1 rounded-full text-[var(--text-muted)]">
                4 Streams
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
              {/* Star Sports 1 Telugu HD */}
              <a href="https://jtvp.byethost14.com/player.html?id=568&mpd=https%3A%2F%2Fjiotvmblive.cdn.jio.com%2F%2Fbpk-tv%2FStar_Sports_1_Telugu_HD_BTS%2Foutput%2Findex.mpd&token=__hdnea__%253Dst%253D1774752831%7Eexp%253D1774839231%7Eacl%253D%252F*%7Ehmac%253D86a5c14bc3b92553c42f4f6244fbc6c5b90782fab23337c73d53ad88e9df0bb7" target="_blank" rel="noopener noreferrer" className="animated-border-card group relative bg-[var(--card-bg)] rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 cursor-pointer overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 rounded-xl overflow-hidden border-2 border-[var(--card-border)] group-hover:border-[var(--accent)] transition-colors duration-300 shadow-lg bg-white p-2">
                      <img src="https://jiotv.catchup.cdn.jio.com/dare_images/images/Star_Sports_1_Telugu_HD.png" alt="Star Sports 1 Telugu HD" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="relative text-sm sm:text-base font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">Star Sports 1 Telugu HD</h2>
              </a>

              {/* Star Sports 2 Telugu HD */}
              <a href="https://jtvp.byethost14.com/player.html?id=566&mpd=https%3A%2F%2Fjiotvmblive.cdn.jio.com%2F%2Fbpk-tv%2FStar_Sports2_Telugu_HD_BTS%2Foutput%2Findex.mpd&token=__hdnea__%253Dst%253D1774752831%7Eexp%253D1774839231%7Eacl%253D%252F*%7Ehmac%253D86a5c14bc3b92553c42f4f6244fbc6c5b90782fab23337c73d53ad88e9df0bb7" target="_blank" rel="noopener noreferrer" className="animated-border-card group relative bg-[var(--card-bg)] rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 cursor-pointer overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 rounded-xl overflow-hidden border-2 border-[var(--card-border)] group-hover:border-[var(--accent)] transition-colors duration-300 shadow-lg bg-white p-2">
                      <img src="https://jiotv.catchup.cdn.jio.com/dare_images/images/Star_Sports2_Telugu_HD.png" alt="Star Sports 2 Telugu HD" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="relative text-sm sm:text-base font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">Star Sports 2 Telugu HD</h2>
              </a>

              {/* Star Sports 1 HD English */}
              <a href="https://jtvp.byethost14.com/player.html?id=48&mpd=https%3A%2F%2Fjiotvmblive.cdn.jio.com%2F%2Fbpk-tv%2FStar_Sports_HD1_BTS%2Foutput%2Findex.mpd&token=__hdnea__%253Dst%253D1774752831%7Eexp%253D1774839231%7Eacl%253D%252F*%7Ehmac%253D86a5c14bc3b92553c42f4f6244fbc6c5b90782fab23337c73d53ad88e9df0bb7" target="_blank" rel="noopener noreferrer" className="animated-border-card group relative bg-[var(--card-bg)] rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 cursor-pointer overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 rounded-xl overflow-hidden border-2 border-[var(--card-border)] group-hover:border-[var(--accent)] transition-colors duration-300 shadow-lg bg-white p-2">
                      <img src="https://jiotv.catchup.cdn.jio.com/dare_images/images/Star_Sports_HD1.png" alt="Star Sports 1 HD English" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="relative text-sm sm:text-base font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">Star Sports 1 HD English</h2>
              </a>

              {/* Star Sports 2 HD English */}
              <a href="https://jtvp.byethost14.com/player.html?id=50&mpd=https%3A%2F%2Fjiotvmblive.cdn.jio.com%2F%2Fbpk-tv%2FStar_Sports_HD2_BTS%2Foutput%2Findex.mpd&token=__hdnea__%253Dst%253D1774752831%7Eexp%253D1774839231%7Eacl%253D%252F*%7Ehmac%253D86a5c14bc3b92553c42f4f6244fbc6c5b90782fab23337c73d53ad88e9df0bb7" target="_blank" rel="noopener noreferrer" className="animated-border-card group relative bg-[var(--card-bg)] rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 cursor-pointer overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 rounded-xl overflow-hidden border-2 border-[var(--card-border)] group-hover:border-[var(--accent)] transition-colors duration-300 shadow-lg bg-white p-2">
                      <img src="https://jiotv.catchup.cdn.jio.com/dare_images/images/Star_Sports_HD2.png" alt="Star Sports 2 HD English" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="relative text-sm sm:text-base font-bold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">Star Sports 2 HD English</h2>
              </a>
            </div>
          </div>

          {/* Other Folders Grid */}
          <div>
            <div className="flex items-center gap-3 mb-4 pl-2 border-l-4 border-[var(--accent)]">
              <h2 className="text-xl font-bold text-[var(--text-main)] uppercase tracking-wide">More Channels</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
              
              {/* Jio tv+ */}
              <a href="https://jtvp.byethost14.com/" target="_blank" rel="noopener noreferrer" className="animated-border-card group relative bg-[var(--card-bg)] rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 cursor-pointer overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 rounded-xl overflow-hidden border-2 border-[var(--card-border)] group-hover:border-[var(--accent)] transition-colors duration-300 shadow-lg">
                      <img src="https://i.postimg.cc/nzRJ94Vb/31-Gngoi-H5p-L.png" alt="Jio tv+ Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="relative text-base sm:text-lg font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">Jio tv+</h2>
              </a>

              {/* SonyLiv */}
              <a href="https://webplay.rf.gd/sony/" target="_blank" rel="noopener noreferrer" className="animated-border-card group relative bg-[var(--card-bg)] rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 cursor-pointer overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 rounded-xl overflow-hidden border-2 border-[var(--card-border)] group-hover:border-[var(--accent)] transition-colors duration-300 shadow-lg">
                      <img src="https://i.postimg.cc/C5BWZ96j/sony-liv-logo.jpg" alt="SonyLiv Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="relative text-base sm:text-lg font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">SonyLiv</h2>
              </a>

              {/* Zee5 */}
              <a href="https://jtvp.byethost9.com/z5/" target="_blank" rel="noopener noreferrer" className="animated-border-card group relative bg-[var(--card-bg)] rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 cursor-pointer overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 rounded-xl overflow-hidden border-2 border-[var(--card-border)] group-hover:border-[var(--accent)] transition-colors duration-300 shadow-lg">
                      <img src="https://i.postimg.cc/TwYPrm3d/Zee5-official-logo.jpg" alt="Zee5 Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="relative text-base sm:text-lg font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">Zee5</h2>
              </a>

              {/* Fancode */}
              <a href="https://streamverse.wuaze.com/fancode/" target="_blank" rel="noopener noreferrer" className="animated-border-card group relative bg-[var(--card-bg)] rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 cursor-pointer overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 rounded-xl overflow-hidden border-2 border-[var(--card-border)] group-hover:border-[var(--accent)] transition-colors duration-300 shadow-lg">
                      <img src="https://i.postimg.cc/Gp62DyXV/Screenshot-2025-07-13-131317-copy.png" alt="Fancode Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="relative text-base sm:text-lg font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">Fancode</h2>
              </a>

              {/* SonyLiv Events */}
              <a href="https://webplay.rf.gd/sonyliv-events/" target="_blank" rel="noopener noreferrer" className="animated-border-card group relative bg-[var(--card-bg)] rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 cursor-pointer overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 rounded-xl overflow-hidden border-2 border-[var(--card-border)] group-hover:border-[var(--accent)] transition-colors duration-300 shadow-lg">
                      <img src="https://i.postimg.cc/tTwNq61s/Untitled-3.png" alt="SonyLiv Events Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="relative text-base sm:text-lg font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">SonyLiv Events</h2>
              </a>

              {/* LG TV */}
              <a href="http://tataplay.is-best.net/lgtv/" target="_blank" rel="noopener noreferrer" className="animated-border-card group relative bg-[var(--card-bg)] rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 cursor-pointer overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 rounded-xl overflow-hidden border-2 border-[var(--card-border)] group-hover:border-[var(--accent)] transition-colors duration-300 shadow-lg">
                      <img src="https://i.postimg.cc/LssKsDfp/lg-image.png" alt="LG TV Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="relative text-base sm:text-lg font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">LG TV</h2>
              </a>

              {/* Oxolive */}
              <a href="http://tataplay.is-best.net/oxolive/" target="_blank" rel="noopener noreferrer" className="animated-border-card group relative bg-[var(--card-bg)] rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 cursor-pointer overflow-hidden flex flex-col items-center text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4 rounded-xl overflow-hidden border-2 border-[var(--card-border)] group-hover:border-[var(--accent)] transition-colors duration-300 shadow-lg">
                      <img src="https://i.postimg.cc/Njqcxr3Z/Screenshot-2025-10-21-143159.png" alt="Oxolive Logo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h2 className="relative text-base sm:text-lg font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] transition-colors">Oxolive</h2>
              </a>

            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 pl-2 border-l-4 border-[var(--accent)]">
              <h2 className="text-xl font-bold text-[var(--text-main)]">{activeSection?.title}</h2>
              {activeSection?.fetched && !activeSection?.loading && (
                <span className="text-xs font-bold bg-[var(--card-border)] px-2.5 py-1 rounded-full text-[var(--text-muted)]">
                  {filterStreams(activeSection.streams).length} Streams
                </span>
              )}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder="Search channels..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-main)] text-sm rounded-full pl-9 pr-4 py-2 focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          {activeSection?.loading ? (
            <LoadingSection />
          ) : activeSection?.error ? (
            <div className="text-red-500 text-sm p-4 text-center font-medium glass-card">Failed to load streams. Please try again later.</div>
          ) : activeSection?.streams && filterStreams(activeSection.streams).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5 items-stretch">
              {filterStreams(activeSection.streams).map((stream, idx) => (
                <StreamCard
                  key={`${activeSection.id}-${idx}`}
                  stream={stream}
                />
              ))}
            </div>
          ) : (
            <div className="text-[var(--text-muted)] text-sm p-4 text-center font-medium glass-card">
              {searchQuery ? "No channels match your search." : "No streams available in this category."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
