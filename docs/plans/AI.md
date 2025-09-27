# Tabium AI Enhancement Plan

## 1. Local LLM Integration Options

### Supported Local LLM Backends

| Backend | LangChain Support | Local Hosting | Performance | Ease of Setup | Notes |
|---------|-------------------|---------------|-------------|----------------|-------|
| **Ollama** | ✅ Native Support | Self-hosted | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Recommended for balance of performance and ease |
| **LM Studio** | ✅ OpenAI-compatible | Self-hosted | ⭐⭐⭐ | ⭐⭐⭐⭐ | Easy setup, good for development |
| **MLX** | ⚠️ Limited | Self-hosted | ⭐⭐⭐⭐ | ⭐⭐ | Best performance on Apple Silicon |
| **LocalAI** | ✅ Native Support | Self-hosted | ⭐⭐⭐ | ⭐⭐⭐ | Supports multiple model backends |
| **llama.cpp** | ✅ Native Support | Self-hosted | ⭐⭐⭐⭐ | ⭐⭐ | Best for resource-constrained environments |

## 2. Detailed Feature Implementation

### Tab Analysis Features

1. **Tab Categorization**
   - Automatically categorize tabs into predefined categories
   - Uses LLM to analyze tab title and URL
   - Example categories: Work, Research, Entertainment, Shopping, Social, News, Tools
   - Implements confidence scoring for categorization

2. **Tab Deduplication**
   - Identify and group duplicate tabs across devices
   - Uses vector similarity for content-based matching
   - Considers both URL and page content similarity

3. **Tab Content Summarization**
   - Generate concise summaries of tab content
   - Supports different summary lengths
   - Preserves key information and context

4. **Privacy-Preserving Analysis**
   - Local processing of sensitive data
   - Optional content analysis with user consent
   - Secure handling of browsing history

5. **Tab Relationship Mapping**
   - Discover connections between open tabs
   - Group related tabs by topic or project
   - Visualize tab relationships

6. **Activity-Based Recommendations**
   - Suggest relevant tabs based on current activity
   - Time-based tab suggestions
   - Context-aware recommendations

## 3. Technical Implementation

### Core Components

1. **Local LLM Server**
   - **Primary**: Ollama (best balance of features and performance)
   - **Alternative**: LM Studio (easier setup, slightly less flexible)
   - **Fallback**: LocalAI (most flexible, more complex setup)

2. **Embedding Model**
   - **Recommended**: `nomic-embed-text` (via Ollama)
   - **Alternative**: `all-minilm-l6-v2` (smaller, faster)
   - **Fallback**: `text-embedding-3-small` (OpenAI compatible)

3. **Vector Database**
   - **Recommended**: Chroma (lightweight, in-memory)
   - **Alternative**: FAISS (via LangChain, no separate service needed)

## 3. Implementation Roadmap

### Phase 1: Core Integration (Week 1-2)
- [ ] Set up Ollama with recommended models
- [ ] Implement basic embedding generation
- [ ] Create tab content processing pipeline
- [ ] Add vector similarity search

### Phase 2: Tab Analysis Features (Week 3-4)
- [ ] Implement tab categorization
- [ ] Add tab deduplication
- [ ] Create basic summarization
- [ ] Add privacy-preserving content analysis

### Phase 3: Advanced Features (Week 5-6)
- [ ] Implement tab grouping by topic
- [ ] Add activity-based recommendations
- [ ] Create session summarization
- [ ] Add cross-tab relationship mapping

## 4. Technical Implementation

### Recommended Directory Structure
```
src/
  ai/
    models/         # Model configurations
    services/       # AI service wrappers
    prompts/        # Prompt templates
    embeddings/     # Embedding utilities
    chains/         # LangChain chains
  api/             # Existing API code
  scripts/         # Utility scripts
```

### Code Example: Ollama Integration

```typescript
// src/ai/services/ollama.ts
import { Ollama } from "langchain/llms/ollama";
import { OllamaEmbeddings } from "langchain/embeddings/ollama";

export const ollama = new Ollama({
  baseUrl: "http://localhost:11434",
  model: "llama3", // or any other model you prefer
  temperature: 0.3,
});

export const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text", // or "all-minilm" for smaller footprint
  baseUrl: "http://localhost:11434",
});
```

### Code Examples

#### 1. Tab Categorization
```typescript
async function categorizeTab(tab: Tab): Promise<{category: string, confidence: number}> {
  const prompt = `Categorize this tab into one category:
  Categories: Work, Research, Entertainment, Shopping, Social, News, Tools, Other
  
  Title: ${tab.title}
  URL: ${tab.url}
  
  Return JSON: {"category": "CategoryName", "confidence": 0.0-1.0}`;
  
  const response = await ollama.call(prompt);
  return JSON.parse(response);
}
```

#### 2. Content Summarization
```typescript
async function summarizeTabContent(content: string, maxLength: number = 200): Promise<string> {
  const prompt = `Summarize the following content in under ${maxLength} characters:
  
  ${content.substring(0, 4000)}`; // Limit input size
  
  return ollama.call(prompt);
}
```

#### 3. Tab Similarity Search
```typescript
async function findSimilarTabs(tab: Tab, allTabs: Tab[], threshold: number = 0.8): Promise<Tab[]> {
  const embedding = await embeddings.embedQuery(`${tab.title}\n${tab.url}`);
  const similarTabs = [];
  
  for (const otherTab of allTabs) {
    if (otherTab.id === tab.id) continue;
    
    const otherEmbedding = await embeddings.embedQuery(`${otherTab.title}\n${otherTab.url}`);
    const similarity = cosineSimilarity(embedding, otherEmbedding);
    
    if (similarity >= threshold) {
      similarTabs.push({...otherTab, similarity});
    }
  }
  
  return similarTabs.sort((a, b) => b.similarity - a.similarity);
}
```

### Code Example: Tab Processing

```typescript
// src/ai/services/tabProcessor.ts
import { ollama, embeddings } from './ollama';
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";

export class TabProcessor {
  private vectorStore: MemoryVectorStore;

  constructor() {
    this.vectorStore = new MemoryVectorStore(embeddings);
  }

  async processTab(tab: chrome.tabs.Tab): Promise<TabAnalysis> {
    const doc = new Document({
      pageContent: `${tab.title}\n${tab.url}`,
      metadata: { 
        id: tab.id,
        url: tab.url,
        timestamp: new Date().toISOString()
      }
    });

    await this.vectorStore.addDocuments([doc]);
    
    // Get similar tabs
    const similarTabs = await this.vectorStore.similaritySearch(tab.title, 3);
    
    // Categorize tab
    const category = await this.categorizeTab(tab);
    
    return {
      id: tab.id,
      category,
      relatedTabs: similarTabs.map(t => t.metadata.id),
      metadata: tab
    };
  }

  private async categorizeTab(tab: chrome.tabs.Tab): Promise<string> {
    const prompt = `
      Categorize this tab into one of: 
      Work, Research, Entertainment, Shopping, Social, News, Tools, Other
      
      Title: ${tab.title}
      URL: ${tab.url}
      
      Return only the category name, nothing else.
    `;
    
    return ollama.call(prompt);
  }
}
```

## 5. System Requirements

### Minimum
- 8GB RAM
- 4 CPU cores
- 10GB free disk space (for models)

### Recommended
- 16GB+ RAM
- 8 CPU cores / Apple M1+
- 20GB+ free disk space

## 6. Installation Instructions

### 1. Install Ollama
```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows (via winget)
winget install ollama.ollama
```

### 2. Download Models
```bash
# Base LLM
ollama pull llama3

# Embedding model
ollama pull nomic-embed-text
```

### 3. Install Dependencies
```bash
npm install langchain @langchain/community
```

## 7. Configuration

### Environment Variables
```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=llama3
EMBEDDING_MODEL=nomic-embed-text

# Vector Store
VECTOR_STORE=memory  # or 'chroma' for persistent storage
CHROMA_URL=http://localhost:8000
```

## 8. Advanced Features

### 1. Session Analysis
- Track tab usage patterns over time
- Identify productive vs. distracting browsing sessions
- Generate daily/weekly activity reports

### 2. Smart Tab Groups
- Automatic tab grouping by topic
- Project-based organization
- Custom grouping rules

### 3. Cross-Device Synchronization
- Real-time tab sync across devices
- Conflict resolution for concurrent edits
- Offline support with eventual consistency

### 4. Privacy Controls
- Granular permission system
- Local-only processing option
- Data retention policies

## 9. Performance Considerations

1. **Model Size vs. Performance**
   - 7B models: ~4GB RAM, good for most tasks
   - 13B models: ~8GB RAM, better quality, slower
   - 20B+ models: 16GB+ RAM, best quality, requires powerful hardware

2. **Batch Processing**
   - Process tabs in batches of 5-10
   - Use web workers for CPU-intensive tasks
   - Cache embeddings for better performance

## 10. Integration Examples

### Browser Extension Integration
```typescript
// Example: Chrome extension background script
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const tabAnalysis = await tabProcessor.processTab(tab);
    // Send analysis to UI or store for later use
  }
});
```

### API Endpoints
```typescript
// Example: Express route for tab analysis
app.post('/api/tabs/analyze', async (req, res) => {
  try {
    const { tabs } = req.body;
    const analysis = await Promise.all(
      tabs.map(tab => tabProcessor.processTab(tab))
    );
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed' });
  }
});
```

## 11. Future Enhancements

1. **Advanced Analytics**
   - Usage pattern recognition
   - Productivity insights
   - Custom reporting

2. **Enhanced Privacy**
   - Differential privacy
   - On-device processing
   - Secure multi-party computation

3. **AI-Powered Features**
   - Automated tab organization
   - Smart tab search
   - Context-aware suggestions

## 10. Monitoring and Maintenance

1. **Logging**
   - Track model performance
   - Monitor memory usage
   - Log processing times

2. **Updates**
   - Regular model updates
   - Security patches
   - Performance optimizations