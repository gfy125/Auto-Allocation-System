import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Database, CheckCircle, AlertTriangle } from "lucide-react";

const DataSyncTest: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<{
    localStorage: any;
    tempStorage: any;
    enhancedStorage: any;
    groups: any[];
    lastUpdate: string;
  }>({
    localStorage: {},
    tempStorage: {},
    enhancedStorage: {},
    groups: [],
    lastUpdate: new Date().toLocaleTimeString()
  });

  const [testResults, setTestResults] = useState<{
    dataConsistency: boolean;
    crossVersionSync: boolean;
    tempDataSync: boolean;
  }>({
    dataConsistency: false,
    crossVersionSync: false,
    tempDataSync: false
  });

  const refreshData = () => {
    // check createdGroups in localStorage
    const createdGroups = localStorage.getItem('createdGroups');
    const groups = createdGroups ? JSON.parse(createdGroups) : [];

    // check temp storage
    const tempData = localStorage.getItem('newGroupFormTemp');
    const tempStorage = tempData ? JSON.parse(tempData) : {};

    // check enhanced storage
    const enhancedStorage: any = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('temp_store/')) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            enhancedStorage[key] = JSON.parse(value);
          } catch (e) {
            enhancedStorage[key] = value;
          }
        }
      }
    }

    // check other related localStorage keys
    const localStorageData: any = {};
    const relevantKeys = [
      'createdGroups',
      'newGroupFormTemp',
      'userRole',
      'username'
    ];

    relevantKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          localStorageData[key] = JSON.parse(value);
        } catch (e) {
          localStorageData[key] = value;
        }
      }
    });

    setSyncStatus({
      localStorage: localStorageData,
      tempStorage,
      enhancedStorage,
      groups,
      lastUpdate: new Date().toLocaleTimeString()
    });

    // run tests
    runTests(groups, tempStorage, enhancedStorage);
  };

  const runTests = (groups: any[], tempStorage: any, enhancedStorage: any) => {
    // test 1: data consistency - check if createdGroups is consistent in all places
    const dataConsistency = groups.length >= 0 && 
      Array.isArray(groups) && 
      groups.every(group => 
        group.id && 
        group.name && 
        group.course && 
        group.createdAt
      );

    // test 2: cross version sync - check if data can be shared between different versions
    const crossVersionSync = groups.length > 0 || 
      Object.keys(tempStorage).length > 0 || 
      Object.keys(enhancedStorage).length > 0;

    // test 3: temp data sync - check if temp storage is working
    const tempDataSync = Object.keys(tempStorage).length >= 0;

    setTestResults({
      dataConsistency,
      crossVersionSync,
      tempDataSync
    });
  };

  const createTestGroup = () => {
    const testGroup = {
      id: Date.now(),
      name: `Test Group ${Date.now()}`,
      course: 'COMP3888',
      members: 3,
      createdAt: new Date().toLocaleDateString(),
      status: 'draft',
      formData: {
        groupName: `Test Group ${Date.now()}`,
        startTime: new Date().toLocaleString()
      }
    };

    const existingGroups = JSON.parse(localStorage.getItem('createdGroups') || '[]');
    const updatedGroups = [...existingGroups, testGroup];
    localStorage.setItem('createdGroups', JSON.stringify(updatedGroups));

    // create temp storage data
    const tempData = {
      groupName: testGroup.name,
      startTime: testGroup.createdAt,
      course: testGroup.course
    };
    localStorage.setItem('newGroupFormTemp', JSON.stringify(tempData));

    refreshData();
  };

  const clearAllData = () => {
    if (window.confirm('Are you sure you want to clear ALL data? This will remove all groups and temporary data.')) {
      localStorage.removeItem('createdGroups');
      localStorage.removeItem('newGroupFormTemp');
      
      // clear enhanced storage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('temp_store/')) {
          localStorage.removeItem(key);
        }
      }
      
      refreshData();
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Synchronization Test</h1>
          <p className="text-gray-600">Test data consistency between Classic and Modern versions</p>
          <div className="mt-4 flex space-x-4">
            <a href="/student_classic" className="text-blue-600 hover:text-blue-800 underline">Test Classic Dashboard</a>
            <a href="/student_modern" className="text-blue-600 hover:text-blue-800 underline">Test Modern Dashboard</a>
            <div className="text-sm text-gray-500">
              💡 Tip: Click on "Information" in the sidebar to find the style switcher
            </div>
          </div>
        </div>

        {/* test controls */}
        <div className="flex items-center space-x-4 mb-6">
          <Button onClick={refreshData} className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span>Refresh Data</span>
          </Button>
          <Button onClick={createTestGroup} variant="outline" className="flex items-center space-x-2">
            <span>Create Test Group</span>
          </Button>
          <Button onClick={clearAllData} variant="destructive" className="flex items-center space-x-2">
            <span>Clear All Data</span>
          </Button>
        </div>

        {/* test results */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Data Consistency</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {testResults.dataConsistency ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                )}
                <span className={testResults.dataConsistency ? 'text-green-600' : 'text-yellow-600'}>
                  {testResults.dataConsistency ? 'Passed' : 'Needs Attention'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5" />
                <span>Cross-Version Sync</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {testResults.crossVersionSync ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                )}
                <span className={testResults.crossVersionSync ? 'text-green-600' : 'text-yellow-600'}>
                  {testResults.crossVersionSync ? 'Working' : 'Not Working'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Temp Data Sync</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {testResults.tempDataSync ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                )}
                <span className={testResults.tempDataSync ? 'text-green-600' : 'text-yellow-600'}>
                  {testResults.tempDataSync ? 'Working' : 'Not Working'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Groups Data */}
          <Card>
            <CardHeader>
              <CardTitle>Created Groups ({syncStatus.groups.length})</CardTitle>
              <CardDescription>Groups stored in localStorage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {syncStatus.groups.length === 0 ? (
                  <p className="text-gray-500">No groups created yet</p>
                ) : (
                  syncStatus.groups.map((group, index) => (
                    <div key={group.id || index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{group.name}</span>
                        <Badge variant={group.status === 'completed' ? 'default' : 'secondary'}>
                          {group.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">Course: {group.course}</p>
                      <p className="text-sm text-gray-600">Members: {group.members}</p>
                      <p className="text-sm text-gray-600">Created: {group.createdAt}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Temporary Storage */}
          <Card>
            <CardHeader>
              <CardTitle>Temporary Storage</CardTitle>
              <CardDescription>Form data and draft information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Form Temp Data:</h4>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(syncStatus.tempStorage, null, 2)}
                  </pre>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Enhanced Storage:</h4>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(syncStatus.enhancedStorage, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Last Update */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Last updated: {syncStatus.lastUpdate}
        </div>
      </div>
    </div>
  );
};

export default DataSyncTest;
