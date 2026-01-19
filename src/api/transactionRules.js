import { firstsavvy } from './firstsavvyClient';

export const transactionRulesApi = {
  async getCategorizationRules(profileId) {
    const data = await firstsavvy.entities.CategorizationRule.filter(
      { profile_id: profileId },
      '-priority'
    );
    return data;
  },

  async getActiveCategorizationRules(profileId) {
    const data = await firstsavvy.entities.CategorizationRule.filter(
      { profile_id: profileId, is_active: true },
      '-priority'
    );
    return data;
  },

  async createCategorizationRule(rule) {
    const data = await firstsavvy.entities.CategorizationRule.create(rule);
    return data;
  },

  async updateCategorizationRule(id, updates) {
    const data = await firstsavvy.entities.CategorizationRule.update(id, updates);
    return data;
  },

  async deleteCategorizationRule(id) {
    await firstsavvy.entities.CategorizationRule.delete(id);
    return true;
  },

  async getContactMatchingRules(profileId) {
    const data = await firstsavvy.entities.ContactMatchingRule.filter(
      { profile_id: profileId },
      '-priority'
    );
    return data;
  },

  async getActiveContactMatchingRules(profileId) {
    const data = await firstsavvy.entities.ContactMatchingRule.filter(
      { profile_id: profileId, is_active: true },
      '-priority'
    );
    return data;
  },

  async createContactMatchingRule(rule) {
    const data = await firstsavvy.entities.ContactMatchingRule.create(rule);
    return data;
  },

  async updateContactMatchingRule(id, updates) {
    const data = await firstsavvy.entities.ContactMatchingRule.update(id, updates);
    return data;
  },

  async deleteContactMatchingRule(id) {
    await firstsavvy.entities.ContactMatchingRule.delete(id);
    return true;
  },

  matchDescription(description, matchType, matchValue) {
    const desc = description.toLowerCase();
    const value = matchValue.toLowerCase();

    switch (matchType) {
      case 'exact':
        return desc === value;
      case 'contains':
        return desc.includes(value);
      case 'starts_with':
        return desc.startsWith(value);
      case 'ends_with':
        return desc.endsWith(value);
      case 'regex':
        try {
          const regex = new RegExp(value, 'i');
          return regex.test(description);
        } catch (e) {
          console.error('Invalid regex pattern:', value, e);
          return false;
        }
      default:
        return false;
    }
  },

  async applyCategorizationRules(transactions, profileId) {
    const rules = await this.getActiveCategorizationRules(profileId);
    const updates = [];

    for (const txn of transactions) {
      if (txn.category_account_id || txn.type === 'transfer') continue;

      const matchingRule = rules.find(rule => {
        if (rule.transaction_type !== 'all' && rule.transaction_type !== txn.type) {
          return false;
        }
        return this.matchDescription(txn.description, rule.match_type, rule.match_value);
      });

      if (matchingRule) {
        updates.push({
          id: txn.id,
          category_account_id: matchingRule.category_account_id
        });
      }
    }

    return updates;
  },

  async applyContactMatchingRules(transactions, profileId) {
    const rules = await this.getActiveContactMatchingRules(profileId);
    const updates = [];

    for (const txn of transactions) {
      if (txn.contact_id) continue;

      const matchingRule = rules.find(rule => {
        if (rule.transaction_type !== 'all' && rule.transaction_type !== txn.type) {
          return false;
        }
        return this.matchDescription(txn.description, rule.match_type, rule.match_value);
      });

      if (matchingRule) {
        updates.push({
          id: txn.id,
          contact_id: matchingRule.contact_id
        });
      }
    }

    return updates;
  },

  async applyAllRules(transactions, profileId) {
    const categorizationUpdates = await this.applyCategorizationRules(transactions, profileId);
    const contactUpdates = await this.applyContactMatchingRules(transactions, profileId);

    const updateMap = new Map();

    categorizationUpdates.forEach(update => {
      updateMap.set(update.id, { ...updateMap.get(update.id), ...update });
    });

    contactUpdates.forEach(update => {
      updateMap.set(update.id, { ...updateMap.get(update.id), ...update });
    });

    const allUpdates = Array.from(updateMap.values());

    if (allUpdates.length > 0) {
      await Promise.all(
        allUpdates.map(update =>
          firstsavvy.entities.Transaction.update(update.id, {
            category_account_id: update.category_account_id,
            contact_id: update.contact_id
          })
        )
      );
    }

    return allUpdates;
  },

  async getTransactionSplits(transactionId) {
    const data = await firstsavvy.entities.TransactionSplit.filter({
      transaction_id: transactionId
    });
    return data;
  },

  async createTransactionSplits(transactionId, splits) {
    const splitsToCreate = splits.map(split => ({
      ...split,
      transaction_id: transactionId
    }));

    const data = await firstsavvy.entities.TransactionSplit.bulkCreate(splitsToCreate);

    await firstsavvy.entities.Transaction.update(transactionId, {
      is_split: true
    });

    return data;
  },

  async updateTransactionSplits(transactionId, splits) {
    const existingSplits = await this.getTransactionSplits(transactionId);

    await Promise.all(
      existingSplits.map(split =>
        firstsavvy.entities.TransactionSplit.delete(split.id)
      )
    );

    if (splits.length === 0) {
      await firstsavvy.entities.Transaction.update(transactionId, {
        is_split: false
      });
      return [];
    }

    return this.createTransactionSplits(transactionId, splits);
  },

  async deleteTransactionSplits(transactionId) {
    const splits = await this.getTransactionSplits(transactionId);

    await Promise.all(
      splits.map(split =>
        firstsavvy.entities.TransactionSplit.delete(split.id)
      )
    );

    await firstsavvy.entities.Transaction.update(transactionId, {
      is_split: false
    });

    return true;
  },

  async validateSplitTotals(transactionId) {
    const { data, error } = await firstsavvy.rpc('validate_transaction_splits', {
      p_transaction_id: transactionId
    });

    if (error) throw error;
    return data[0];
  }
};

export default transactionRulesApi;
