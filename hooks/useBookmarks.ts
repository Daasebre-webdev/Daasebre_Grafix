'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/app/context/UserContext';

interface BookmarkHook {
  isBookmarked: (projectId: string) => boolean;
  toggleBookmark: (projectId: string) => boolean;
  bookmarkedIds: string[];
  isLoading: boolean;
}

export const useBookmarks = (): BookmarkHook => {
  const { user } = useUser();
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Safe JSON parse with error handling
  const safeJsonParse = <T,>(jsonString: string): T | null => {
    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      return null;
    }
  };

  // Load bookmarks when user changes
  useEffect(() => {
    const loadBookmarks = () => {
      try {
        setIsLoading(true);
        
        if (!user) {
          setBookmarkedIds([]);
          return;
        }

        const bookmarkKey = `bookmarks_${user.id}`;
        const storedBookmarks = localStorage.getItem(bookmarkKey);
        const parsedBookmarks = storedBookmarks 
          ? safeJsonParse<string[]>(storedBookmarks) 
          : [];
        
        setBookmarkedIds(parsedBookmarks || []);
      } catch (error) {
        console.error('Failed to load bookmarks:', error);
        setBookmarkedIds([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadBookmarks();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `bookmarks_${user?.id}`) {
        loadBookmarks();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user]);

  const isBookmarked = (projectId: string): boolean => {
    return bookmarkedIds.includes(projectId);
  };

  const toggleBookmark = (projectId: string): boolean => {
    if (!user || isLoading) return false;

    try {
      const bookmarkKey = `bookmarks_${user.id}`;
      const updatedIds = isBookmarked(projectId)
        ? bookmarkedIds.filter(id => id !== projectId)
        : [...bookmarkedIds, projectId];

      localStorage.setItem(bookmarkKey, JSON.stringify(updatedIds));
      setBookmarkedIds(updatedIds);
      window.dispatchEvent(new Event('bookmarks-updated'));
      return true;
    } catch (error) {
      console.error('Failed to update bookmarks:', error);
      return false;
    }
  };

  return { isBookmarked, toggleBookmark, bookmarkedIds, isLoading };
};