import React, { useState } from 'react';
import './DeleteConfirmModal.css';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  projectName: string;
  projectId: string;
  isDeleting?: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  projectId,
  isDeleting = false
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [error, setError] = useState('');

  const expectedText = `I confirm to delete ${projectName}`;
  const isConfirmationValid = confirmationText.trim() === expectedText;

  const handleConfirm = () => {
    if (!isConfirmationValid) {
      setError('Please enter the exact confirmation text');
      return;
    }
    setError('');
    onConfirm();
  };

  const handleClose = () => {
    setConfirmationText('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content delete-confirm-modal">
        <div className="modal-header">
          <h3>🗑️ Delete confirmation</h3>
        </div>
        <div className="modal-body">
          <p className="warning-text">
            ⚠️ <strong>Warning:</strong> This action cannot be undone!
          </p>
          <div className="project-info">
            <p><strong>ID:</strong> {projectId}</p>
            <p><strong>Name:</strong> {projectName}</p>
          </div>
          <div className="confirmation-section">
            <p className="confirmation-instruction">
              To confirm deletion, please type the following text exactly:
            </p>
            <div className="confirmation-text-box">
              <code>{expectedText}</code>
              <button 
                className="copy-button" 
                onClick={() => {
                  navigator.clipboard.writeText(expectedText);
                  setConfirmationText(expectedText);
                }}
                title="Copy to clipboard"
              >
                📋 Copy
              </button>
            </div>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => {
                setConfirmationText(e.target.value);
                setError('');
              }}
              placeholder="Type the confirmation text here..."
              className={`confirmation-input ${error ? 'error' : ''}`}
              disabled={isDeleting}
            />
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
        <div className="modal-actions">
          <button 
            className="btn btn-secondary" 
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button 
            className="btn btn-danger" 
            onClick={handleConfirm}
            disabled={!isConfirmationValid || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete confirmation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
