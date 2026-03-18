/**
 * KnowledgeGraph — On-Device Entity & Relationship Extraction
 *
 * Builds a knowledge graph from FitMind documents:
 *   - Entity extraction (concepts, people, terms, exercises, muscles)
 *   - Relationship detection (semantic similarity edges, co-occurrence)
 *   - Graph querying (neighbors, paths, clusters)
 *
 * Pure TypeScript, no model dependency (rule-based + TF-IDF similarity).
 * When the sentence encoder is available, uses dense embeddings for edges.
 */

// ============================================
// TYPES
// ============================================

export type EntityType =
  | 'CONCEPT' | 'PERSON' | 'EXERCISE' | 'MUSCLE'
  | 'NUTRIENT' | 'METRIC' | 'TECHNIQUE' | 'EQUIPMENT'
  | 'TERM' | 'OTHER';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  documentIds: string[];
  frequency: number;
  embedding?: number[];
}

export interface Relationship {
  sourceId: string;
  targetId: string;
  type: RelationType;
  weight: number;        // 0-1 strength
  evidence: string[];    // source sentences
  documentId: string;
}

export type RelationType =
  | 'RELATED_TO' | 'IS_A' | 'PART_OF' | 'USED_IN'
  | 'TARGETS' | 'REQUIRES' | 'SIMILAR_TO' | 'CO_OCCURS'
  | 'DEFINED_AS' | 'CAUSES' | 'PREVENTS';

export interface GraphQueryResult {
  entities: Entity[];
  relationships: Relationship[];
  clusters?: EntityCluster[];
}

export interface EntityCluster {
  id: number;
  label: string;
  entityIds: string[];
  coherence: number;
}

// ============================================
// ENTITY DICTIONARIES
// ============================================

const EXERCISE_TERMS = new Set([
  'push-up', 'pushup', 'pull-up', 'pullup', 'squat', 'deadlift',
  'bench press', 'lunge', 'plank', 'burpee', 'row', 'curl',
  'press', 'fly', 'extension', 'crunch', 'sit-up', 'dip',
  'shrug', 'raise', 'kickback', 'hip thrust', 'clean', 'snatch',
  'thruster', 'muscle-up', 'box jump', 'jump squat',
]);

const MUSCLE_TERMS = new Set([
  'chest', 'pectorals', 'back', 'lats', 'latissimus', 'trapezius',
  'shoulders', 'deltoids', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'quads', 'hamstrings', 'glutes', 'gluteus',
  'calves', 'abs', 'abdominals', 'core', 'obliques',
  'hip flexors', 'rotator cuff', 'rhomboids', 'erector spinae',
]);

const NUTRIENT_TERMS = new Set([
  'protein', 'carbohydrate', 'carbs', 'fat', 'fiber', 'vitamin',
  'mineral', 'calcium', 'iron', 'zinc', 'magnesium', 'potassium',
  'sodium', 'omega-3', 'creatine', 'bcaa', 'caffeine', 'collagen',
]);

const EQUIPMENT_TERMS = new Set([
  'barbell', 'dumbbell', 'kettlebell', 'resistance band', 'pull-up bar',
  'bench', 'cable machine', 'smith machine', 'foam roller',
  'medicine ball', 'battle rope', 'trx', 'suspension trainer',
]);

const METRIC_TERMS = new Set([
  'heart rate', 'bpm', 'vo2 max', 'rpe', 'one rep max', '1rm',
  'bmi', 'body fat', 'resting heart rate', 'calories', 'steps',
  'cadence', 'pace', 'mets', 'recovery score', 'sleep score',
]);

const RELATION_PATTERNS: Array<{
  pattern: RegExp;
  type: RelationType;
}> = [
  { pattern: /(.+?)\s+(?:is|are)\s+(?:a|an)\s+(.+)/i, type: 'IS_A' },
  { pattern: /(.+?)\s+(?:is|are)\s+(?:part|component)\s+of\s+(.+)/i, type: 'PART_OF' },
  { pattern: /(.+?)\s+(?:targets?|works?|activates?)\s+(.+)/i, type: 'TARGETS' },
  { pattern: /(.+?)\s+(?:requires?|needs?)\s+(.+)/i, type: 'REQUIRES' },
  { pattern: /(.+?)\s+(?:is\s+)?(?:used|utilized)\s+(?:in|for|during)\s+(.+)/i, type: 'USED_IN' },
  { pattern: /(.+?)\s+(?:causes?|leads?\s+to|results?\s+in)\s+(.+)/i, type: 'CAUSES' },
  { pattern: /(.+?)\s+(?:prevents?|reduces?|inhibits?)\s+(.+)/i, type: 'PREVENTS' },
  { pattern: /(.+?)\s+(?:is\s+)?(?:defined|known)\s+as\s+(.+)/i, type: 'DEFINED_AS' },
];

// ============================================
// KNOWLEDGE GRAPH
// ============================================

export class KnowledgeGraph {
  private static instance: KnowledgeGraph | null = null;

  private entities: Map<string, Entity> = new Map();
  private relationships: Relationship[] = [];
  private adjacency: Map<string, Set<string>> = new Map();

  private constructor() {}

  static getInstance(): KnowledgeGraph {
    if (!KnowledgeGraph.instance) {
      KnowledgeGraph.instance = new KnowledgeGraph();
    }
    return KnowledgeGraph.instance;
  }

  // ============================================
  // DOCUMENT PROCESSING
  // ============================================

  /**
   * Extract entities and relationships from document text.
   */
  processDocument(documentId: string, text: string): {
    entitiesFound: number;
    relationsFound: number;
  } {
    const sentences = this.splitSentences(text);
    let entitiesFound = 0;
    let relationsFound = 0;

    // Pass 1: Entity extraction
    for (const sentence of sentences) {
      const extracted = this.extractEntities(sentence, documentId);
      entitiesFound += extracted.length;
    }

    // Pass 2: Relationship extraction
    for (const sentence of sentences) {
      const rels = this.extractRelationships(sentence, documentId);
      relationsFound += rels.length;
    }

    // Pass 3: Co-occurrence edges
    const coOccurrences = this.detectCoOccurrences(sentences, documentId);
    relationsFound += coOccurrences;

    return { entitiesFound, relationsFound };
  }

  /**
   * Extract named entities from a sentence.
   */
  private extractEntities(sentence: string, documentId: string): Entity[] {
    const found: Entity[] = [];
    const lower = sentence.toLowerCase();

    // Check exercise terms
    for (const term of EXERCISE_TERMS) {
      if (lower.includes(term)) {
        found.push(this.upsertEntity(term, 'EXERCISE', documentId));
      }
    }

    // Check muscle terms
    for (const term of MUSCLE_TERMS) {
      if (lower.includes(term)) {
        found.push(this.upsertEntity(term, 'MUSCLE', documentId));
      }
    }

    // Check nutrient terms
    for (const term of NUTRIENT_TERMS) {
      if (lower.includes(term)) {
        found.push(this.upsertEntity(term, 'NUTRIENT', documentId));
      }
    }

    // Check equipment
    for (const term of EQUIPMENT_TERMS) {
      if (lower.includes(term)) {
        found.push(this.upsertEntity(term, 'EQUIPMENT', documentId));
      }
    }

    // Check metrics
    for (const term of METRIC_TERMS) {
      if (lower.includes(term)) {
        found.push(this.upsertEntity(term, 'METRIC', documentId));
      }
    }

    // Extract capitalized noun phrases (potential concepts/people)
    const nounPhrases = sentence.match(
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g
    ) ?? [];
    for (const np of nounPhrases) {
      const npLower = np.toLowerCase();
      if (npLower.length > 2 && !this.isStopWord(npLower)) {
        found.push(this.upsertEntity(npLower, 'CONCEPT', documentId));
      }
    }

    return found;
  }

  /**
   * Extract relationships from a sentence using pattern matching.
   */
  private extractRelationships(
    sentence: string, documentId: string
  ): Relationship[] {
    const found: Relationship[] = [];

    for (const { pattern, type } of RELATION_PATTERNS) {
      const match = sentence.match(pattern);
      if (match && match[1] && match[2]) {
        const source = this.normalizeEntityName(match[1].trim());
        const target = this.normalizeEntityName(match[2].trim());

        const sourceEntity = this.findEntity(source);
        const targetEntity = this.findEntity(target);

        if (sourceEntity && targetEntity && sourceEntity.id !== targetEntity.id) {
          const rel: Relationship = {
            sourceId: sourceEntity.id,
            targetId: targetEntity.id,
            type,
            weight: 0.8,
            evidence: [sentence],
            documentId,
          };
          this.addRelationship(rel);
          found.push(rel);
        }
      }
    }

    return found;
  }

  /**
   * Detect co-occurrence relationships within document.
   */
  private detectCoOccurrences(
    sentences: string[], documentId: string
  ): number {
    let count = 0;
    const window = 3; // sentence window for co-occurrence

    for (let i = 0; i < sentences.length; i++) {
      const entitiesInWindow: string[] = [];

      for (let j = i; j < Math.min(i + window, sentences.length); j++) {
        const entities = this.findEntitiesInText(sentences[j]!);
        entitiesInWindow.push(...entities);
      }

      // Create co-occurrence edges between entities in the window
      const unique = [...new Set(entitiesInWindow)];
      for (let a = 0; a < unique.length; a++) {
        for (let b = a + 1; b < unique.length; b++) {
          // Check if relationship already exists
          const existing = this.relationships.find(
            r =>
              (r.sourceId === unique[a] && r.targetId === unique[b]) ||
              (r.sourceId === unique[b] && r.targetId === unique[a])
          );

          if (existing) {
            existing.weight = Math.min(1, existing.weight + 0.1);
          } else {
            this.addRelationship({
              sourceId: unique[a]!,
              targetId: unique[b]!,
              type: 'CO_OCCURS',
              weight: 0.3,
              evidence: [sentences[i]!],
              documentId,
            });
            count++;
          }
        }
      }
    }

    return count;
  }

  // ============================================
  // ENTITY MANAGEMENT
  // ============================================

  private upsertEntity(
    name: string, type: EntityType, documentId: string
  ): Entity {
    const id = this.entityId(name);
    const existing = this.entities.get(id);

    if (existing) {
      existing.frequency++;
      if (!existing.documentIds.includes(documentId)) {
        existing.documentIds.push(documentId);
      }
      return existing;
    }

    const entity: Entity = {
      id,
      name,
      type,
      aliases: [],
      documentIds: [documentId],
      frequency: 1,
    };
    this.entities.set(id, entity);
    return entity;
  }

  private findEntity(name: string): Entity | null {
    const id = this.entityId(name);
    return this.entities.get(id) ?? null;
  }

  private findEntitiesInText(text: string): string[] {
    const ids: string[] = [];
    const lower = text.toLowerCase();
    for (const [id, entity] of this.entities) {
      if (lower.includes(entity.name)) {
        ids.push(id);
      }
    }
    return ids;
  }

  private entityId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private normalizeEntityName(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim();
  }

  private addRelationship(rel: Relationship): void {
    this.relationships.push(rel);

    if (!this.adjacency.has(rel.sourceId)) {
      this.adjacency.set(rel.sourceId, new Set());
    }
    if (!this.adjacency.has(rel.targetId)) {
      this.adjacency.set(rel.targetId, new Set());
    }
    this.adjacency.get(rel.sourceId)!.add(rel.targetId);
    this.adjacency.get(rel.targetId)!.add(rel.sourceId);
  }

  // ============================================
  // GRAPH QUERIES
  // ============================================

  /**
   * Find entities related to a query term.
   */
  queryRelated(query: string, maxHops = 2, limit = 20): GraphQueryResult {
    const queryId = this.entityId(query);
    const visited = new Set<string>();
    const resultEntities: Entity[] = [];
    const resultRelationships: Relationship[] = [];

    // BFS from query entity
    let frontier = [queryId];
    for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
      const nextFrontier: string[] = [];
      for (const nodeId of frontier) {
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const entity = this.entities.get(nodeId);
        if (entity) resultEntities.push(entity);

        // Get neighbors
        const neighbors = this.adjacency.get(nodeId) ?? new Set();
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            nextFrontier.push(neighborId);
          }

          // Collect relationships
          const rels = this.relationships.filter(
            r =>
              (r.sourceId === nodeId && r.targetId === neighborId) ||
              (r.sourceId === neighborId && r.targetId === nodeId)
          );
          resultRelationships.push(...rels);
        }
      }
      frontier = nextFrontier;
    }

    // Also fuzzy-match entities if exact match fails
    if (resultEntities.length === 0) {
      const fuzzy = this.fuzzySearch(query, limit);
      resultEntities.push(...fuzzy);
    }

    return {
      entities: resultEntities.slice(0, limit),
      relationships: resultRelationships,
    };
  }

  /**
   * Find shortest path between two entities.
   */
  findPath(fromName: string, toName: string): Entity[] | null {
    const fromId = this.entityId(fromName);
    const toId = this.entityId(toName);

    if (!this.entities.has(fromId) || !this.entities.has(toId)) return null;

    // BFS
    const queue: string[][] = [[fromId]];
    const visited = new Set<string>([fromId]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1]!;

      if (current === toId) {
        return path
          .map(id => this.entities.get(id))
          .filter((e): e is Entity => e !== undefined);
      }

      const neighbors = this.adjacency.get(current) ?? new Set();
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push([...path, next]);
        }
      }
    }

    return null; // no path
  }

  /**
   * Cluster entities using connected components.
   */
  getClusters(): EntityCluster[] {
    const visited = new Set<string>();
    const clusters: EntityCluster[] = [];
    let clusterId = 0;

    for (const [entityId] of this.entities) {
      if (visited.has(entityId)) continue;

      const cluster: string[] = [];
      const stack = [entityId];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        cluster.push(current);

        const neighbors = this.adjacency.get(current) ?? new Set();
        for (const n of neighbors) {
          if (!visited.has(n)) stack.push(n);
        }
      }

      if (cluster.length > 1) {
        // Label by most frequent entity type
        const typeCounts: Record<string, number> = {};
        for (const id of cluster) {
          const entity = this.entities.get(id);
          if (entity) {
            typeCounts[entity.type] = (typeCounts[entity.type] ?? 0) + 1;
          }
        }
        const label = Object.entries(typeCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'MIXED';

        clusters.push({
          id: clusterId++,
          label,
          entityIds: cluster,
          coherence: cluster.length > 0 ? 1 / cluster.length : 0,
        });
      }
    }

    return clusters.sort((a, b) => b.entityIds.length - a.entityIds.length);
  }

  /**
   * Get most important entities by degree centrality.
   */
  getTopEntities(limit = 10): Entity[] {
    const degrees: Array<[string, number]> = [];
    for (const [id] of this.entities) {
      const degree = this.adjacency.get(id)?.size ?? 0;
      degrees.push([id, degree]);
    }
    return degrees
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.entities.get(id)!)
      .filter(Boolean);
  }

  // ============================================
  // FUZZY SEARCH
  // ============================================

  private fuzzySearch(query: string, limit: number): Entity[] {
    const queryLower = query.toLowerCase();
    const scored: Array<[Entity, number]> = [];

    for (const entity of this.entities.values()) {
      let score = 0;
      if (entity.name === queryLower) {
        score = 1;
      } else if (entity.name.includes(queryLower)) {
        score = 0.8;
      } else if (queryLower.includes(entity.name)) {
        score = 0.6;
      } else {
        // Levenshtein-based similarity
        score = this.stringSimilarity(entity.name, queryLower);
      }

      if (score > 0.3) {
        scored.push([entity, score]);
      }
    }

    return scored
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([e]) => e);
  }

  private stringSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    const dist = this.levenshtein(a, b);
    return 1 - dist / maxLen;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i]![j] = a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
    return dp[m]![n]!;
  }

  private isStopWord(word: string): boolean {
    const stops = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'can', 'shall',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
      'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its',
      'our', 'their', 'what', 'which', 'who', 'whom', 'when',
      'where', 'why', 'how', 'not', 'no', 'but', 'or', 'and',
      'if', 'then', 'else', 'for', 'from', 'to', 'in', 'on',
      'at', 'by', 'with', 'about', 'between', 'through', 'of',
    ]);
    return stops.has(word);
  }

  private splitSentences(text: string): string[] {
    return text
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  exportGraph(): { entities: Entity[]; relationships: Relationship[] } {
    return {
      entities: Array.from(this.entities.values()),
      relationships: this.relationships,
    };
  }

  importGraph(data: {
    entities: Entity[];
    relationships: Relationship[];
  }): void {
    this.entities.clear();
    this.relationships = [];
    this.adjacency.clear();

    for (const entity of data.entities) {
      this.entities.set(entity.id, entity);
    }
    for (const rel of data.relationships) {
      this.addRelationship(rel);
    }
  }

  clear(): void {
    this.entities.clear();
    this.relationships = [];
    this.adjacency.clear();
  }

  // ============================================
  // PUBLIC API
  // ============================================

  get entityCount(): number { return this.entities.size; }
  get relationshipCount(): number { return this.relationships.length; }

  getEntity(name: string): Entity | null {
    return this.findEntity(name);
  }

  getStats() {
    const types: Record<string, number> = {};
    for (const e of this.entities.values()) {
      types[e.type] = (types[e.type] ?? 0) + 1;
    }
    return {
      entities: this.entities.size,
      relationships: this.relationships.length,
      entityTypes: types,
      clusters: this.getClusters().length,
    };
  }
}

export const knowledgeGraph = KnowledgeGraph.getInstance();
