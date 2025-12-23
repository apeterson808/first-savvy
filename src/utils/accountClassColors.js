export const getClassBadgeColor = (classType) => {
  const colors = {
    'asset': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'liability': 'bg-rose-100 text-rose-700 border-rose-200',
    'income': 'bg-sky-100 text-sky-700 border-sky-200',
    'expense': 'bg-orange-100 text-orange-700 border-orange-200',
    'equity': 'bg-purple-100 text-purple-700 border-purple-200'
  };
  return colors[classType] || 'bg-gray-100 text-gray-800 border-gray-200';
};

export const getClassColor = (classType) => {
  const colors = {
    'asset': {
      light: 'bg-emerald-50',
      medium: 'bg-emerald-100',
      dark: 'bg-emerald-600',
      text: 'text-emerald-700',
      textDark: 'text-emerald-900',
      border: 'border-emerald-200',
      hover: 'hover:bg-emerald-100',
      ring: 'ring-emerald-500'
    },
    'liability': {
      light: 'bg-rose-50',
      medium: 'bg-rose-100',
      dark: 'bg-rose-600',
      text: 'text-rose-700',
      textDark: 'text-rose-900',
      border: 'border-rose-200',
      hover: 'hover:bg-rose-100',
      ring: 'ring-rose-500'
    },
    'income': {
      light: 'bg-sky-50',
      medium: 'bg-sky-100',
      dark: 'bg-sky-600',
      text: 'text-sky-700',
      textDark: 'text-sky-900',
      border: 'border-sky-200',
      hover: 'hover:bg-sky-100',
      ring: 'ring-sky-500'
    },
    'expense': {
      light: 'bg-orange-50',
      medium: 'bg-orange-100',
      dark: 'bg-orange-600',
      text: 'text-orange-700',
      textDark: 'text-orange-900',
      border: 'border-orange-200',
      hover: 'hover:bg-orange-100',
      ring: 'ring-orange-500'
    },
    'equity': {
      light: 'bg-purple-50',
      medium: 'bg-purple-100',
      dark: 'bg-purple-600',
      text: 'text-purple-700',
      textDark: 'text-purple-900',
      border: 'border-purple-200',
      hover: 'hover:bg-purple-100',
      ring: 'ring-purple-500'
    }
  };
  return colors[classType] || {
    light: 'bg-gray-50',
    medium: 'bg-gray-100',
    dark: 'bg-gray-600',
    text: 'text-gray-700',
    textDark: 'text-gray-900',
    border: 'border-gray-200',
    hover: 'hover:bg-gray-100',
    ring: 'ring-gray-500'
  };
};

export const getClassIcon = (classType) => {
  const icons = {
    'asset': '💰',
    'liability': '📊',
    'income': '💵',
    'expense': '🛒',
    'equity': '⚖️'
  };
  return icons[classType] || '📁';
};
