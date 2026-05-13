import fs from "fs";
import path from "path";

const ADVENTURES_DIR = path.join(process.cwd(), "adventures");
const MAPS_DIR = path.join(process.cwd(), "maps");
const MAP_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

export interface Adventure {
  title?: string;
  synopsis?: string;
  current_scene?: string;
  key_npcs?: Record<string, unknown>[];
  locations?: Record<string, unknown>[];
  encounters?: Record<string, unknown>[];
  quests?: Record<string, unknown>[];
  [key: string]: unknown;
}

export function loadAdventure(id: string): Adventure | null {
  const filePath = path.join(ADVENTURES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Adventure;
  } catch {
    return null;
  }
}

export function listAdventures(): string[] {
  if (!fs.existsSync(ADVENTURES_DIR)) return [];
  return fs.readdirSync(ADVENTURES_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(".json", ""));
}

export function listMaps(): string[] {
  if (!fs.existsSync(MAPS_DIR)) return [];
  return fs.readdirSync(MAPS_DIR)
    .filter(f => MAP_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext)))
    .map(f => f.replace(/\.[^.]+$/, ""));
}

export function findMapFile(name: string): string | null {
  if (!fs.existsSync(MAPS_DIR)) return null;
  for (const ext of MAP_EXTENSIONS) {
    const filePath = path.join(MAPS_DIR, `${name}${ext}`);
    if (fs.existsSync(filePath)) return `${name}${ext}`;
  }
  return null;
}
