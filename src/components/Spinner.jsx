import React from 'react';

const Spinner = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
  };

  return (
    <div className="flex justify-center items-center py-8">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-solid border-green-500 border-t-transparent`}
      ></div>
    </div>
  );
};

export default Spinner;