import React, { useState, useEffect } from 'react';
import { tempStorage } from '../utils/tempStorage';

const LocalStorageTest: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLocalStorageAvailable, setIsLocalStorageAvailable] = useState<boolean | null>(null);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testLocalStorage = () => {
    setTestResults([]);
    
    try {
      // test basic localStorage functionality
      const testKey = 'test_localStorage_functionality';
      localStorage.setItem(testKey, 'test_value');
      const retrievedValue = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (retrievedValue === 'test_value') {
        setIsLocalStorageAvailable(true);
        addResult('✅ localStorage basic functionality works');
      } else {
        setIsLocalStorageAvailable(false);
        addResult('❌ localStorage basic functionality failed');
      }
    } catch (error) {
      setIsLocalStorageAvailable(false);
      addResult(`❌ localStorage error: ${error}`);
    }
  };

  const testTempStorage = () => {
    try {
      // test tempStorage tool
      const testData = { 
        groupName: 'test_group', 
        student1: 'test_student',
        startTime: new Date().toLocaleString()
      };
      
      // test save
      tempStorage.save(testData);
      addResult('✅ tempStorage.save() executed');
      
      // test load
      const loadedData = tempStorage.load();
      addResult(`📋 tempStorage.load() result: ${JSON.stringify(loadedData)}`);
      
      // test clear
      tempStorage.clear();
      addResult('🧹 tempStorage.clear() executed');
      
    } catch (error) {
      addResult(`❌ tempStorage error: ${error}`);
    }
  };

  const testBrowserSettings = () => {
    // check browser settings
    addResult(`🌐 User Agent: ${navigator.userAgent}`);
    addResult(`🔒 Cookie Enabled: ${navigator.cookieEnabled}`);
    addResult(`📱 Platform: ${navigator.platform}`);
    
    // check if in private/incognito mode
    try {
      const testKey = 'privacy_test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      addResult('✅ Not in private/incognito mode');
    } catch (error) {
      addResult('❌ Possibly in private/incognito mode');
    }
  };

  const clearAllData = () => {
    try {
      localStorage.clear();
      addResult('🧹 All localStorage data cleared');
    } catch (error) {
      addResult(`❌ Failed to clear localStorage: ${error}`);
    }
  };

  useEffect(() => {
    testLocalStorage();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>LocalStorage functionality test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Test results:</h3>
        <div style={{ 
          background: '#f5f5f5', 
          padding: '10px', 
          borderRadius: '5px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {testResults.map((result, index) => (
            <div key={index} style={{ marginBottom: '5px', fontFamily: 'monospace' }}>
              {result}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={testLocalStorage} style={buttonStyle}>
          🔄 re-test localStorage
        </button>
        <button onClick={testTempStorage} style={buttonStyle}>
          🧪 test tempStorage tool
        </button>
        <button onClick={testBrowserSettings} style={buttonStyle}>
          🌐 check browser settings
        </button>
        <button onClick={clearAllData} style={buttonStyle}>
          🗑️ clear all data
        </button>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', background: '#e8f4fd', borderRadius: '5px' }}>
        <h3>LocalStorage 状态:</h3>
        <p>
          {isLocalStorageAvailable === null && '🔄 detecting...'}
          {isLocalStorageAvailable === true && '✅ available - localStorage works normally'}
          {isLocalStorageAvailable === false && '❌ unavailable - localStorage is disabled or has issues'}
        </p>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', background: '#fff3cd', borderRadius: '5px' }}>
        <h3>If localStorage is unavailable, possible reasons:</h3>
        <ul>
          <li>Browser is in private/incognito mode</li>
          <li>Browser settings have disabled localStorage</li>
          <li>Enterprise policies or security software have blocked localStorage</li>
          <li>Browser version is too old and does not support localStorage</li>
        </ul>
      </div>
    </div>
  );
};

const buttonStyle = {
  padding: '10px 15px',
  border: 'none',
  borderRadius: '5px',
  backgroundColor: '#007bff',
  color: 'white',
  cursor: 'pointer',
  fontSize: '14px'
};

export default LocalStorageTest;
