export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  uploader: string;
  duration: number;
  description: string;
  webpage_url: string;
  extractor: string;
  view_count: number;
  upload_date: string;
  is_playlist: boolean;
  formats: Format[];
}

export interface Format {
  format_id: string;
  ext: string;
  resolution: string;
  filesize: number | null;
  vcodec: string;
  acodec: string;
  fps: number | null;
  tbr: number | null;
  abr: number | null;
  format_note: string;
}

export interface PlaylistItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: number;
  uploader: string;
}

export interface DownloadRecord {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  uploader: string;
  duration: number;
  media_type: string;
  format_id: string;
  ext: string;
  filename: string;
  filesize: number;
  status: string;
  error: string;
  created_at: string;
}

export interface DownloadProgress {
  status: string;
  percent: number;
  speed: string;
  eta: string;
  filename: string;
}

export interface Stats {
  total: number;
  completed: number;
  failed: number;
  downloading: number;
  audioCount: number;
  videoCount: number;
  totalSize: number;
  recent: DownloadRecord[];
}

export interface Settings {
  proxy: string;
  rateLimit: string;
  concurrentDownloads: string;
  cookieFile: string;
  sponsorBlock: string;
  embedThumbnail: string;
  embedMetadata: string;
  defaultMediaType: string;
  defaultQuality: string;
  defaultAudioFormat: string;
}

export interface Template {
  id: string;
  name: string;
  command: string;
  created_at: string;
}

const base = '/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getInfo: (url: string) =>
    apiFetch<VideoInfo>(`/info?url=${encodeURIComponent(url)}`),

  getPlaylist: (url: string) =>
    apiFetch<{ items: PlaylistItem[]; count: number }>(`/playlist?url=${encodeURIComponent(url)}`),

  startDownload: (data: {
    url: string;
    title?: string;
    thumbnail?: string;
    uploader?: string;
    duration?: number;
    mediaType?: string;
    quality?: string;
    audioFormat?: string;
    videoFormat?: string;
    formatId?: string;
    embedThumbnail?: boolean;
    embedSubtitle?: boolean;
    embedMetadata?: boolean;
    sponsorBlock?: boolean;
    noWatermark?: boolean;
  }) =>
    apiFetch<{ taskId: string; status: string }>('/download', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelDownload: (taskId: string) =>
    apiFetch<{ success: boolean }>(`/download/${taskId}/cancel`, { method: 'POST' }),

  cleanupStuck: () =>
    apiFetch<{ cleaned: number }>('/downloads/cleanup', { method: 'POST' }),

  getHistory: (params: { search?: string; type?: string; page?: number; perPage?: number }) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.type) q.set('type', params.type);
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('perPage', String(params.perPage));
    return apiFetch<{ items: DownloadRecord[]; total: number; page: number; perPage: number }>(
      `/history?${q}`
    );
  },

  deleteHistory: (id: string) =>
    apiFetch(`/history/${id}`, { method: 'DELETE' }),

  clearHistory: (ids?: string[]) =>
    apiFetch('/history', {
      method: 'DELETE',
      body: JSON.stringify({ ids: ids || [] }),
    }),

  getStats: () => apiFetch<Stats>('/stats'),

  getSettings: () => apiFetch<Settings>('/settings'),

  saveSettings: (settings: Partial<Settings>) =>
    apiFetch('/settings', { method: 'POST', body: JSON.stringify(settings) }),

  getTemplates: () => apiFetch<Template[]>('/templates'),

  createTemplate: (data: { name: string; command: string }) =>
    apiFetch<Template>('/templates', { method: 'POST', body: JSON.stringify(data) }),

  deleteTemplate: (id: string) =>
    apiFetch(`/templates/${id}`, { method: 'DELETE' }),

  runCommand: (data: { url: string; command: string }) =>
    apiFetch<{ stdout: string; stderr: string; returncode: number }>('/command', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  subscribeProgress: (taskId: string, onUpdate: (data: DownloadProgress) => void): () => void => {
    const es = new EventSource(`/api/progress/${taskId}`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onUpdate(data);
        if (data.status === 'completed' || data.status === 'failed') {
          es.close();
        }
      } catch (_) {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  },

  getFileUrl: (filename: string) => `/api/files/${encodeURIComponent(filename)}`,

  uploadCookieFile: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch('/api/cookie-upload', { method: 'POST', body: form, credentials: 'include' })
      .then(async r => {
        const data = await r.json().catch(() => ({ error: 'Request failed' }));
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        return data as { success: boolean; filename: string };
      });
  },

  getYtdlpVersion: () => apiFetch<{ version: string }>('/ytdlp-version'),

  updateYtdlp: () => apiFetch<{ success: boolean; version: string; output?: string; error?: string }>(
    '/update-ytdlp', { method: 'POST' }
  ),

  getDiskUsage: () => apiFetch<{ totalSize: number; fileCount: number }>('/disk-usage'),
};

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
