# AI Enhancement Research — FitQuest Coach & Professor

> **Date**: 2026-02-18  
> **Status**: Research Complete — Ready for Implementation  
> **Author**: Copilot Agent

---

## Executive Summary

After researching open-source repositories that are **free for commercial use** (MIT/Apache-2.0 licensed), I've identified 4 repos that can significantly enhance the AI Coach and FitMind Professor capabilities:

| Repository | License | Stars | Enhancement Target |
|------------|---------|-------|-------------------|
| **react-native-executorch** | MIT | 1.2k | On-device LLM inference (COACH + PROFESSOR) |
| **ts-fsrs** | MIT | 571 | FSRS spaced repetition algorithm (PROFESSOR) |
| **llama.cpp** | MIT | 95.2k | Core LLM inference engine (COACH + PROFESSOR) |
| **RAGFlow** | Apache-2.0 | 73.4k | RAG document understanding (PROFESSOR) |

---

## 1. react-native-executorch ⭐ (TOP PRIORITY)

**Repository**: https://github.com/software-mansion/react-native-executorch  
**License**: MIT  
**Stars**: 1.2k  
**Last Activity**: Very active (6 hours ago)  

### Why This Catches My Eye

This is the **most relevant** repo for our use case. It provides:

1. **Native React Native integration** — No bridging hacks, built for Expo/RN
2. **On-device LLM inference** — Run Llama 3.2 1B directly on iOS/Android
3. **Multiple AI capabilities** — LLMs, speech-to-text, text-to-speech, OCR, embeddings
4. **Production-tested** — Powers "Private Mind" app on App Store/Play Store

### Enhancement Opportunities

#### For COACH:
- **Real-time workout coaching** — Generate contextual motivation during exercises
- **Form feedback** — Use sensor data to provide AI-generated form corrections
- **Personalized plans** — Generate workouts based on conversation context
- **Voice coaching** — Text-to-speech for hands-free workout guidance

#### For PROFESSOR:
- **Document Q&A** — Ask questions about documents being read
- **Summary generation** — Auto-summarize chapters/articles
- **Socratic questioning** — Generate thought-provoking questions from text
- **Reading comprehension** — Adaptive questions based on content

### Integration Path

```tsx
import { useLLM, LLAMA3_2_1B, Message } from 'react-native-executorch';

const llm = useLLM({ model: LLAMA3_2_1B });

const chat: Message[] = [
  { role: 'system', content: 'You are a fitness coach named FitCoach...' },
  { role: 'user', content: userQuery }
];

await llm.generate(chat);
console.log(llm.response); // AI-generated response
```

### Requirements
- React Native 0.81+ (New Architecture)
- iOS 17.0+ / Android 13+
- ~1.5GB RAM for Llama 3.2 1B

---

## 2. ts-fsrs ⭐ (HIGH PRIORITY for PROFESSOR)

**Repository**: https://github.com/open-spaced-repetition/ts-fsrs  
**License**: MIT  
**Stars**: 571  
**Last Activity**: Very active (last week)  

### Why This Catches My Eye

1. **FSRS Algorithm** — Free Spaced Repetition Scheduler, superior to SM-2
2. **TypeScript native** — Direct drop-in for React Native
3. **Scientific backing** — Based on extensive research, 40% higher memory retention than Anki
4. **Lightweight** — No native dependencies, pure TypeScript

### Current State in FitQuest

We currently use a basic SM-2 implementation in `src/fitmind/schema.ts`:

```typescript
// Current: Basic SM-2
interval_days INTEGER DEFAULT 1,
ease_factor REAL DEFAULT 2.5,
repetitions INTEGER DEFAULT 0,
```

### Enhancement Opportunities

#### For PROFESSOR Flashcards:
- **Superior scheduling** — FSRS outperforms SM-2 by 40%+
- **Difficulty scoring** — Better calibration of card difficulty
- **Optimal review timing** — Minimize review time while maximizing retention
- **Learning analytics** — Predict retention rates and optimal study times

### Integration Path

```typescript
import { fsrs, createEmptyCard, Rating, generatorParameters } from 'ts-fsrs';

const params = generatorParameters({ enable_fuzz: true });
const f = fsrs(params);

// When user reviews a flashcard
const scheduling = f.repeat(card, new Date());
const nextCard = scheduling[Rating.Good].card; // Next review scheduled
```

### Migration Plan

1. Add `ts-fsrs` dependency
2. Create `FSRSService.ts` wrapper
3. Migrate existing flashcards to FSRS schema
4. Update `fitmind_flashcards` table structure

---

## 3. llama.cpp (FOUNDATIONAL)

**Repository**: https://github.com/ggml-org/llama.cpp  
**License**: MIT  
**Stars**: 95.2k  
**Last Activity**: Extremely active (43 minutes ago)  

### Why This Catches My Eye

1. **Industry standard** — The backbone of on-device LLM inference
2. **XCFramework support** — Pre-built for iOS/macOS/visionOS
3. **GGUF format** — Quantized models for mobile (1.5-8 bit)
4. **Cross-platform** — Works on Android via NDK

### Relation to react-native-executorch

`react-native-executorch` uses **ExecuTorch** (Meta's framework), while `llama.cpp` uses **GGML**. They're alternatives:

| Feature | ExecuTorch | llama.cpp |
|---------|------------|-----------|
| React Native wrapper | ✅ (react-native-executorch) | ❌ (would need custom bridge) |
| Model format | .pte | .gguf |
| Model ecosystem | HuggingFace | HuggingFace |
| iOS/Android | ✅ | ✅ |

### Recommendation

**Use react-native-executorch** for initial integration (easier), but keep llama.cpp as reference for:
- Understanding quantization techniques
- Model conversion knowledge
- Performance benchmarking
- Potential future migration if needed

---

## 4. RAGFlow (ADVANCED — FUTURE PHASE)

**Repository**: https://github.com/infiniflow/ragflow  
**License**: Apache-2.0  
**Stars**: 73.4k  
**Last Activity**: Very active (4 days ago)  

### Why This Catches My Eye

1. **Deep document understanding** — PDF, EPUB, Word parsing with OCR
2. **Agentic RAG** — Not just retrieval, but reasoning
3. **Template-based chunking** — Smart document segmentation
4. **Grounded citations** — Responses cite specific passages

### Challenges for Mobile

RAGFlow is designed as a **server-side solution** (Docker-based). Direct mobile integration is not feasible. However, we can:

1. **Extract document parsing logic** — Use deepdoc component ideas
2. **Learn chunking strategies** — Apply to FitMind document processing
3. **Adopt citation patterns** — When Professor responds, cite document location

### Enhancement Opportunities

#### For PROFESSOR (Document Reading):
- **Intelligent chunking** — Better text segmentation for comprehension
- **Multi-modal understanding** — Process images in documents
- **Citation linking** — "Based on page 43, paragraph 2..."
- **Cross-document knowledge** — Connect ideas across library

### Integration Path

This would be a **Phase 8+** enhancement:
1. Study deepdoc implementation
2. Extract TypeScript-compatible algorithms
3. Create on-device document analyzer
4. Integrate with Professor responses

---

## Implementation Priorities

### Phase 6.5: Immediate Enhancements

| Priority | Item | Target | Effort |
|----------|------|--------|--------|
| 🔴 P0 | Install `ts-fsrs` | Professor Flashcards | 4 hours |
| 🔴 P0 | Create `FSRSService.ts` | Professor Flashcards | 8 hours |
| 🟠 P1 | Install `react-native-executorch` | Coach + Professor | 4 hours |
| 🟠 P1 | Create `OnDeviceLLM.ts` wrapper | Coach + Professor | 16 hours |

### Phase 7: Full AI Integration

| Priority | Item | Target | Effort |
|----------|------|--------|--------|
| 🟠 P1 | Integrate LLM into Coach queries | Coach | 24 hours |
| 🟠 P1 | Integrate LLM into Professor queries | Professor | 24 hours |
| 🟡 P2 | Add speech-to-text for voice Coach | Coach | 16 hours |
| 🟡 P2 | Add text-to-speech for workout cues | Coach | 16 hours |

### Phase 8: Advanced Features

| Priority | Item | Target | Effort |
|----------|------|--------|--------|
| 🟢 P3 | Document RAG (local vector store) | Professor | 40 hours |
| 🟢 P3 | Workout plan generation | Coach | 40 hours |
| 🟢 P3 | Exercise form analysis | Coach | 60 hours |

---

## Cloned Repositories

The following repos will be cloned to `workspace-repos/ai-enhancement/`:

```
workspace-repos/ai-enhancement/
├── react-native-executorch/   # On-device LLM inference
├── ts-fsrs/                   # Spaced repetition algorithm
└── llama.cpp/                 # Reference implementation
```

RAGFlow is too large (~2GB) for local cloning; we'll study it via web.

---

## Summary

**Recommended Action Plan**:

1. **Clone repos** — react-native-executorch, ts-fsrs, llama.cpp
2. **Implement ts-fsrs first** — Smallest lift, biggest impact on Professor
3. **Add react-native-executorch** — Major capability unlock for both AI personalities
4. **Study llama.cpp docs** — Understand model optimization techniques
5. **RAGFlow patterns only** — Extract ideas, don't integrate directly

This research positions FitQuest to have **state-of-the-art on-device AI** for both fitness coaching and reading comprehension, all while remaining privacy-first with no cloud dependency.
