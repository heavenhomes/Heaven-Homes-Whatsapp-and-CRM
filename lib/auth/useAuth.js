"use client";
import { useEffect, useState } from 'react';

let cache = null; // simple in-memory cache for the current session

export function useAuth() {
  const [user, setUser] = useState(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.status === 401) {
          cache = null;
          if (!cancelled) setUser(null);
        } else {
          const json = await res.json();
          if (json.success) {
            cache = json.data;
            if (!cancelled) setUser(json.data);
          }
        }
      } catch {
        cache = null;
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { user, loading, isOwner: user?.role === 'owner' };
}