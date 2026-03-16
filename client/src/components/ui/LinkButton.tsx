import React from 'react';

export interface LinkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'success' | 'warning';
  children: React.ReactNode;
}

const LinkButton = React.forwardRef<HTMLButtonElement, LinkButtonProps>(
  ({ variant = 'primary', className = '', disabled, children, ...props }, ref) => {
    const baseStyles = 'font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantStyles = {
      primary: 'text-blue-600 hover:text-blue-900',
      danger: 'text-red-600 hover:text-red-900',
      success: 'text-green-600 hover:text-green-900',
      warning: 'text-yellow-600 hover:text-yellow-900',
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

LinkButton.displayName = 'LinkButton';

export default LinkButton;
