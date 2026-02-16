import React from 'react';

import { Modal } from '../../Modal';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface FormModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
  zIndex?: number;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  title,
  onClose,
  children,
  size = 'md',
  zIndex,
  closeOnOverlayClick,
  closeOnEscape,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      size={size}
      zIndex={zIndex}
      closeOnOverlayClick={closeOnOverlayClick}
      closeOnEscape={closeOnEscape}
    >
      {children}
    </Modal>
  );
};
