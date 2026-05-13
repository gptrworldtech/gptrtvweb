import { Stream } from "./types";

export const parseM3U = (text: string): Stream[] => {
  const lines = text.split(/\r?\n/);
  const streams: Stream[] = [];
  let currentStream: Partial<Stream> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.startsWith('#EXTINF:')) {
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      if (logoMatch) currentStream.logo = logoMatch[1];
      
      const groupMatch = line.match(/group-title="([^"]+)"/);
      if (groupMatch) currentStream.language = groupMatch[1];
      
      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        currentStream.channel = line.substring(commaIndex + 1).trim();
      } else {
        const parts = line.split(' ');
        currentStream.channel = parts[parts.length - 1];
      }
      
      if (!currentStream.language) currentStream.language = currentStream.channel || "Stream";
      currentStream.quality = "HD";
      currentStream.format = "HLS";
    } else if (line.startsWith('http')) {
      currentStream.url = line;
      if (currentStream.channel && currentStream.url) {
        streams.push(currentStream as Stream);
      }
      currentStream = {};
    }
  }
  return streams;
};
