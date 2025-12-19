import { protectedConfigurationService } from '@/api/protectedConfigurations';
import { DETAIL_TYPE_LABELS, getAccountDisplayName } from '@/components/utils/constants';

export class ConfigurationIntegrityChecker {
  constructor() {
    this.protectedConfigs = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const configs = await protectedConfigurationService.getAllConfigurations();
      configs.forEach(config => {
        this.protectedConfigs.set(config.name, config);
      });
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize configuration protection:', error);
    }
  }

  isProtectedFile(filePath) {
    for (const [, config] of this.protectedConfigs) {
      if (config.file_paths && config.file_paths.includes(filePath)) {
        return {
          protected: true,
          configuration: config
        };
      }
    }
    return { protected: false };
  }

  async verifyCategoryDropdownIntegrity() {
    const configName = 'category_dropdown_system';
    const config = this.protectedConfigs.get(configName) ||
                   await protectedConfigurationService.getConfiguration(configName);

    if (!config) {
      return {
        valid: true,
        warning: 'No protected configuration found - protection not enabled'
      };
    }

    const currentLogic = this.extractCurrentCategoryLogic();
    const baselineLogic = config.configuration_data;

    const differences = this.compareLogic(currentLogic, baselineLogic);

    return {
      valid: differences.length === 0,
      differences,
      configuration: config,
      requiresConfirmation: config.is_locked && differences.length > 0
    };
  }

  extractCurrentCategoryLogic() {
    return {
      detailTypeLabels: DETAIL_TYPE_LABELS,
      displayNameFunction: getAccountDisplayName.toString(),
      filteringApproach: {
        transferHandling: 'Separate income/expense transfer categories',
        normalCategories: 'Filter by type and exclude transfers',
        aiSuggestion: 'Show suggested category first'
      }
    };
  }

  compareLogic(current, baseline) {
    const differences = [];

    if (!baseline || !baseline.filteringRules) {
      return differences;
    }

    const baselineRules = baseline.filteringRules;
    const currentRules = current.filteringApproach;

    if (currentRules.transferHandling !== baselineRules.transferHandling?.description) {
      differences.push({
        type: 'transfer_handling',
        baseline: baselineRules.transferHandling,
        current: currentRules.transferHandling
      });
    }

    return differences;
  }

  async checkBeforeModification(configName) {
    const config = this.protectedConfigs.get(configName) ||
                   await protectedConfigurationService.getConfiguration(configName);

    if (!config) {
      return { allowed: true, requiresConfirmation: false };
    }

    if (!config.is_locked) {
      return { allowed: true, requiresConfirmation: false };
    }

    return {
      allowed: false,
      requiresConfirmation: true,
      configuration: config,
      message: 'This configuration is protected and requires explicit confirmation to modify'
    };
  }

  async recordModification(configName, modification, userConfirmed = false) {
    const config = this.protectedConfigs.get(configName);

    if (!config) {
      return { success: true, warning: 'Configuration not protected' };
    }

    if (config.is_locked && !userConfirmed) {
      throw new Error('Modification requires user confirmation');
    }

    try {
      await protectedConfigurationService.logChange({
        configuration_id: config.id,
        change_type: 'modification',
        change_description: modification.description,
        confirmed_at: userConfirmed ? new Date().toISOString() : null
      });

      return { success: true, logged: true };
    } catch (error) {
      console.error('Failed to record modification:', error);
      return { success: false, error: error.message };
    }
  }
}

export const configIntegrityChecker = new ConfigurationIntegrityChecker();

export async function requireProtectedChangeConfirmation(configName) {
  const check = await configIntegrityChecker.checkBeforeModification(configName);

  if (check.requiresConfirmation) {
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('show-protected-change-dialog', {
        detail: {
          configurationName: configName,
          configuration: check.configuration,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false)
        }
      }));
    });
  }

  return true;
}

export function watchProtectedFiles() {
  const protectedFiles = [
    'src/components/common/CategoryDropdown.jsx',
    'src/components/utils/constants.jsx'
  ];

  if (import.meta.hot) {
    import.meta.hot.on('vite:beforeUpdate', async (update) => {
      const updatedFiles = update.updates?.map(u => u.path) || [];

      for (const file of updatedFiles) {
        const isProtected = protectedFiles.some(pf => file.includes(pf));

        if (isProtected) {
          console.warn(`⚠️ Protected file modified: ${file}`);
          console.warn('This file is protected and changes should be reviewed.');

          await configIntegrityChecker.initialize();
          const integrity = await configIntegrityChecker.verifyCategoryDropdownIntegrity();

          if (!integrity.valid) {
            console.error('Protected configuration integrity check failed:', integrity.differences);
          }
        }
      }
    });
  }
}
