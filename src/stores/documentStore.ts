import { create } from 'zustand';
import { ShadowSuggestion, Document } from '@/types';
import { generateId, countWords } from '@/lib/utils';
import * as documentsService from '@/services/documents';
import { DocumentMetadata } from '@/services/documents';

interface DocumentState {
  // Current document state
  content: string;
  title: string;
  wordCount: number;
  shadowSuggestion: ShadowSuggestion | null;
  isRefining: boolean;
  
  // Document management state
  activeDocumentId: string | null;
  documents: DocumentMetadata[];
  isLoadingDocuments: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  
  // Current document actions
  setContent: (content: string) => void;
  setTitle: (title: string) => void;
  setShadowSuggestion: (suggestion: ShadowSuggestion | null) => void;
  acceptSuggestion: () => { from: number; to: number; text: string } | null;
  rejectSuggestion: () => void;
  setIsRefining: (isRefining: boolean) => void;
  
  // Document management actions
  fetchDocuments: () => Promise<void>;
  createNewDocument: () => Promise<string>;
  loadDocument: (id: string) => Promise<void>;
  saveDocument: () => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  clearActiveDocument: () => void;
}

const AUTOSAVE_DELAY = 2000; // 2 seconds
let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;

export const useDocumentStore = create<DocumentState>((set, get) => ({
  // Current document state
  content: '',
  title: 'Untitled',
  wordCount: 0,
  shadowSuggestion: null,
  isRefining: false,
  
  // Document management state
  activeDocumentId: null,
  documents: [],
  isLoadingDocuments: false,
  isSaving: false,
  lastSaved: null,
  hasUnsavedChanges: false,

  setContent: (content) => {
    const wordCount = countWords(content);
    set({
      content,
      wordCount,
      hasUnsavedChanges: true,
    });
    
    // Trigger autosave
    const { activeDocumentId, saveDocument } = get();
    if (activeDocumentId) {
      if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
      }
      autosaveTimeout = setTimeout(() => {
        saveDocument();
      }, AUTOSAVE_DELAY);
    }
  },

  setTitle: (title) => {
    set({ title, hasUnsavedChanges: true });
    
    // Trigger autosave
    const { activeDocumentId, saveDocument } = get();
    if (activeDocumentId) {
      if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
      }
      autosaveTimeout = setTimeout(() => {
        saveDocument();
      }, AUTOSAVE_DELAY);
    }
  },

  setShadowSuggestion: (suggestion) =>
    set({ shadowSuggestion: suggestion }),

  acceptSuggestion: () => {
    const { shadowSuggestion } = get();
    if (!shadowSuggestion) return null;

    const result = {
      from: shadowSuggestion.position.from,
      to: shadowSuggestion.position.to,
      text: shadowSuggestion.suggestedText,
    };

    set({ shadowSuggestion: null });

    return result;
  },

  rejectSuggestion: () =>
    set({ shadowSuggestion: null }),

  setIsRefining: (isRefining) =>
    set({ isRefining }),

  // Document management actions
  fetchDocuments: async () => {
    set({ isLoadingDocuments: true });
    try {
      const documents = await documentsService.fetchAllDocuments();
      set({ documents, isLoadingDocuments: false });
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      set({ isLoadingDocuments: false });
    }
  },

  createNewDocument: async () => {
    const id = generateId();
    const { saveDocument: currentSave, activeDocumentId, hasUnsavedChanges } = get();
    
    // Save current document first if there are unsaved changes
    if (activeDocumentId && hasUnsavedChanges) {
      await currentSave();
    }
    
    try {
      await documentsService.createDocument({
        id,
        title: 'Untitled',
        content: '',
        wordCount: 0,
      });
      
      set({
        activeDocumentId: id,
        title: 'Untitled',
        content: '',
        wordCount: 0,
        hasUnsavedChanges: false,
        lastSaved: new Date(),
      });
      
      // Refresh document list
      await get().fetchDocuments();
      
      // Store active document ID in localStorage for persistence
      localStorage.setItem('exlibris_active_document', id);
      
      return id;
    } catch (error) {
      console.error('Failed to create document:', error);
      throw error;
    }
  },

  loadDocument: async (id: string) => {
    const { saveDocument: currentSave, activeDocumentId, hasUnsavedChanges } = get();
    
    // Save current document first if there are unsaved changes
    if (activeDocumentId && hasUnsavedChanges) {
      await currentSave();
    }
    
    try {
      const document = await documentsService.fetchDocument(id);
      
      set({
        activeDocumentId: document.id,
        title: document.title,
        content: document.content,
        wordCount: document.wordCount,
        hasUnsavedChanges: false,
        lastSaved: document.lastModified,
      });
      
      // Store active document ID in localStorage for persistence
      localStorage.setItem('exlibris_active_document', id);
    } catch (error) {
      console.error('Failed to load document:', error);
      throw error;
    }
  },

  saveDocument: async () => {
    const { activeDocumentId, title, content, wordCount, isSaving } = get();
    
    if (!activeDocumentId || isSaving) return;
    
    set({ isSaving: true });
    
    try {
      await documentsService.updateDocument(activeDocumentId, {
        title,
        content,
        wordCount,
      });
      
      set({
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
      });
      
      // Refresh document list to update metadata
      await get().fetchDocuments();
    } catch (error) {
      console.error('Failed to save document:', error);
      set({ isSaving: false });
      throw error;
    }
  },

  deleteDocument: async (id: string) => {
    const { activeDocumentId, clearActiveDocument, fetchDocuments } = get();
    
    try {
      await documentsService.deleteDocument(id);
      
      // If we deleted the active document, clear it
      if (activeDocumentId === id) {
        clearActiveDocument();
      }
      
      // Refresh document list
      await fetchDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  },

  clearActiveDocument: () => {
    localStorage.removeItem('exlibris_active_document');
    set({
      activeDocumentId: null,
      title: 'Untitled',
      content: '',
      wordCount: 0,
      hasUnsavedChanges: false,
      lastSaved: null,
    });
  },
}));