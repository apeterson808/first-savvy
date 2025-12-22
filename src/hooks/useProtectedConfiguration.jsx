import { useState, useEffect, useCallback } from 'react';
import { protectedConfigurationService } from '@/api/protectedConfigurations';
import { configIntegrityChecker } from '@/utils/configurationProtection';

export function useProtectedConfiguration(configName) {
  const [configuration, setConfiguration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [integrity, setIntegrity] = useState(null);

  useEffect(() => {
    loadConfiguration();
  }, [configName]);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);

      const config = await protectedConfigurationService.getConfiguration(configName);
      setConfiguration(config);

      if (configName === 'category_dropdown_system') {
        await configIntegrityChecker.initialize();
        const integrityCheck = await configIntegrityChecker.verifyCategoryDropdownIntegrity();
        setIntegrity(integrityCheck);
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to load protected configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = useCallback(() => {
    loadConfiguration();
  }, [configName]);

  return {
    configuration,
    loading,
    error,
    integrity,
    refresh
  };
}

export function useProtectedChangeDialog() {
  console.log('[useProtectedChangeDialog] Hook called');
  const [isOpen, setIsOpen] = useState(false);
  const [dialogData, setDialogData] = useState(null);

  useEffect(() => {
    console.log('[useProtectedChangeDialog useEffect] Setting up event listener');
    const handleShowDialog = (event) => {
      console.log('[useProtectedChangeDialog] Event received, updating state');
      setDialogData(event.detail);
      setIsOpen(true);
    };

    window.addEventListener('show-protected-change-dialog', handleShowDialog);

    return () => {
      window.removeEventListener('show-protected-change-dialog', handleShowDialog);
    };
  }, []);

  const handleConfirm = useCallback(async () => {
    if (dialogData?.configuration) {
      await configIntegrityChecker.recordModification(
        dialogData.configuration.name,
        { description: 'User confirmed protected change' },
        true
      );
    }

    if (dialogData?.onConfirm) {
      dialogData.onConfirm();
    }

    setIsOpen(false);
    setDialogData(null);
  }, [dialogData]);

  const handleCancel = useCallback(() => {
    if (dialogData?.onCancel) {
      dialogData.onCancel();
    }

    setIsOpen(false);
    setDialogData(null);
  }, [dialogData]);

  console.log('[useProtectedChangeDialog] Returning values');

  return {
    isOpen,
    setIsOpen,
    dialogData,
    handleConfirm,
    handleCancel
  };
}

export function useConfigurationManagement() {
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const configs = await protectedConfigurationService.getAllConfigurations();
      setConfigurations(configs);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load configurations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const lock = useCallback(async (id) => {
    try {
      await protectedConfigurationService.lockConfiguration(id);
      await loadAll();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAll]);

  const unlock = useCallback(async (id) => {
    try {
      await protectedConfigurationService.unlockConfiguration(id);
      await loadAll();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAll]);

  const getHistory = useCallback(async (configId) => {
    try {
      return await protectedConfigurationService.getChangeHistory(configId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const restore = useCallback(async (configId, version) => {
    try {
      await protectedConfigurationService.restoreVersion(configId, version);
      await loadAll();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [loadAll]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    configurations,
    loading,
    error,
    lock,
    unlock,
    getHistory,
    restore,
    refresh: loadAll
  };
}
