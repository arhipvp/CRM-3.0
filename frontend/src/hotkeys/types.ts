export interface HotkeyDefinition {
  id: string;
  combo: string;
  handler: (event: KeyboardEvent) => void;
  enabled?: boolean;
  allowInInput?: boolean;
  preventDefault?: boolean;
}

export interface ParsedHotkey {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}
