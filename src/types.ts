export type ItemType = "skill" | "command" | "agent";

export type CategoryType = "skills" | "commands" | "agents";

export interface ScannedItem {
  type: ItemType;
  name: string;
  description: string;
  files: string[]; // relative paths from ~/.claude/
}

export interface ManifestItem {
  type: ItemType;
  name: string;
  files: Record<string, string>; // original path -> gist filename
}

export interface Manifest {
  version: 1;
  items: ManifestItem[];
}

export interface ManifestV2 {
  version: 2;
  type: CategoryType;
  items: ManifestItem[];
}

export interface PublishedEntry {
  gistId: string;
  public: boolean;
  updatedAt: string;
}

export interface InstalledItem {
  type: ItemType;
  name: string;
  files: Record<string, string>; // relative path -> sha256 hash
}

export interface InstalledEntry {
  gistId: string;
  pulledAt: string;
  items: InstalledItem[];
}

export interface StateFile {
  version: 1;
  published: Partial<Record<CategoryType, PublishedEntry>>;
  installed: Record<string, InstalledEntry>; // keyed by @user/type or gist ID
}
