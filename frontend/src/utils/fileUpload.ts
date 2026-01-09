export type CollectedFile = { file: File; key: string };

export const buildFallbackKey = (file: File): string => {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return [relativePath || '', file.name, String(file.size), String(file.lastModified)].join('|');
};

export const dedupeCollectedFiles = (items: CollectedFile[]): File[] => {
  const seen = new Set<string>();
  const unique: File[] = [];

  for (const item of items) {
    const key = item.key;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item.file);
  }

  return unique;
};

export const dedupeFiles = (files: File[]): File[] => {
  const collected: CollectedFile[] = files.map((file) => ({ file, key: buildFallbackKey(file) }));
  return dedupeCollectedFiles(collected);
};
