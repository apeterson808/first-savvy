import { useQuery } from '@tanstack/react-query';
import { accountClassifications } from '@/api/accountClassifications';

export function useAccountClassifications(options = {}) {
  const { classFilter = null, typeFilter = null } = options;

  const queryKey = ['account-classifications', classFilter, typeFilter];

  const queryFn = () => {
    if (classFilter && typeFilter) {
      return accountClassifications.getByClassAndType(classFilter, typeFilter);
    } else if (classFilter) {
      return accountClassifications.getByClass(classFilter);
    } else if (typeFilter) {
      return accountClassifications.getByType(typeFilter);
    }
    return accountClassifications.getAll();
  };

  const { data: classifications = [], isLoading, error } = useQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000
  });

  const types = Array.from(new Set(classifications.map(c => c.type))).sort();

  const getByType = (type) => {
    return classifications.filter(c => c.type === type);
  };

  const getById = (id) => {
    return classifications.find(c => c.id === id);
  };

  const getDisplayName = (classification) => {
    return accountClassifications.getDisplayName(classification);
  };

  const isSystemDefined = (classification) => {
    return accountClassifications.isSystemDefined(classification);
  };

  return {
    classifications,
    types,
    isLoading,
    error,
    getByType,
    getById,
    getDisplayName,
    isSystemDefined
  };
}

export function useAccountClassification(classificationId) {
  const { getById, isLoading } = useAccountClassifications();

  return {
    classification: classificationId ? getById(classificationId) : null,
    isLoading
  };
}
