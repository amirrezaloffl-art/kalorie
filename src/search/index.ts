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
  private docs: Doc[];

  constructor(items: T[]) {
    this.byId = new Map(items.map((i) => [i.id, i]));
    this.docs = items.map(toDoc);
    this.fuse = new Fuse(this.docs, {
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
    const found = new Map<string, { item: Doc; score: number }>();
    for (const r of this.fuse.search(q, { limit: 200 })) found.set(r.item.id, { item: r.item, score: r.score ?? 1 });

    // Multi-word queries ("کته ساده", "rice cooked"): Fuse scores the whole phrase, so also
    // match word by word and keep items that contain most of the words in any order.
    const words = q.split(' ').filter((w) => w.length > 1);
    if (words.length > 1) {
      for (const doc of this.docs) {
        const text = `${doc.fa} ${doc.en} ${doc.aliases.join(' ')} ${doc.brand}`;
        const hits = words.filter((w) => text.includes(w)).length;
        if (hits < Math.ceil(words.length / 2)) continue;
        const score = hits === words.length ? 0.1 : 0.45 - (hits / words.length) * 0.2;
        const prev = found.get(doc.id);
        if (!prev || score < prev.score) found.set(doc.id, { item: doc, score });
      }
    }

    return [...found.values()]
      .map((r) => {
        const id = r.item.id;
        let score = r.score;
        // exact / prefix matches first
        const names = [r.item.fa, r.item.en, ...r.item.aliases];
        if (names.some((n) => n === q)) score -= 0.5;
        else if (names.some((n) => n.split(' ').includes(q))) score -= 0.32;
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
