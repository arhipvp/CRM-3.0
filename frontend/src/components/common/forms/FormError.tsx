import React from 'react';

interface FormErrorProps {
  message?: string | null;
}

export const FormError: React.FC<FormErrorProps> = ({ message }) => {
  if (!message) {
    return null;
  }

  return <p className="app-alert app-alert-danger">{message}</p>;
};
