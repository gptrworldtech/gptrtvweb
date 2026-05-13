export interface Stream {
  channel: string;
  language: string;
  quality: string;
  format: string;
  url: string;
  logo?: string;
}

export interface StreamData {
  event?: {
    title?: string;
    short_title?: string;
    sport?: string;
    match_type?: string;
  };
  streams: Stream[];
}
