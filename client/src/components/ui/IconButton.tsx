import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'neutral' | 'danger';
  'aria-label': string; // Required for accessibility
  children: React.ReactNode;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'neutral', className = '', disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
    
    const variantStyles = {
      neutral: 'text-gray-500 hover:text-gray-700',
      danger: 'text-red-500 hover:text-red-700',
    };
    
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default IconButton;
