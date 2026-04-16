import React from 'react';

export const Toothbrush = React.forwardRef(({ className, size = 24, color = 'currentColor', strokeWidth = 2, ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M3 21 L17 7" />
    <path d="M17 7 C17 7 19 5 21 3" />
    <path d="M14 4 L20 10" />
    <path d="M14 4 C14 4 12 6 14 8 C16 10 18 8 20 10" />
  </svg>
));
Toothbrush.displayName = 'Toothbrush';

export const Tooth = React.forwardRef(({ className, size = 24, color = 'currentColor', strokeWidth = 2, ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M8 3 C5 3 3 5 3 8 C3 10 4 11 4 13 L5 21 C5.5 21 6 20 6.5 18 L7.5 18 C8 20 8.5 21 9 21 L10 21 C10.5 21 11 20 11.5 18 L12.5 18 C13 20 13.5 21 14 21 L15 21 C15.5 21 16 20 16 18 L17 13 C17 11 18 10 18 8 C18 5 16 3 13 3 C11.5 3 10.5 4 10.5 4 C10.5 4 9.5 3 8 3 Z" />
  </svg>
));
Tooth.displayName = 'Tooth';
