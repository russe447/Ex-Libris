export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ShadowSuggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  instruction: string;
  position: {
    from: number;
    to: number;
  };
  status: 'pending' | 'accepted' | 'rejected';
}

export interface Document {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  lastModified: Date;
  createdAt: Date;
}

export interface RefineRequest {
  selectedText: string;
  instruction: string;
  precedingContext: string;
}

export interface RefineResponse {
  refinedText: string;
}