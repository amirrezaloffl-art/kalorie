import Fuse from 'fuse.js';
import type { Exercise, Food } from '../domain/types';
import { normalizeFa } from './normalize';

interface Doc {
  id: string;
  fa: string;
  en: string;
  aliases: string[];
  brand: string;
}

type Item = Pick<Food, 'id' | 'name' | 'aliases'> & { brand?: string };

const toDoc = (f: Item): Doc => ({
  id: f.id,
  fa: normalizeFa(f.name.fa),
  en: normalizeFa(f.name.en),
  aliases: (f.aliases ?? []).map(normalizeFa),
  brand: normalizeFa(f.brand ?? ''),
});

export interface Boosts {
  favorites: Set<string>;
  recent: string[];
}

/** Fuzzy, bilingual search with ranking boost: favorites > recently used > custom > base. */
export class SearchIndex<T extends Item> {
  private fuse: Fuse<Doc>;
  private byId: Map<string, T>;

  constructor(items: T[]) {
    this.byId = new Map(items.map((i) => [i.id, i]));
    this.fuse = new Fuse(items.map(toDoc), {
      keys: [
        { name: 'fa', weight: 1 },
        { name: 'en', weight: 0.9 },
        { name: 'aliases', weight: 0.8 },
        { name: 'brand', weight: 0.5 },
      ],
      threshold: 0.34,
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: 1,
    });
  }

  search(query: string, boosts: Boosts, limit = 60): T[] {
    const q = normalizeFa(query);
    if (!q) return [];
    const recentRank = new Map(boosts.recent.map((id, i) => [id, i]));
    const res = this.fuse.search(q, { limit: 200 });
    return res
      .map((r) => {
        const id = r.item.id;
        let score = r.score ?? 1;
        // exact / prefix matches first
        const names = [r.item.fa, r.item.en, ...r.item.aliases];
        if (names.some((n) => n === q)) score -= 0.5;
        else if (names.some((n) => n.startsWith(q))) score -= 0.25;
        else if (names.some((n) => n.includes(q))) score -= 0.12;
        if (boosts.favorites.has(id)) score -= 0.15;
        if (recentRank.has(id)) score -= 0.1 - Math.min(recentRank.get(id)!, 20) * 0.003;
        if (!id.startsWith('base:')) score -= 0.05;
        return { id, score };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, limit)
      .map((r) => this.byId.get(r.id)!)
      .filter(Boolean);
  }
}

export const foodIndex = (foods: Food[]) => new SearchIndex(foods);
export const exerciseIndex = (ex: Exercise[]) => new SearchIndex(ex);
