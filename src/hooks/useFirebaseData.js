"use client";
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { ref, onValue } from "firebase/database";

/**
 * Generic hook untuk Firebase Realtime Database data fetching
 * @param {string} path - Firebase database path
 * @param {boolean} enabled - Whether to enable the listener (default: true)
 * @returns {{ data, loading, error }}
 */
export function useFirebaseData(path, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = onValue(
        ref(db, path),
        (snapshot) => {
          if (snapshot.exists()) {
            setData(snapshot.val());
          } else {
            setData(null);
          }
          setLoading(false);
        },
        (err) => {
          setError(err);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  }, [path, enabled]);

  return { data, loading, error };
}

/**
 * Hook untuk listen ke multiple Firebase paths sekaligus
 * @param {Array<{key: string, path: string}>} paths - Array of key-path pairs
 * @returns {{ data, loading, errors }}
 */
export function useFirebaseMultiple(paths) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!paths || paths.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribes = [];

    paths.forEach(({ key, path }) => {
      if (!path) return;

      try {
        const unsubscribe = onValue(
          ref(db, path),
          (snapshot) => {
            if (snapshot.exists()) {
              setData((prev) => ({ ...prev, [key]: snapshot.val() }));
            } else {
              setData((prev) => ({ ...prev, [key]: null }));
            }

            // Check if all paths have been loaded
            const allLoaded = paths.every(
              (p) => data[p.key] !== undefined || errors[p.key] !== undefined
            );
            if (allLoaded) setLoading(false);
          },
          (err) => {
            setErrors((prev) => ({ ...prev, [key]: err }));
            setLoading(false);
          }
        );

        unsubscribes.push(unsubscribe);
      } catch (err) {
        setErrors((prev) => ({ ...prev, [key]: err }));
      }
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [paths.map((p) => p.path).join(",")]);

  return { data, loading, errors };
}