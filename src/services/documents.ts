import { Document } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface DocumentMetadata {
  id: string;
  title: string;
  wordCount: number;
  createdAt: string;
  lastModified: string;
}

export async function fetchAllDocuments(): Promise<DocumentMetadata[]> {
  const response = await fetch(`${API_URL}/api/documents`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }
  
  return response.json();
}

export async function fetchDocument(id: string): Promise<Document> {
  const response = await fetch(`${API_URL}/api/documents/${id}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Document not found');
    }
    throw new Error('Failed to fetch document');
  }
  
  const data = await response.json();
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    lastModified: new Date(data.lastModified),
  };
}

export async function createDocument(document: {
  id: string;
  title: string;
  content: string;
  wordCount: number;
}): Promise<Document> {
  const response = await fetch(`${API_URL}/api/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(document),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create document');
  }
  
  const data = await response.json();
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    lastModified: new Date(data.lastModified),
  };
}

export async function updateDocument(
  id: string,
  updates: {
    title: string;
    content: string;
    wordCount: number;
  }
): Promise<Document> {
  const response = await fetch(`${API_URL}/api/documents/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update document');
  }
  
  const data = await response.json();
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    lastModified: new Date(data.lastModified),
  };
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/documents/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
}

