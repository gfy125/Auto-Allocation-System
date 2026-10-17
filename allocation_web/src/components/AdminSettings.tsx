import React from 'react';
import Sidebar from './Sidebar';
import { resetAllocationResults, getCurrentWeights, getBaseConfig, saveBaseConfig } from '../api/allocationApi';

interface AdminSettingsProps {
  userRole: 'admin';
  onLogout: () => void;
  username: string;
}

interface BaseConfig {
  databaseUri: string;
  frontendPort: number;
  backendPort: number;
  rateLimitMax?: number;
  skillWeight: number;
  scoreWeight: number;
  descriptionWeight: number;
  debug: boolean;
  sqlalchemyEcho: boolean;
}

type ConfigSettings = BaseConfig;

const AdminSettings: React.FC<AdminSettingsProps> = ({ userRole, onLogout, username }) => {
  const [sidebarCompact, setSidebarCompact] = React.useState(true);
  const [sidebarShowLabels, setSidebarShowLabels] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);
  const [resetMessage, setResetMessage] = React.useState<string | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = React.useState(false);
  const [config, setConfig] = React.useState<ConfigSettings>({
    databaseUri: 'sqlite:///allocation.db',
    rateLimitMax: 100,
    skillWeight: 0.4,
    scoreWeight: 0.4,
    descriptionWeight: 0.2,
    debug: true,
    sqlalchemyEcho: true,
    frontendPort: 5175,
    backendPort: 3002
  });

  React.useEffect(() => {
    const handleSidebarStateChange = () => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        const isCompact = sidebar.classList.contains('compact');
        const showLabels = sidebar.classList.contains('show-labels');
        setSidebarCompact(isCompact);
        setSidebarShowLabels(showLabels);
      }
    };

    const observer = new MutationObserver(handleSidebarStateChange);
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebar) {
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    return () => observer.disconnect();
  }, []);

  // Load config.yml and weights on mount (hot)
  React.useEffect(() => {
    (async () => {
      try {
        const cfg = await getBaseConfig();
        if (cfg.success && cfg.config) {
          setConfig(prev => ({ ...prev, ...cfg.config }));
        }
        const weights = await getCurrentWeights();
        if (weights.success && weights.currentWeights) {
          setConfig(prev => ({
            ...prev,
            skillWeight: weights.currentWeights.skillWeight,
            scoreWeight: weights.currentWeights.scoreWeight,
            descriptionWeight: weights.currentWeights.descriptionWeight
          }));
        }
      } catch (e) {
        console.warn('Failed to load config/weights:', (e as any)?.message);
      }
    })();
  }, []);

  const handleConfigChange = (key: keyof ConfigSettings, value: string | number | boolean) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    try {
      const result = await saveBaseConfig(config);
      let msg = 'Configuration saved successfully!';
      if (result.frontendPortChanged) msg += '\nNote: Frontend port changed. Please restart frontend to take effect.';
      if (result.backendPortChanged) msg += '\nNote: Backend port changed. Please restart backend to take effect.';
      try {
        if (result.backendPortChanged && typeof window !== 'undefined') {
          const newBaseUrl = `http://localhost:${config.backendPort}`;
          window.localStorage.setItem('backendBaseUrl', newBaseUrl);
        }
      } catch (_) {}
      alert(msg);
    } catch (e: any) {
      alert(`Failed to save configuration: ${e?.message || e}`);
    }
  };

  const handleReset = () => {
    // Reset to default values
    setConfig({
      databaseUri: 'sqlite:///allocation.db',
      rateLimitMax: 100,
      skillWeight: 0.4,
      scoreWeight: 0.4,
      descriptionWeight: 0.2,
      debug: true,
      sqlalchemyEcho: true,
      frontendPort: 5175,
      backendPort: 3002
    });
  };

  const handleResetAllocationResults = () => {
    // Show custom confirmation popup
    setShowResetConfirmModal(true);
  };

  const confirmResetAllocationResults = async () => {
    setShowResetConfirmModal(false);
    
    try {
      setIsResetting(true);
      setResetMessage(null);
      
      const result = await resetAllocationResults();
      
      if (result.success) {
        setResetMessage(`Successfully reset ${result.resetCount || 0} automatic allocation results.`);
      } else {
        setResetMessage(`Failed to reset allocation results: ${result.message}`);
      }
    } catch (error: any) {
      console.error('Error resetting allocation results:', error);
      setResetMessage(`Error: ${error.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const cancelResetAllocationResults = () => {
    setShowResetConfirmModal(false);
  };

  return (
    <div className="app">
      <Sidebar onLogout={onLogout} userRole={userRole} username={username} />
      <div className={`content-area ${sidebarCompact ? 'sidebar-compact' : ''} ${sidebarCompact && sidebarShowLabels ? 'show-labels' : ''}`}>
        <div className="content-header">
          <div className="header-left">
            <h1>System Settings</h1>
          </div>
          <div className="header-right">
            <button 
              onClick={handleReset}
              className="btn btn-secondary"
              style={{ marginRight: '10px' }}
            >
              Reset to Default
            </button>
            <button 
              onClick={handleSave}
              className="btn btn-primary"
            >
              Save Configuration
            </button>
          </div>
        </div>
        <div className="content-body">
          <div className="settings-container">
            {/* Base Configuration Section */}
            <div className="settings-section">
              <h2>Base Configuration</h2>
              <div className="settings-grid">
                <div className="setting-item">
                  <label>Database URI:</label>
                  <input
                    type="text"
                    value={config.databaseUri}
                    onChange={(e) => handleConfigChange('databaseUri', e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="setting-item">
                  <label>Rate Limit Max (per 5 min):</label>
                  <input
                    type="number"
                    min={1}
                    value={config.rateLimitMax ?? 100}
                    onChange={(e) => handleConfigChange('rateLimitMax', parseInt(e.target.value))}
                    className="form-input"
                  />
                </div>
                <div className="setting-item">
                  <label>Frontend Port:</label>
                  <input
                    type="number"
                    value={config.frontendPort}
                    onChange={(e) => handleConfigChange('frontendPort', parseInt(e.target.value))}
                    className="form-input"
                  />
                </div>
                <div className="setting-item">
                  <label>Backend Port:</label>
                  <input
                    type="number"
                    value={config.backendPort}
                    onChange={(e) => handleConfigChange('backendPort', parseInt(e.target.value))}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* Allocation Engine Settings Section */}
            <div className="settings-section">
              <h2>Allocation Engine Settings</h2>
              <div className="settings-grid">
                <div className="setting-item">
                  <label>Skill Weight:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.skillWeight}
                    onChange={(e) => handleConfigChange('skillWeight', parseFloat(e.target.value))}
                    className="form-input"
                  />
                </div>
                <div className="setting-item">
                  <label>Score Weight:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.scoreWeight}
                    onChange={(e) => handleConfigChange('scoreWeight', parseFloat(e.target.value))}
                    className="form-input"
                  />
                </div>
                <div className="setting-item">
                  <label>Description Weight:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.descriptionWeight}
                    onChange={(e) => handleConfigChange('descriptionWeight', parseFloat(e.target.value))}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* Development Settings Section */}
            <div className="settings-section">
              <h2>Development Settings</h2>
              <div className="settings-grid">
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.debug}
                      onChange={(e) => handleConfigChange('debug', e.target.checked)}
                      className="form-checkbox"
                    />
                    Debug Mode
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.sqlalchemyEcho}
                      onChange={(e) => handleConfigChange('sqlalchemyEcho', e.target.checked)}
                      className="form-checkbox"
                    />
                    SQLAlchemy Echo
                  </label>
                </div>
              </div>
            </div>

            {/* Allocation Management Section */}
            <div className="settings-section">
              <h2>Allocation Management</h2>
              <div className="settings-grid">
                <div className="setting-item">
                  <label>Reset Allocation Results:</label>
                  <div className="reset-section">
                    <button
                      onClick={handleResetAllocationResults}
                      disabled={isResetting}
                      className="btn btn-warning"
                    >
                      {isResetting ? 'Resetting...' : 'Reset Allocation Results'}
                    </button>
                    <p className="reset-description">
                      This will only delete automatic allocation results. Manual allocation results will not be affected.
                    </p>
                    {resetMessage && (
                      <div className={`reset-message ${resetMessage.includes('Successfully') ? 'success' : 'error'}`}>
                        {resetMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reset Confirmation Modal */}
        {showResetConfirmModal && (
          <div className="modal-overlay" onClick={cancelResetAllocationResults}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>⚠️ Confirm Reset Allocation Results</h3>
              </div>
              <div className="modal-body">
                <div className="warning-message">
                  <div className="warning-icon">⚠️</div>
                  <div className="warning-content">
                    <p><strong>This will only delete automatic allocation results.</strong></p>
                    <p>Manual allocation results will not be affected.</p>
                    <p>Are you sure you want to continue?</p>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={cancelResetAllocationResults}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-warning" 
                  onClick={confirmResetAllocationResults}
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        .settings-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .settings-section {
          margin-bottom: 40px;
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }
        
        .settings-section h2 {
          margin: 0 0 20px 0;
          color: #495057;
          font-size: 1.5rem;
          border-bottom: 2px solid #007bff;
          padding-bottom: 10px;
        }
        
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }
        
        .setting-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .setting-item label {
          font-weight: 600;
          color: #495057;
          font-size: 0.9rem;
        }
        
        .form-input {
          padding: 10px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }
        
        .form-input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }
        
        .form-checkbox {
          margin-right: 8px;
          transform: scale(1.2);
        }
        
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.15s ease-in-out;
        }
        
        .btn-primary {
          background-color: #007bff;
          color: white;
        }
        
        .btn-primary:hover {
          background-color: #0056b3;
        }
        
        .btn-secondary {
          background-color: #6c757d;
          color: white;
        }
        
        .btn-secondary:hover {
          background-color: #545b62;
        }
        
        .btn-warning {
          background-color: #ffc107;
          color: #212529;
        }
        
        .btn-warning:hover {
          background-color: #e0a800;
        }
        
        .btn-warning:disabled {
          background-color: #6c757d;
          color: white;
          cursor: not-allowed;
        }
        
        .reset-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .reset-description {
          margin: 0;
          font-size: 0.9rem;
          color: #6c757d;
          font-style: italic;
        }
        
        .reset-message {
          padding: 10px 15px;
          border-radius: 4px;
          font-size: 0.9rem;
          font-weight: 500;
        }
        
        .reset-message.success {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        
        .reset-message.error {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        
        .header-right {
          display: flex;
          gap: 10px;
        }
        
        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal-content {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .modal-header {
          padding: 20px 24px 16px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .modal-header h3 {
          margin: 0;
          color: #495057;
          font-size: 1.25rem;
        }
        
        .modal-body {
          padding: 20px 24px;
        }
        
        .modal-actions {
          padding: 16px 24px 20px;
          border-top: 1px solid #e9ecef;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        
        .warning-message {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }
        
        .warning-icon {
          font-size: 2rem;
          color: #ffc107;
          flex-shrink: 0;
        }
        
        .warning-content {
          flex: 1;
        }
        
        .warning-content p {
          margin: 0 0 12px 0;
          color: #495057;
          line-height: 1.5;
        }
        
        .warning-content p:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
};

export default AdminSettings;
