import React, { createContext, useContext, useState, useCallback } from 'react';

const DropdownContext = createContext(null);

export function DropdownProvider({ children }) {
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const registerDropdown = useCallback((dropdownId, isOpen) => {
    if (isOpen) {
      setOpenDropdownId(dropdownId);
    } else if (openDropdownId === dropdownId) {
      setOpenDropdownId(null);
    }
  }, [openDropdownId]);

  const isDropdownOpen = useCallback((dropdownId) => {
    return openDropdownId === dropdownId;
  }, [openDropdownId]);

  const closeAllDropdowns = useCallback(() => {
    setOpenDropdownId(null);
  }, []);

  return (
    <DropdownContext.Provider value={{ registerDropdown, isDropdownOpen, closeAllDropdowns, openDropdownId }}>
      {children}
    </DropdownContext.Provider>
  );
}

export function useDropdownContext() {
  const context = useContext(DropdownContext);
  if (!context) {
    return {
      registerDropdown: () => {},
      isDropdownOpen: () => false,
      closeAllDropdowns: () => {},
      openDropdownId: null
    };
  }
  return context;
}
