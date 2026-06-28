export interface Word {
  id: string;
  text: string;
  timestamp: number | null; // internal timestamp in milliseconds
}

export interface Line {
  id: string;
  words: Word[];
}

export interface LyricsDocument {
  metadata: {
    title: string;
    artist: string;
    album?: string;
    by?: string;
    offset?: number;
  };
  lines: Line[];
}

export interface HistoryState {
  lines: Line[];
  metadata: LyricsDocument['metadata'];
}
