import type { ReactNode } from 'react'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
}

export const Modal = ({ title, onClose, children }: ModalProps) => {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <header>
          <h3>{title}</h3>
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
