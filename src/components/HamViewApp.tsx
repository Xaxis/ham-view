import React from 'react';
import { AppProvider } from '../context/AppContext';
import { Dashboard } from './Dashboard';

const HamViewApp: React.FC = () => {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
};

export default HamViewApp;
