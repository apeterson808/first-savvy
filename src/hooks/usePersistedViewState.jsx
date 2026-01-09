import { useState, useEffect, useRef, useCallback } from 'react';
import { getViewPreferences, saveViewPreferences } from '../api/viewPreferences';

function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

export function usePersistedViewState(viewName, defaultValue, profileId, override = null) {
  const [value, setValue] = useState(override !== null ? override : defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef(null);
  const profileIdRef = useRef(profileId);
  const mountedRef = useRef(true);
  const lastSavedValueRef = useRef(null);
  const overrideActiveRef = useRef(override !== null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    overrideActiveRef.current = override !== null;
    if (override !== null) {
      setValue(override);
    }
  }, [override]);

  const loadPreferences = useCallback(async () => {
    if (!profileId || !viewName || overrideActiveRef.current) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await getViewPreferences(profileId, viewName);

      if (mountedRef.current && !error && data !== null) {
        setValue(data);
        lastSavedValueRef.current = data;
      } else if (mountedRef.current) {
        setValue(defaultValue);
        lastSavedValueRef.current = defaultValue;
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
      if (mountedRef.current) {
        setValue(defaultValue);
        lastSavedValueRef.current = defaultValue;
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [profileId, viewName, defaultValue]);

  useEffect(() => {
    if (profileIdRef.current !== profileId) {
      profileIdRef.current = profileId;
      setIsLoading(true);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      loadPreferences();
    }
  }, [profileId, loadPreferences]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const debouncedSave = useCallback(
    (newValue) => {
      if (!profileId || !viewName || overrideActiveRef.current) {
        return;
      }

      if (deepEqual(newValue, lastSavedValueRef.current)) {
        return;
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const { error } = await saveViewPreferences(profileId, viewName, newValue);

          if (!error && mountedRef.current) {
            lastSavedValueRef.current = newValue;
          } else if (error) {
            console.error('Failed to save preferences:', error);
          }
        } catch (err) {
          console.error('Exception saving preferences:', err);
        }
      }, 500);
    },
    [profileId, viewName]
  );

  const setPersistedValue = useCallback(
    (newValueOrUpdater) => {
      setValue((prevValue) => {
        const newValue =
          typeof newValueOrUpdater === 'function'
            ? newValueOrUpdater(prevValue)
            : newValueOrUpdater;

        if (!overrideActiveRef.current) {
          debouncedSave(newValue);
        }

        return newValue;
      });
    },
    [debouncedSave]
  );

  return [value, setPersistedValue, isLoading];
}
