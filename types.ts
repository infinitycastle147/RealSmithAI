
export enum VisualStyle {
  CHALKBOARD = 'Chalkboard',
  WHITEBOARD = 'Whiteboard',
  ANIME = 'Anime',
  CYBERPUNK = 'Cyberpunk',
  REALISTIC = 'Realistic',
  CUSTOM = 'Custom'
}

export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface ScriptSegment {
  id: string;
  narration: string;
  visualDescription: string;
}

export interface GeneratedSegment extends ScriptSegment {
  imageUrl?: string; // Base64 or Blob URL
  audioUrl?: string; // Base64 or Blob URL
  audioDuration?: number; // Seconds
  isGenerating: boolean;
  error?: string;
}

export interface ProjectState {
  topic: string;
  style: VisualStyle;
  voice: VoiceName;
  customStylePrompt?: string;
  showCaptions: boolean;
  exportFormat: 'webm' | 'mp4';
  segments: GeneratedSegment[];
  finalVideoUrl?: string;
}

export type AppStep = 'INPUT' | 'SCRIPT' | 'STYLE' | 'GENERATION' | 'RESULT';
