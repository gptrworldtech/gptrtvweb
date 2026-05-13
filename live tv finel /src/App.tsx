import React, { useState, useEffect, useRef } from 'react';
import { 
  Dribbble, Search, Loader2, Music, ChevronDown, PlayCircle, Tv, Maximize, X, Clock
} from 'lucide-react';

interface Channel {
  name: string;
  logo: string;
  link: string;
  fallbackLink?: string;
  activeLink?: string;
  servers?: { name: string; url: string; status?: 'online' | 'offline' | 'checking' }[];
  group: string;
  tvgId?: string;
}

interface Program {
  title: string;
  start: string;
  end: string;
  desc?: string;
  icon?: string;
}

const normalizeChannelName = (value: string) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const serverNameForSource = (sourceOrder: number, index: number) => {
  const base = [`Server ${sourceOrder + 1}`, `Server ${sourceOrder + 1}.${index + 1}`];
  return base[index] || `Server ${sourceOrder + 1}.${index + 1}`;
};


// Shared M3U parser helper
const fetchAndParseM3U = async (url: string) => {
  let parsed: Channel[] = [];
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.split('\n');
    let currentCh: any = {};
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        const groupMatch = line.match(/group-title="([^"]+)"/);
        const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
        const nameSplit = line.split(',');
        
        currentCh.logo = logoMatch ? logoMatch[1] : '';
        currentCh.group = groupMatch ? groupMatch[1] : '';
        currentCh.name = nameSplit.length > 1 ? nameSplit[1].trim() : '';
        currentCh.tvgId = tvgIdMatch ? tvgIdMatch[1] : '';
        } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
        const keyData = line.substring(line.indexOf('=') + 1);
        if (keyData) {
            const [keyId, key] = keyData.split(':');
            currentCh.keyId = keyId;
            currentCh.key = key;
        }
        } else if (line.startsWith('#EXTHTTP:')) {
            try {
                const jsonStr = line.replace('#EXTHTTP:', '');
                const headers = JSON.parse(jsonStr);
                if (headers.cookie) {
                    currentCh.cookie = headers.cookie;
                }
            } catch(e) {}
        } else if (!line.startsWith('#')) {
        if (currentCh.name) {
            const isM3U8 = /\.m3u8(\?|$)/i.test(line);
            let playerLink = '';

            if (isM3U8 && !(currentCh.keyId && currentCh.key)) {
              playerLink = `https://proxy.lrl45.workers.dev/?url=${encodeURIComponent(line)}`;
            } else {
              const baseMpDUrl = line.split('?')[0];
              playerLink = `https://dash.vodep39240327.workers.dev/?url=${baseMpDUrl}?name=${currentCh.name.replace(/\s+/g, '_')}`;

              if (currentCh.keyId && currentCh.key) {
                playerLink += `&keyId=${currentCh.keyId}&key=${currentCh.key}`;
              }
              if (currentCh.cookie) {
                playerLink += `&cookie=${currentCh.cookie}`;
              } else if (line.includes('__hdnea__=')) {
                const match = line.match(/__hdnea__=[^&]+/);
                if (match) {
                  playerLink += `&cookie=${match[0]}`;
                }
              }
            }
            parsed.push({
            name: currentCh.name,
            logo: currentCh.logo,
            group: currentCh.group,
            link: playerLink,
            tvgId: currentCh.tvgId || ''
            });
        }
        currentCh = {};
        }
    }
  } catch(e) { console.error('M3U fetch failed', url, e); }
  return parsed;
};

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isSportsDropdownOpen, setIsSportsDropdownOpen] = useState(false);
  const [isIplDropdownOpen, setIsIplDropdownOpen] = useState(false);
  const [isTeluguLocalDropdownOpen, setIsTeluguLocalDropdownOpen] = useState(false);
  const [teluguLocalChannels, setTeluguLocalChannels] = useState<Channel[]>([]);
  const [isTeluguLocalLoading, setIsTeluguLocalLoading] = useState(false);
  const [isFancodeDropdownOpen, setIsFancodeDropdownOpen] = useState(false);
  const [fancodeChannels, setFancodeChannels] = useState<Channel[]>([]);
  const [isFancodeLoading, setIsFancodeLoading] = useState(false);
  const [channelHealth, setChannelHealth] = useState<Record<string, 'online' | 'offline' | 'checking'>>({});
  const [preferredServerMap, setPreferredServerMap] = useState<Record<string, string>>({});
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [showEPG, setShowEPG] = useState(false);
  const [epgData, setEpgData] = useState<Record<string, Program[]>>({});
  const [epgChannelMap, setEpgChannelMap] = useState<Record<string, string>>({});
  const [isEpgLoading, setIsEpgLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTeluguDropdownOpen, setIsTeluguDropdownOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [recentChannels, setRecentChannels] = useState<Channel[]>([]);
  const [isVerifyingStream, setIsVerifyingStream] = useState(false);
  const [showServerToggle, setShowServerToggle] = useState(true);
  const playerRef = useRef<HTMLDivElement>(null);
  const serverToggleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      // Unlock orientation if exiting fullscreen
      // @ts-ignore
      if (!document.fullscreenElement && window.screen && window.screen.orientation && window.screen.orientation.unlock) {
        // @ts-ignore
        try { window.screen.orientation.unlock(); } catch (e) {}
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Anti-Inspect / DevTools Blocker
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.metaKey && e.altKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.ctrlKey && ['U', 'u'].includes(e.key)) ||
        (e.metaKey && ['U', 'u'].includes(e.key))
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    });

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);


  const testChannelQuickly = async (url: string) => {
    try {
        const urlObj = new URL(url);
        const mpd = urlObj.searchParams.get('url');
        const testUrl = mpd || url;
        if (!testUrl) return false;

        // Try direct HEAD first (Fastest)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const res = await fetch(testUrl, { method: 'HEAD', signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) return true;
          if (res.status === 403 || res.status === 404 || res.status >= 500) return false;
        } catch (e) {}

        // Simple Proxy Check (AllOrigins Raw / CodeTabs)
        try {
            const proxyUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(testUrl)}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const pRes = await fetch(proxyUrl, { method: 'HEAD', signal: controller.signal });
            clearTimeout(timeoutId);
          if (pRes.ok) return true;
          if (pRes.status === 403 || pRes.status === 404 || pRes.status >= 500) return false;
        } catch (pe) {}

        return false;
      } catch (e) { return false; }
  };

  const testServerSequentially = async (servers: { name: string; url: string }[]) => {
    for (const server of servers) {
      const isWorking = await testChannelQuickly(server.url);
      if (isWorking) {
        return server.url;
      }
    }
    return servers[0]?.url || '';
  };

  const handleChannelSelect = async (channel: Channel) => {
    if (!channel) return;
    
    // Smooth scroll
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const normalizedName = normalizeChannelName(channel.name);
    const firstOnlineServer = channel.servers?.find(server => server.status === 'online');
    let initialLink = preferredServerMap[normalizedName] || firstOnlineServer?.url || channel.servers?.[0]?.url || channel.link;

    setCurrentChannel({ ...channel, activeLink: initialLink });
    
    localStorage.setItem('lastChannelName', channel.name);

    // Server Toggle Visibility Timer (15 seconds)
    setShowServerToggle(true);
    if (serverToggleTimerRef.current) clearTimeout(serverToggleTimerRef.current);
    serverToggleTimerRef.current = setTimeout(() => {
        setShowServerToggle(false);
    }, 15000);

    // Auto verify stream across all available servers sequentially (Deep Verify)
    if (channel.servers && channel.servers.length > 1) {
      setIsVerifyingStream(true);
      try {
        const bestUrl = await testServerSequentially(channel.servers);
        if (bestUrl) {
          setPreferredServerMap(prev => {
            const next = { ...prev, [normalizedName]: bestUrl };
            localStorage.setItem('preferredServerMap', JSON.stringify(next));
            return next;
          });
          setCurrentChannel(prev => (prev && prev.name === channel.name ? { ...prev, activeLink: bestUrl } : prev));
        }
      } finally {
        setIsVerifyingStream(false);
      }
    }
  };

  useEffect(() => {
    let isFetching = false;

    const fetchChannels = async () => {
      if (isFetching) return;
      isFetching = true;
      setIsLoading(true);
      setError('');
      try {
        // Prefer live primary source for playback URLs (tokens can be IP-bound).
        // GitHub channels.json is used as a secondary enrichment/fallback source.
        const GITHUB_SOURCE = 'https://raw.githubusercontent.com/gptrworldtech/iptv-stream-control/main/channels.json';
        const PRIMARY_LIVE_SOURCE = 'https://pastefy.app/ZH3tseJk/raw';
        const BACKUP_SOURCE = 'https://raw.githubusercontent.com/etcvai/ExtenderMax/refs/heads/main/iptv.m3u8';
        const POWER_SOURCE = 'https://server.vodep39240327.workers.dev/channel/raw?=m3u';
        
          const [githubRes, primaryRes, localTeluguRes, backupParsed, powerParsed] = await Promise.all([
           fetch(GITHUB_SOURCE, { cache: 'no-store' }),
           fetch(PRIMARY_LIVE_SOURCE, { cache: 'no-store' }),
            fetch('/telugu_local.json').then(r => r.ok ? r.json() : []),
            fetchAndParseM3U(BACKUP_SOURCE),
            fetchAndParseM3U(POWER_SOURCE)
        ]);

        const remoteChannels = githubRes.ok ? await githubRes.json() : [];
        const livePrimaryChannels = primaryRes.ok ? await primaryRes.json() : [];

        if (remoteChannels.length === 0 && livePrimaryChannels.length === 0) {
           throw new Error('Channel sources are unavailable right now.');
        }

        const normalizeName = normalizeChannelName;
        const mergeServerList = (primaryServers: any[] = [], remoteServers: any[] = [], primaryLink?: string, remoteLink?: string) => {
          const seed = [
            ...(primaryLink ? [{ name: 'Server 1', url: primaryLink }] : []),
            ...primaryServers,
            ...remoteServers,
            ...(remoteLink ? [{ name: 'Fallback', url: remoteLink }] : [])
          ].filter((s: any) => s && s.url);

          const deduped: { name: string; url: string; status?: 'online' | 'offline' | 'checking' }[] = [];
          const seen = new Map<string, number>();
          seed.forEach((s: any) => {
            if (!seen.has(s.url)) {
              deduped.push({
                name: s.name || `Server ${deduped.length + 1}`,
                url: s.url,
                status: s.status
              });
              seen.set(s.url, deduped.length - 1);
            } else {
              const idx = seen.get(s.url)!;
              if (!deduped[idx].status && s.status) {
                deduped[idx].status = s.status;
              }
            }
          });
          return deduped;
        };

        const mergedByName = new Map<string, any>();

        const addBaseChannel = (item: any, sourceLabel: string) => {
          const key = normalizeName(item.name);
          if (!key) return;
          if (!mergedByName.has(key)) {
            mergedByName.set(key, {
              name: item.name,
              logo: item.logo || '',
              group: item.group || '',
              link: item.link || '',
              tvgId: item.tvgId || '',
              servers: [] as { name: string; url: string; status?: 'online' | 'offline' | 'checking' }[]
            });
          }
          const target = mergedByName.get(key);
          target.name = target.name || item.name;
          target.logo = target.logo || item.logo || '';
          target.group = target.group || item.group || '';
          target.tvgId = target.tvgId || item.tvgId || '';
          target.link = target.link || item.link || '';
          const servers = Array.isArray(item.servers) && item.servers.length > 0
            ? item.servers
            : (item.link ? [{ name: sourceLabel, url: item.link }] : []);
          servers.forEach((srv: any, idx: number) => {
            const url = srv?.url;
            if (!url) return;
            if (!target.servers.some((existing: any) => existing.url === url)) {
              target.servers.push({
                name: srv.name || (servers.length > 1 ? `${sourceLabel} ${idx + 1}` : sourceLabel),
                url,
                status: srv.status
              });
            }
          });
        };

        // Only base channels from servers 1/2/3 should define the visible list.
        livePrimaryChannels.forEach((item: any) => addBaseChannel(item, 'Server 1'));
        remoteChannels.forEach((item: any) => addBaseChannel(item, 'Server 2'));

        const fallbackByName = new Map<string, { name: string; url: string }[]>();
        const addFallback = (name: string, label: string, url: string) => {
          const key = normalizeName(name);
          if (!key || !url || !mergedByName.has(key)) return;
          const list = fallbackByName.get(key) || [];
          if (!list.some(s => s.url === url)) {
            list.push({ name: label, url });
            fallbackByName.set(key, list);
          }
        };

        const normalizeGroup = (v: string) => (v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        const allowedGroupsNormalized = new Set([
          'hotstar', 'jioplus', 'jiostar', 'jiotv', 'jio', 'jio2', 'jio3', 'jiotvindip',
          'sunnxt', 'sonyww', 'sonyin', 'zee5in', 'zee5lite', 'zeesun'
        ]);
        const powerAllowed = (group: string) => {
          const g = (group || '').toLowerCase();
          return g.includes('zee5') || g.includes('sunnxt') || g.includes('sun nxt') || g.includes('zee') || g.includes('sun');
        };

        backupParsed
          .filter((c: any) => allowedGroupsNormalized.has(normalizeGroup(c.group || '')))
          .forEach((c: any) => addFallback(c.name, 'Backup', c.link));

        powerParsed
          .filter((c: any) => powerAllowed(c.group || ''))
          .forEach((c: any) => addFallback(c.name, 'Server 4', c.link));

        let baseChannels = Array.from(mergedByName.values()).map((channel: any) => {
          const key = normalizeName(channel.name);
          const fallbackServers = fallbackByName.get(key) || [];
          const combinedServers = mergeServerList(channel.servers || [], fallbackServers, channel.link);
          const firstOnlineServer = combinedServers.find((s) => s.status === 'online');
          return {
            ...channel,
            link: firstOnlineServer?.url || channel.link,
            servers: combinedServers.length > 0 ? combinedServers : channel.servers,
          };
        });
        
        // Initialize health as checking and probe in browser.
        const healthMap: Record<string, 'online' | 'offline' | 'checking'> = {};
        baseChannels.forEach((ch: any) => {
          const key = normalizeName(ch.name);
          if (key) healthMap[key] = 'checking';
        });
        setChannelHealth(prev => ({ ...prev, ...healthMap }));

        // Combine with local Telugu Local channels
        let finalChannels = [...baseChannels];
        if (localTeluguRes.length > 0) {
            finalChannels = [...finalChannels, ...localTeluguRes];
            setTeluguLocalChannels(localTeluguRes);
        }

        if (finalChannels.length === 0) {
            throw new Error("No channels obtained. Please wait for GitHub Action to finish.");
        }

        setChannels(finalChannels);
          
        let initialChannelToSet = null;
        try {
          const savedRecentNames = JSON.parse(localStorage.getItem('recentChannelNames') || '[]');
          if (Array.isArray(savedRecentNames)) {
            const resolvedRecents = savedRecentNames
              .map(name => finalChannels.find((c: any) => c.name === name))
              .filter(Boolean) as Channel[];
            setRecentChannels(resolvedRecents);
          }
          const savedPreferred = localStorage.getItem('preferredServerMap');
          if (savedPreferred) {
            setPreferredServerMap(JSON.parse(savedPreferred));
          }
          const savedLastName = localStorage.getItem('lastChannelName');
          if (savedLastName) {
            initialChannelToSet = finalChannels.find((c: any) => c.name === savedLastName);
          }
        } catch(e) {}
        
        if (!initialChannelToSet) {
          initialChannelToSet = finalChannels.find((c: any) => (c.name || '').toLowerCase() === 'star sports 1 telugu hd');
        }
        if (initialChannelToSet) {
          handleChannelSelect(initialChannelToSet);
        } else if (finalChannels.length > 0) {
          handleChannelSelect(finalChannels[0]);
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load channels. Please try again later.');
      } finally {
        setIsLoading(false);
        isFetching = false;
      }
    };

    fetchChannels();
    const hourlyRefresh = setInterval(fetchChannels, 60 * 60 * 1000);
    return () => clearInterval(hourlyRefresh);
  }, []);



  // Optimized EPG Fetch - Using multiple GitHub Pages links with CORS support
  const fetchEPG = async () => {
    if (Object.keys(epgData).length > 0 || isEpgLoading) return;
    setIsEpgLoading(true);
    setError('');
    try {
      const EPG_SOURCES = [
          'https://mitthu786.github.io/tvepg/jiotv/epg.xml.gz',
          'https://whythishome.github.io/epg/guides/dishtv.in_en.xml.gz',
          'https://mitthu786.github.io/tvepg/tataplay/epg.xml.gz'
      ];
      
      const combinedChannelMap: Record<string, string> = {};
      const combinedEpgMap: Record<string, Program[]> = {};
      let totalProgramsLoaded = 0;

      await Promise.all(EPG_SOURCES.map(async (epgUrl) => {
        try {
            const res = await fetch(epgUrl, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            
            const blob = await res.blob();
            let xmlText = '';
            
            try {
                const ds = new DecompressionStream('gzip');
                const decompressedStream = blob.stream().pipeThrough(ds);
                const decompressedBlob = await new Response(decompressedStream).blob();
                xmlText = await decompressedBlob.text();
            } catch (err) {
                console.warn(`Decompression failed for ${epgUrl}, using raw blob text`, err);
                xmlText = await blob.text();
            }
            
            if (!xmlText.trim().startsWith('<?xml')) {
                throw new Error('Retrieved content is not valid XML');
            }
            
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlText, 'application/xml');
            
            if (xml.getElementsByTagName('parsererror').length > 0) {
                throw new Error('XML parsing error');
            }
            
            const xmlChannels = xml.querySelectorAll('channel');
            xmlChannels.forEach(ch => {
                const id = ch.getAttribute('id') || '';
                const dn = ch.querySelector('display-name');
                if (id) combinedChannelMap[id] = dn?.textContent?.trim() || '';
            });
            
            const xmlProgrammes = xml.querySelectorAll('programme');
            xmlProgrammes.forEach(p => {
                const channelId = p.getAttribute('channel') || '';
                const start = p.getAttribute('start') || '';
                const stop = p.getAttribute('stop') || '';
                const title = p.querySelector('title')?.textContent || '';
                const desc = p.querySelector('desc')?.textContent || '';
                const icon = p.querySelector('icon')?.getAttribute('src') || '';
                
                if (channelId) {
                    if (!combinedEpgMap[channelId]) combinedEpgMap[channelId] = [];
                    combinedEpgMap[channelId].push({ title, start, end: stop, desc, icon });
                }
            });
            totalProgramsLoaded += xmlProgrammes.length;
        } catch (e) {
            console.error(`Failed to fetch EPG from ${epgUrl}:`, e);
        }
      }));
      
      setEpgChannelMap(combinedChannelMap);
      
      Object.keys(combinedEpgMap).forEach(key => {
        combinedEpgMap[key].sort((a, b) => a.start.localeCompare(b.start));
      });
      
      setEpgData(combinedEpgMap);
      console.log(`EPG Success: ${totalProgramsLoaded} programs loaded from multiple sources`);
    } catch (e: any) {
      console.error('EPG Error:', e);
      // Keep error message for UI if needed
    } finally {
      setIsEpgLoading(false);
    }
  };

  // Shared Utility: Parse XMLTV Date String
  const parseEpgDate = (s: string) => {
    if (!s || s.length < 14) return new Date();
    const y = parseInt(s.substring(0, 4));
    const mo = parseInt(s.substring(4, 6)) - 1;
    const d = parseInt(s.substring(6, 8));
    const h = parseInt(s.substring(8, 10));
    const mi = parseInt(s.substring(10, 12));
    const sec = parseInt(s.substring(12, 14));
    const tzPart = s.substring(15).trim();
    if (tzPart) {
      const sign = tzPart[0] === '+' ? 1 : -1;
      const tzH = parseInt(tzPart.substring(1, 3)) || 0;
      const tzM = parseInt(tzPart.substring(3, 5)) || 0;
      const utcMs = Date.UTC(y, mo, d, h, mi, sec) - sign * (tzH * 3600000 + tzM * 60000);
      return new Date(utcMs);
    }
    return new Date(y, mo, d, h, mi, sec);
  };

  useEffect(() => {
    // Wait for player to settle
    const timer = setTimeout(fetchEPG, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (currentChannel) {
      localStorage.setItem('lastChannelName', currentChannel.name);
      setRecentChannels(prev => {
        const filtered = prev.filter(c => c.name !== currentChannel.name);
        const updated = [currentChannel, ...filtered].slice(0, 10);
        localStorage.setItem('recentChannelNames', JSON.stringify(updated.map(c => c.name)));
        return updated;
      });
    }
  }, [currentChannel]);

  const toggleFullScreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await playerRef.current?.requestFullscreen();
        // @ts-ignore
        if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
          // @ts-ignore
          try { await window.screen.orientation.lock('landscape'); } catch (e) { console.warn('Orientation lock failed:', e); }
        }
      } catch (err: any) {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      }
    } else {
      document.exitFullscreen();
    }
  };

  const teluguKeywords = ['etv', 'gemini', 'maa', 'zee telugu', 'zee cinemalu', 'tv9', 'ntv', 'sakshi', 'abn', 'tv5', 'v6', '10 tv', '10tv', '99 tv', '99tv', 'hmtv', 'i news', 'inews', 'mahaa', 'studio n', 'telugu', 'bharat today', 'cv r', 'cvr', 'raj news'];
  const teluguNewsKeywords = ['tv9', 'ntv', 'sakshi', 'abn', 'tv5', 'v6', '10 tv', '10tv', '99 tv', '99tv', 'hmtv', 'i news', 'inews', 'mahaa', 'studio n', 'bharat today', 'cv r', 'cvr', 'raj news', 'news'];

  const getChannelPriority = (channel: Channel) => {
    const name = (channel.name || '').toLowerCase();
    const group = (channel.group || '').toLowerCase();

    if (name.includes('star maa hd')) return 0;

    const isTelugu = teluguKeywords.some(kw => name.includes(kw) || group.includes('telugu'));
    const isHD = name.includes('hd');
    const isNews = teluguNewsKeywords.some(kw => name.includes(kw)) || group.includes('news');
    const isSports = group.includes('sports') || name.includes('sports');

    if (isTelugu) {
      if (isNews) return 3; // Telugu News at the end of Telugu list
      if (isHD) return 1;   // Telugu HD first
      return 2;             // Telugu General next
    }

    if (isHD) return 4;
    if (isSports) return 5;
    return 6;
  };

  const sortedChannels = [...channels].sort((a, b) => {
    return getChannelPriority(a) - getChannelPriority(b);
  });

  const getChannelCategories = (channel: Channel) => {
    const name = (channel.name || '').toLowerCase();
    const group = (channel.group || '').toLowerCase();
    const cats = [];

    if (group.includes('movie') || name.includes('movie') || name.includes('cinema')) cats.push('Movies');
    
    if (group.includes('sport') || name.includes('sport')) {
      cats.push('Sports');
      if (name.includes('star sports') || name.includes('starsports')) {
        cats.push('Star Sports');
      } else if (name.includes('sony') || name.includes('ten 1') || name.includes('ten 2') || name.includes('ten 3') || name.includes('ten 4') || name.includes('ten 5')) {
        cats.push('Sony Sports');
      } else {
        cats.push('Other Sports');
      }
    }

    if (name.includes('star sports') || name.includes('starsports') || name.includes('ipl')) cats.push('IPL 2026');
    if (group.includes('news') || name.includes('news')) cats.push('News');
    if (group.includes('music') || name.includes('music')) cats.push('Music');
    if (group.includes('vt 📺 | local channel telugu') || group.includes('local channel telugu')) cats.push('Telugu Local');
    if (group.includes('infotainment') || group.includes('knowledge') || group.includes('kids') || group.includes('lifestyle') || name.includes('discovery') || name.includes('history') || name.includes('national geographic')) cats.push('Infotainment');
    
    if (cats.length === 0) cats.push('Entertainment');
    return cats;
  };

  const playChannelByName = (searchName: string) => {
    const normalizedSearch = searchName.toLowerCase().replace(/\s+/g, '');
    const channel = channels.find(c => (c.name || '').toLowerCase().replace(/\s+/g, '') === normalizedSearch) ||
                    channels.find(c => (c.name || '').toLowerCase().replace(/\s+/g, '').includes(normalizedSearch));
    if (channel) {
      handleChannelSelect(channel);
    } else {
      console.warn(`Channel not found: ${searchName}`);
    }
  };

  const filteredChannels = sortedChannels.filter(channel => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (channel.name || '').toLowerCase().includes(term) || 
                          (channel.group || '').toLowerCase().includes(term);
    
    const matchesCategory = selectedCategory === 'All' || getChannelCategories(channel).includes(selectedCategory);

    return matchesSearch && matchesCategory;
  });


  // Efficient Background Channel Prober
  // Background cache stores the first working server per channel so clicks can skip dead links.
  useEffect(() => {
    if (isLoading || filteredChannels.length === 0) return;

    const probeBatch = async () => {
      // Find channels without a preferred server and probe them in small batches
      const unverified = filteredChannels.filter(c => {
        const key = normalizeChannelName(c.name);
        return !preferredServerMap[key];
      });

      if (unverified.length === 0) return;

      // Small batch (3) to maximize performance and avoid network congestion
      const batch = unverified.slice(0, 3);
      
      batch.forEach(async (channel) => {
        const bestServerUrl = await testServerSequentially(channel.servers && channel.servers.length > 0 ? channel.servers : [{ name: 'Main', url: channel.link }]);
        if (bestServerUrl) {
          const key = normalizeChannelName(channel.name);
          setPreferredServerMap(prev => {
            const next = { ...prev, [key]: bestServerUrl };
            localStorage.setItem('preferredServerMap', JSON.stringify(next));
            return next;
          });
        }
      });
    };

    const interval = setInterval(probeBatch, 5000); 
    return () => clearInterval(interval);
  }, [filteredChannels, preferredServerMap, isLoading]);

  // Load Health Cache on Mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('channelHealthCache');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Clean up 'checking' states from previous session
        const cleaned = Object.keys(parsed).reduce((acc: any, key) => {
            if (parsed[key] !== 'checking') acc[key] = parsed[key];
            return acc;
        }, {});
        setChannelHealth(cleaned);
      }
    } catch(e) {}
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 font-sans flex flex-col overflow-x-hidden">
      {/* Install Banner */}
      {showInstallBanner && (
        <div className="w-full bg-gradient-to-r from-red-600 via-orange-500 to-indigo-600 text-white py-1 px-4 flex items-center justify-between sticky top-0 z-[100] shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
          <div className="flex-1 overflow-hidden mr-4">
            {/* @ts-ignore - marquee is deprecated but supported across all browsers for simple scrolling */}
            <marquee className="font-bold text-sm pt-1">Install Page... Live TV App ని మొబైల్ ఆప్ లా ఇన్స్టాల్ చేసుకోండి...</marquee>
          </div>
          <button 
            onClick={async () => {
              if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') setShowInstallBanner(false);
                setDeferredPrompt(null);
              }
            }}
            className="whitespace-nowrap bg-white text-indigo-700 px-3 py-1.5 text-xs font-black rounded-full shadow hover:bg-slate-100 transition-colors"
          >
            Install App
          </button>
        </div>
      )}

      {/* Topbar removed for minimalist design */}

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full">

        <div className="p-[25px] flex-1">
          {/* Header Section */}
          <div className="flex items-center justify-center gap-4 mb-8 mt-2">
            <img 
              src="https://ik.imagekit.io/kff5oshkqj/IMG_20250911_201953.jpg?updatedAt=1764274502089" 
              alt="Gandreti Raghu Logo" 
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] object-cover animate-pulse"
            />
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-wider text-white glowing-text">
              {'GANDRETI RAGHU'.split('').map((char, i) => (
                <span key={i} style={{ animationDelay: `${-i * (2 / 14)}s` }}>
                  {char}
                </span>
              ))}
            </h1>
          </div>

          {/* Video Player Section */}
          <div className="w-full max-w-5xl mx-auto mb-8">
            {currentChannel ? (
              <div ref={playerRef} className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-slate-700 relative group">
                <iframe
                  key={currentChannel.activeLink || currentChannel.link}
                  src={currentChannel.activeLink || currentChannel.link}
                  className="w-full h-full border-0"
                  allow="autoplay *; encrypted-media *; fullscreen *"
                ></iframe>
                {/* Fallback Buttons & Loader */}
                {isVerifyingStream && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                       <Loader2 className="w-10 h-10 animate-spin text-white mb-2" />
                       <span className="text-white text-sm font-semibold tracking-wide">Connecting...</span>
                    </div>
                )}
                {!isVerifyingStream && currentChannel.servers && currentChannel.servers.length > 1 && showServerToggle && (
                    <button 
                      onClick={() => {
                        const currentServers = currentChannel.servers!;
                        const activeIndex = currentServers.findIndex(s => s.url === currentChannel.activeLink);
                        const nextIndex = (activeIndex + 1) % currentServers.length;
                        const nextServer = currentServers[nextIndex];

                        setCurrentChannel({...currentChannel, activeLink: nextServer.url});
                        
                        // Server Toggle Visibility Timer (15 seconds)
                        setShowServerToggle(true);
                        if (serverToggleTimerRef.current) clearTimeout(serverToggleTimerRef.current);
                        serverToggleTimerRef.current = setTimeout(() => setShowServerToggle(false), 15000);
                      }}
                      className={`absolute bottom-16 right-4 sm:bottom-20 sm:right-6 bg-indigo-600/90 hover:bg-indigo-500 text-white px-4 py-2 text-xs sm:text-sm font-bold rounded-lg shadow-xl backdrop-blur-sm z-30 transition-all border border-white/20 flex items-center gap-2 ${showServerToggle ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'}`}
                      title="Switch Video Server"
                    >
                       🔄 Change Server: {currentChannel.servers.find(s => s.url === currentChannel.activeLink)?.name || 'Server 1'}
                    </button>
                )}

                <div className="absolute bottom-[20%] right-4 sm:bottom-[25%] sm:right-6 pointer-events-none opacity-[0.2] mix-blend-overlay text-white font-black tracking-widest text-[10px] sm:text-xl select-none z-10 text-right">
                  GANDRETI RAGHU
                </div>
                <button 
                  onClick={toggleFullScreen}
                  className="hidden sm:block absolute bottom-2 right-4 sm:bottom-4 sm:right-6 bg-black/40 hover:bg-black/80 text-white p-2.5 rounded-lg backdrop-blur-sm border border-white/20 transition-all z-20 opacity-100"
                  title="Full Screen Wrapper"
                >
                  <Maximize className="w-5 h-5 sm:w-7 sm:h-7 drop-shadow-md" />
                </button>
                <div className="absolute top-4 left-4 bg-black/70 px-3 py-1.5 rounded-md backdrop-blur-md border border-white/10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                  <span className="text-white text-xs font-semibold tracking-wide">{currentChannel.name}</span>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-video bg-slate-800/50 rounded-xl flex flex-col items-center justify-center border-2 border-slate-700 border-dashed">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 shadow-inner">
                  <PlayCircle className="w-8 h-8 text-slate-500" />
                </div>
                <p className="text-slate-400 font-medium text-sm sm:text-base">Select a channel below to start watching</p>
              </div>
            )}

            {/* Minimalist EPG (Now Playing + Up Next) */}
            {currentChannel && Object.keys(epgData).length > 0 && (() => {
              const tvgId = currentChannel.tvgId || "";
              let currentProgs = epgData[tvgId] || [];
              if (currentProgs.length === 0) {
                const mappedId = Object.keys(epgChannelMap).find(id => epgChannelMap[id].toLowerCase() === currentChannel.name.toLowerCase());
                if (mappedId) currentProgs = epgData[mappedId] || [];
              }

              if (currentProgs.length === 0) return null;

              const now = new Date();
              const liveProg = currentProgs.find(p => {
                const s = parseEpgDate(p.start);
                const e = parseEpgDate(p.end);
                return now >= s && now <= e;
              });

              if (!liveProg) return null;
              
              const liveStartIndex = currentProgs.indexOf(liveProg);
              const nextProg = currentProgs[liveStartIndex + 1];
              
              const start = parseEpgDate(liveProg.start);
              const end = parseEpgDate(liveProg.end);
              const progress = Math.min(100, ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);

              return (
                <div className="mt-3 bg-slate-800/40 backdrop-blur-xl border border-white/5 rounded-xl p-3 sm:p-4 shadow-lg animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Now Playing Column */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-tight">
                          <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></span>
                          Now Playing
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-indigo-400 transition-colors">
                        {liveProg.title}
                      </h3>
                      {/* Live Progress Bar */}
                      <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden w-full max-w-sm">
                        <div 
                          className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Up Next Column */}
                    {nextProg && (
                      <div className="flex-1 min-w-0 sm:border-l border-white/10 sm:pl-6">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-tight">
                            Up Next
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {parseEpgDate(nextProg.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-300 truncate">
                          {nextProg.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          Starts in {Math.round((parseEpgDate(nextProg.start).getTime() - now.getTime()) / 60000)} mins
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* History/Recent Channels */}
          {recentChannels.length > 0 && (
            <div className="mb-8 w-full max-w-5xl mx-auto">
              <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider px-1">Recently Watched TV</h3>
              <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {recentChannels.map((channel, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentChannel(channel);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`min-w-[80px] sm:min-w-[100px] max-w-[80px] sm:max-w-[100px] flex-shrink-0 bg-slate-800 rounded-lg p-2 border transition-all duration-300 flex flex-col items-center justify-center gap-2 hover:scale-105 ${currentChannel?.link === channel.link ? 'border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'border-slate-700 hover:border-slate-500'}`}
                  >
                    <div className="h-8 sm:h-10 w-full flex items-center justify-center bg-slate-900 rounded">
                      <img src={channel.logo} alt={channel.name} className="max-h-full max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/fallback/100/100'; }} />
                    </div>
                    <span className="text-[0.6rem] sm:text-xs text-slate-300 font-medium truncate w-full text-center block" title={channel.name}>{channel.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Access Toolbar */}
          <div className="grid grid-cols-2 lg:flex lg:flex-row gap-3 sm:gap-4 mb-8 w-full max-w-5xl mx-auto items-center">
            
            {/* IPL 2026 Dropdown (First) */}
            <div className={`relative ${isIplDropdownOpen ? 'z-[60]' : 'z-50'} col-span-2 sm:col-span-1`}>
              <button 
                onClick={() => setIsIplDropdownOpen(!isIplDropdownOpen)}
                className="w-full group px-4 py-2 rounded-lg border border-transparent transition-all duration-300 flex items-center justify-center sm:justify-start gap-2 relative overflow-hidden"
              >
                {/* Rainbow Glow & Border */}
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 opacity-60 blur-md animate-rainbow"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 animate-rainbow"></div>
                <div className="absolute inset-[2px] bg-slate-800/80 rounded-md z-0 transition-colors"></div>
                
                <img 
                  src="https://documents.iplt20.com//ipl/assets/images/ipl-logo-new-old.png" 
                  alt="IPL" 
                  className="h-5 w-auto object-contain relative z-10 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-sm font-bold text-white relative z-10 drop-shadow-md">IPL 2026</span>
                <ChevronDown className={`w-4 h-4 text-white relative z-10 transition-transform duration-300 ${isIplDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* IPL Dropdown Menu */}
              {isIplDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full sm:w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                  {[
                    'Star Sports 1 Telugu HD',
                    'Star Sports 2 Telugu HD',
                    'Star Sports 1',
                    'Star Sports 1 HD',
                    'Star Sports 1 Hindi',
                    'Star Sports 1 Hindi HD',
                    'Star Sports 1 Tamil HD',
                    'Star Sports 2 Tamil HD',
                    'Star Sports 1 Kannada HD',
                    'Star Sports 2 Kannada HD'
                  ].map(name => (
                    <button 
                      key={name}
                      onClick={() => { playChannelByName(name); setIsIplDropdownOpen(false); }}
                      className={`block w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-slate-700/50 ${currentChannel?.name?.toLowerCase().replace(/\s+/g, '').includes(name.toLowerCase().replace(/\s+/g, '')) ? 'bg-yellow-500/20 text-yellow-400' : 'text-slate-200 hover:bg-slate-700 hover:text-white'}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Telugu Local Dropdown */}
            <div className={`relative ${isTeluguLocalDropdownOpen ? 'z-[60]' : 'z-50'} col-span-2 sm:col-span-1`}>
              <button 
                onClick={async () => {
                  setIsTeluguLocalDropdownOpen(!isTeluguLocalDropdownOpen);
                  if (teluguLocalChannels.length === 0 && !isTeluguLocalLoading) {
                    setIsTeluguLocalLoading(true);
                    try {
                      const res = await fetch('/telugu_local.json');
                      if (res.ok) {
                         const channels = await res.json();
                         setTeluguLocalChannels(channels);
                      }
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setIsTeluguLocalLoading(false);
                    }
                  }
                }}
                className="w-full group px-4 py-2 rounded-lg border border-slate-700 hover:border-indigo-500 transition-all duration-300 flex items-center justify-center sm:justify-start gap-2 relative overflow-hidden bg-slate-800"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                <Tv className="w-4 h-4 text-indigo-400 relative z-10" />
                <span className="text-sm font-bold text-indigo-400 relative z-10 drop-shadow-md tracking-wider uppercase">Telugu Local 📺</span>
                {isTeluguLocalLoading ? <Loader2 className="w-4 h-4 text-indigo-400 animate-spin relative z-10" /> : <ChevronDown className={`w-4 h-4 text-indigo-400 relative z-10 transition-transform duration-300 ${isTeluguLocalDropdownOpen ? 'rotate-180' : ''}`} />}
              </button>

              {/* Telugu Local Dropdown Menu */}
              {isTeluguLocalDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full sm:w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                  {isTeluguLocalLoading ? (
                      <div className="px-4 py-6 text-sm text-center text-slate-400 flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                        <span>Scanning Local Channels...</span>
                      </div>
                  ) : teluguLocalChannels.length > 0 ? teluguLocalChannels.map((ch, idx) => (
                    <button 
                      key={idx}
                      onClick={() => { handleChannelSelect(ch); setIsTeluguLocalDropdownOpen(false); }}
                      className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-slate-700/50 ${currentChannel?.link === ch.link ? 'bg-indigo-500/20 text-indigo-400 font-bold' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                    >
                      <div className="w-6 h-6 flex-shrink-0">
                        <img src={ch.logo} className="w-full h-full object-contain" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <span className="truncate">{ch.name || `Channel ${idx + 1}`}</span>
                    </button>
                  )) : (
                     <div className="px-4 py-4 text-sm text-center text-slate-400">
                        No local channels found.
                     </div>
                  )}
                </div>
              )}
            </div>

            {/* Sports Dropdown */}
            <div className={`relative ${isSportsDropdownOpen ? 'z-[60]' : 'z-50'}`}>
              <button 
                onClick={() => setIsSportsDropdownOpen(!isSportsDropdownOpen)}
                className={`w-full group px-4 py-2 rounded-lg border transition-all duration-300 flex items-center justify-center sm:justify-start gap-2 hover:border-indigo-500 hover:bg-slate-700/50 ${
                  ['Sports', 'Star Sports', 'Sony Sports', 'Other Sports'].includes(selectedCategory)
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <Dribbble className={`w-4 h-4 ${['Sports', 'Star Sports', 'Sony Sports', 'Other Sports'].includes(selectedCategory) ? 'text-indigo-400' : 'text-indigo-400 group-hover:text-indigo-300'}`} />
                <span className="text-sm font-medium group-hover:text-white">
                  {['Star Sports', 'Sony Sports', 'Other Sports'].includes(selectedCategory) ? selectedCategory : 'Sports'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isSportsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isSportsDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full sm:w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  <button 
                    onClick={() => { setSelectedCategory('Star Sports'); setIsSportsDropdownOpen(false); }}
                    className={`block w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-slate-700/50 ${selectedCategory === 'Star Sports' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-200 hover:bg-slate-700 hover:text-white'}`}
                  >
                    Star Sports
                  </button>
                  <button 
                    onClick={() => { setSelectedCategory('Sony Sports'); setIsSportsDropdownOpen(false); }}
                    className={`block w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-slate-700/50 ${selectedCategory === 'Sony Sports' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-200 hover:bg-slate-700 hover:text-white'}`}
                  >
                    Sony Sports
                  </button>
                  <button 
                    onClick={() => { setSelectedCategory('Other Sports'); setIsSportsDropdownOpen(false); }}
                    className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedCategory === 'Other Sports' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-200 hover:bg-slate-700 hover:text-white'}`}
                  >
                    Other Sports
                  </button>
                </div>
              )}
            </div>

            {/* Telugu Dropdown */}
            <div className={`relative ${isTeluguDropdownOpen ? 'z-[60]' : 'z-50'}`}>
              <button 
                onClick={() => setIsTeluguDropdownOpen(!isTeluguDropdownOpen)}
                className="w-full group px-4 py-2 rounded-lg border border-transparent transition-all duration-300 flex items-center justify-center sm:justify-start gap-2 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 opacity-60 blur-md animate-rainbow"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 animate-rainbow"></div>
                <div className="absolute inset-[2px] bg-slate-800/80 rounded-md z-0 transition-colors"></div>
                
                <Tv className="w-5 h-5 text-white relative z-10 opacity-90 sm:opacity-80 group-hover:opacity-100" />
                <span className="text-sm font-bold text-white relative z-10 drop-shadow-md">తెలుగు</span>
                <ChevronDown className={`w-4 h-4 text-white relative z-10 transition-transform duration-300 ${isTeluguDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Telugu Dropdown Menu */}
              {isTeluguDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full sm:w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden max-h-72 overflow-y-auto">
                  {sortedChannels.filter(c => teluguKeywords.some(kw => (c.name || '').toLowerCase().includes(kw) || (c.group || '').toLowerCase().includes('telugu'))).map((channel, i) => (
                    <button 
                      key={i}
                      onClick={() => { handleChannelSelect(channel); setIsTeluguDropdownOpen(false); }}
                      className={`flex w-full items-center gap-3 text-left px-4 py-2 text-sm transition-colors border-b border-slate-700/50 ${currentChannel?.link === channel.link ? 'bg-orange-500/20 text-orange-400' : 'text-slate-200 hover:bg-slate-700 hover:text-white'}`}
                    >
                      <img src={channel.logo} className="w-6 h-6 object-contain" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <span>{channel.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>


            {/* Fancode Live Events Dropdown */}
            <div className={`relative ${isFancodeDropdownOpen ? 'z-[60]' : 'z-50'} col-span-2 sm:col-span-1`}>
              <button 
                onClick={async () => {
                  setIsFancodeDropdownOpen(!isFancodeDropdownOpen);
                  if (fancodeChannels.length === 0 && !isFancodeLoading) {
                    setIsFancodeLoading(true);
                    try {
                      const proxyPrefix = 'https://proxy.lrl45.workers.dev/?url=';
                      const channelsMap = new Map<string, Channel>();

                      const fetchServer = async (url: string, parser: (data: any) => void) => {
                        try {
                          const res = await fetch(url);
                          if (res.ok) {
                             const data = await res.json();
                             parser(data);
                          }
                        } catch(e) { console.error('Fancode fetch error:', e); }
                      };

                      await Promise.all([
                         // Source 1
                         fetchServer('https://fcapi.amitbala1993.workers.dev/', (data) => {
                            if (data && data.matches && Array.isArray(data.matches)) {
                                data.matches.forEach((m: any) => {
                                    if (m.status === 'started' || m.status === 'live' || m.status === 'LIVE') {
                                        const url = m.urls ? (m.urls['1080p'] || m.urls['720p']) : m.url;
                                        if (url) {
                                            const title = m.match || m.title || "Live Match";
                                            channelsMap.set(title, {
                                               name: title,
                                               group: "Fancode Live",
                                               logo: m.image || m.src || "https://upload.wikimedia.org/wikipedia/commons/e/e6/Fancode_logo.png",
                                               link: `${proxyPrefix}${encodeURIComponent(url)}`
                                            });
                                        }
                                    }
                                });
                            }
                         }),
                         // Source 2
                         fetchServer('https://fanco.vodep39240327.workers.dev/', (data) => {
                            if (data && data.matches && Array.isArray(data.matches)) {
                                data.matches.forEach((m: any) => {
                                    if (m.status === 'LIVE' || m.status === 'started' || m.status === 'live') {
                                        const url = m.adfree_url || m.dai_url;
                                        if (url) {
                                            const title = m.title || m.match_name || "Live Match";
                                            // Prefer setting if not exists to avoid dupes purely from title
                                            if (!channelsMap.has(title)) {
                                                channelsMap.set(title, {
                                                   name: title,
                                                   group: "Fancode Live",
                                                   logo: m.src || m.image || "https://upload.wikimedia.org/wikipedia/commons/e/e6/Fancode_logo.png",
                                                   link: `${proxyPrefix}${encodeURIComponent(url)}`
                                                });
                                            }
                                        }
                                    }
                                });
                            }
                         })
                      ]);

                      setFancodeChannels(Array.from(channelsMap.values()));
                    } catch (err) {
                      console.error('Failed to load Fancode:', err);
                    } finally {
                      setIsFancodeLoading(false);
                    }
                  }
                }}
                className="w-full group px-4 py-2 rounded-lg border border-transparent transition-all duration-300 flex items-center justify-center sm:justify-start gap-2 relative overflow-hidden bg-slate-800"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-600 opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <img 
                  src="https://play-lh.googleusercontent.com/lp1Tdhp75MQyrHqrsyRBV74HxoL3Ko8KRAjOUI1wUHREAxuuVwKR6vnamgvMEn4C4Q" 
                  alt="Fancode" 
                  className="w-4 h-4 rounded-sm transition-all duration-300 relative z-10" 
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/fancode/16/16'; }}
                />
                <span className="text-sm font-bold text-orange-400 relative z-10 drop-shadow-md tracking-wider uppercase">Fancode</span>
                {isFancodeLoading ? <Loader2 className="w-4 h-4 text-orange-400 animate-spin relative z-10" /> : <ChevronDown className={`w-4 h-4 text-orange-400 relative z-10 transition-transform duration-300 ${isFancodeDropdownOpen ? 'rotate-180' : ''}`} />}
              </button>

              {/* Fancode Dropdown Menu */}
              {isFancodeDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full sm:w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                  {isFancodeLoading ? (
                      <div className="px-4 py-6 text-sm text-center text-slate-400 flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
                        <span>Loading Live Matches...</span>
                      </div>
                  ) : fancodeChannels.length > 0 ? fancodeChannels.map((ch, idx) => (
                    <button 
                      key={idx}
                      onClick={() => { handleChannelSelect(ch); setIsFancodeDropdownOpen(false); }}
                      className={`flex items-center gap-3 w-full text-left px-4 py-2 text-sm transition-colors border-b border-slate-700/50 hover:bg-slate-700 ${currentChannel?.link === ch.link ? 'bg-orange-500/20 text-orange-400' : 'text-slate-200 hover:text-white'}`}
                    >
                      <div className="relative w-12 h-8 flex-shrink-0 bg-slate-900 rounded overflow-hidden flex items-center justify-center border border-white/5">
                        <img src={ch.logo} className="w-full h-full object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                         <span className="font-semibold truncate w-full">{ch.name || `Match ${idx + 1}`}</span>
                         <span className="text-[10px] text-red-400 font-bold tracking-wider uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            Live Now
                         </span>
                      </div>
                    </button>
                  )) : (
                     <div className="px-4 py-6 text-sm text-center text-slate-400">
                        No live matches happening right now.
                     </div>
                  )}
                </div>
              )}
            </div>

            {/* Music Button */}
            <a href="https://gandrettiraghu.vercel.app/" className="w-full sm:w-auto group bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 transition-all duration-300 flex items-center justify-center sm:justify-start gap-2 hover:border-indigo-500 hover:bg-slate-700/50">
              <Music className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" />
              <span className="text-sm font-medium text-slate-200 group-hover:text-white">Music Player</span>
            </a>
            <button onClick={() => setShowEPG(true)} className="w-full sm:w-auto group px-4 py-2 rounded-lg border border-transparent transition-all duration-300 flex items-center justify-center sm:justify-start gap-2 relative overflow-hidden hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 opacity-80"></div>
              <div className="absolute inset-[1.5px] bg-slate-800/90 rounded-[6px] z-0"></div>
              <Tv className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 relative z-10" />
              <span className="text-sm font-bold text-white relative z-10">📺 TV Guide</span>
              {Object.keys(epgData).length > 0 && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse relative z-10"></span>}
            </button>
          </div>

          {/* Channel Grid Section */}
          <div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-[15px]">
              <h2 className="text-[1.2rem] font-bold">Live Channels</h2>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-full max-w-[400px] mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="search" 
                placeholder="Search channels..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 py-2 pr-[15px] pl-[35px] rounded-lg text-sm text-white outline-none transition-all duration-300 focus:border-indigo-500 focus:shadow-[0_0_0_2px_rgba(99,102,241,0.2)]"
              />
            </div>

            {/* Categories */}
            <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {['All', 'IPL 2026', 'Telugu Local', 'Entertainment', 'Movies', 'Sports', 'Infotainment', 'News', 'Music'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-[0.8rem] font-medium whitespace-nowrap transition-all duration-300 ${
                    selectedCategory === cat 
                      ? 'bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.4)] border-transparent' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Dynamic List Container */}
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-3 pb-[40px]">
              
              {/* Loading State */}
              {isLoading && (
                <div className="col-span-full text-center p-10 text-slate-400 flex flex-col items-center">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                  <p>Loading channels...</p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="col-span-full text-center p-10 text-red-500">
                  <p>{error}</p>
                </div>
              )}

              {/* Dynamic Channels */}
              {!isLoading && !error && filteredChannels.map((channel, index) => (
                <div 
                  key={index} 
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  <button 
                    onClick={() => handleChannelSelect(channel)} 
                    className="block h-full w-full text-left focus:outline-none relative"
                  >
                      {/* Auto Routing Badge */}
                      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 border border-white/10 backdrop-blur-sm pointer-events-none transition-transform group-hover:scale-110">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-pulse"></span>
                        <span className="text-[9px] font-bold tracking-wide text-cyan-100 uppercase">AUTO</span>
                      </div>

                    <div className={`group bg-slate-800 rounded-lg overflow-hidden border transition-all duration-300 relative flex flex-col h-full hover:scale-[1.05] hover:shadow-[0_5px_15px_rgba(0,0,0,0.3)] hover:z-10 ${currentChannel?.link === channel.link ? 'border-orange-500 ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.8)] z-10 bg-slate-700/50 scale-[1.02]' : 'border-slate-700 hover:border-indigo-500'}`}>
                      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 bg-[radial-gradient(circle_at_center,#2d3748_0%,#1e293b_70%)]">
                        <img 
                          src={channel.logo} 
                          alt={channel.name || 'Channel Logo'} 
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/fallback/100/100';
                          }}
                          className="h-10 sm:h-14 w-auto max-w-[90%] object-contain transition-transform duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] group-hover:scale-110"
                        />
                      </div>
                      <div className="p-1.5 sm:p-3 bg-slate-900/50 border-t border-slate-700 text-center min-h-[40px] sm:min-h-[60px] flex flex-col justify-center">
                        <h2 className={`text-[0.6rem] sm:text-[0.8rem] leading-tight font-semibold mb-0.5 line-clamp-2 ${currentChannel?.link === channel.link ? 'text-indigo-400' : 'text-slate-50'}`}>{channel.name || 'Unknown Channel'}</h2>
                        <p className="text-[0.5rem] sm:text-[0.65rem] text-slate-400 truncate">{channel.group || 'General'}</p>
                      </div>
                    </div>
                  </button>
                </div>
              ))}

            </div>
          </div>
        </div>
        
        <footer className="text-center p-5 text-slate-400 text-[0.8rem] border-t border-slate-700 mt-auto shrink-0 space-y-2">
          <p className="max-w-3xl mx-auto">
            Disclaimer: This website is for educational purposes only. The links provided are not hosted on our servers but are collected from various sources on the internet.
          </p>
          <p>&copy; {new Date().getFullYear()} Gandreti Raghu. All rights reserved.</p>
        </footer>
      </div>

      {/* EPG / TV Guide Overlay Panel */}
      {showEPG && (
        <div className="fixed inset-0 z-[200]" onClick={() => setShowEPG(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
          
          {/* Side Panel */}
          <div 
            className="absolute right-0 top-0 h-full w-[380px] max-w-[90vw] flex flex-col"
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
              animation: 'slideInRight 0.3s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">TV Guide</h2>
                {Object.keys(epgData).length > 0 && (
                  <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-semibold">LIVE</span>
                )}
              </div>
              <button 
                onClick={() => setShowEPG(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            
            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
              {isEpgLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-slate-400 text-sm">Loading TV Guide...</p>
                </div>
              ) : Object.keys(epgData).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
                  <div className="relative">
                    <Tv className="w-16 h-16 text-slate-700" />
                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-400 rounded-full animate-ping"></div>
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-1">EPG data unavailable</h3>
                    <p className="text-slate-400 text-xs px-4">The guide data failed to load. This can happen due to poor internet connection.</p>
                  </div>
                  <button 
                    onClick={() => fetchEPG()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95"
                  >
                    Retry Connection
                  </button>
                </div>
              ) : (() => {
                const tvgId = currentChannel?.tvgId || '';
                let currentProgs = epgData[tvgId] || [];
                
                // Smart matching fallback: match by channel name if tvgId fails
                if (currentProgs.length === 0 && currentChannel?.name) {
                  const mappedId = Object.keys(epgChannelMap).find(id => 
                    epgChannelMap[id].toLowerCase() === currentChannel.name.toLowerCase()
                  );
                  if (mappedId) currentProgs = epgData[mappedId] || [];
                }

                const epgName = epgChannelMap[tvgId] || currentChannel?.name || '';
                
                const parseEpgDateWrapper = (s: string) => parseEpgDate(s);
                
                const now = new Date();
                const todayProgs = currentProgs.filter(p => {
                  const endTime = parseEpgDate(p.end);
                  return endTime > now;
                }).slice(0, 30);
                
                const otherChannelsWithEpg = channels
                  .filter(ch => ch.tvgId && epgData[ch.tvgId] && ch.name !== currentChannel?.name)
                  .slice(0, 20);
                
                return (
                  <>
                    {currentChannel && (
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <img src={currentChannel.logo} alt="" className="w-8 h-8 object-contain rounded bg-slate-800 p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <div>
                            <h3 className="text-sm font-bold text-white">{currentChannel.name}</h3>
                            {epgName && epgName !== currentChannel.name && (
                              <p className="text-[10px] text-slate-500">{epgName}</p>
                            )}
                          </div>
                        </div>
                        
                        {todayProgs.length > 0 ? (
                          <div className="space-y-1">
                            {todayProgs.map((prog, idx) => {
                            const startTime = parseEpgDate(prog.start);
                              const endTime = parseEpgDate(prog.end);
                              const isLive = now >= startTime && now <= endTime;
                              const isPast = endTime < now;
                              const progress = isLive ? Math.min(100, ((now.getTime() - startTime.getTime()) / (endTime.getTime() - startTime.getTime())) * 100) : 0;
                              
                              return (
                                <div 
                                  key={idx}
                                  className={`rounded-lg p-3 border transition-all duration-200 ${
                                    isLive 
                                      ? 'bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                                      : isPast
                                        ? 'bg-slate-800/30 border-slate-700/30 opacity-50'
                                        : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    {prog.icon && (
                                      <img src={prog.icon} alt="" className="w-12 h-8 object-cover rounded flex-shrink-0 mt-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        {isLive && (
                                          <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                            LIVE
                                          </span>
                                        )}
                                        <span className="text-xs font-semibold text-white truncate">{prog.title}</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                        <Clock className="w-3 h-3" />
                                        <span>
                                          {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} — {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </span>
                                      </div>
                                      {prog.desc && (
                                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{prog.desc}</p>
                                      )}
                                    </div>
                                  </div>
                                  {isLive && (
                                    <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                                        style={{ width: `${progress}%` }}
                                      ></div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <p className="text-slate-500 text-xs">No programme data available for this channel</p>
                            {!currentChannel.tvgId && (
                              <p className="text-slate-600 text-[10px] mt-1">Channel has no EPG mapping</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {otherChannelsWithEpg.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-white/10">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Other Channels - Now On</h4>
                        <div className="space-y-2">
                          {otherChannelsWithEpg.map((ch, idx) => {
                            const chProgs = epgData[ch.tvgId!] || [];
                            const liveProg = chProgs.find(p => {
                              const s = parseEpgDate(p.start);
                              const e = parseEpgDate(p.end);
                              return now >= s && now <= e;
                            });
                            if (!liveProg) return null;
                            return (
                              <button
                                key={idx}
                                onClick={() => { handleChannelSelect(ch); }}
                                className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] transition-all text-left"
                              >
                                <img src={ch.logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-white truncate">{ch.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{liveProg.title}</p>
                                </div>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0"></span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* EPG slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
