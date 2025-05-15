/**
 * Health Tracker App - Core Functionality and Data Management
 * This file contains the core functionality, constants, utility functions, and data management
 */

// Storage Manager for quota handling
const storageManager = {
  // Test if localStorage is available
  isAvailable: function() {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  },
  
  // Estimate current usage
  getUsage: function() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      total += key.length + value.length;
    }
    return total;
  },
  
  // Estimate remaining space (approximate)
  getRemainingSpace: function() {
    const maxSize = 5 * 1024 * 1024; // Assume 5MB limit
    return maxSize - this.getUsage();
  },
  
  // Check if we're near the quota
  isNearQuota: function() {
    const maxSize = 5 * 1024 * 1024; // Assume 5MB limit
    const currentUsage = this.getUsage();
    return currentUsage > maxSize * 0.9; // 90% full
  },
  
  // Clean up old history data to free space
  cleanupOldData: function() {
    try {
      // Start with old history entries
      const historyKeys = [
        STORAGE_KEYS.HISTORY_PREFIX + 'water',
        STORAGE_KEYS.HISTORY_PREFIX + 'protein',
        'workout_history',
        'habits_data'
      ];
      
      let cleanedUp = false;
      
      // Process each history object
      historyKeys.forEach(key => {
        try {
          const historyData = localStorage.getItem(key);
          if (!historyData) return;
          
          const history = JSON.parse(historyData);
          
          // Ensure we have the right data structure
          if (typeof history !== 'object') return;
          
          // For habits data, handle the special format
          if (key === 'habits_data') {
            const habits = history;
            if (Array.isArray(habits)) {
              habits.forEach(habit => {
                if (habit.history) {
                  // Keep only last 90 days of history for each habit
                  const dates = Object.keys(habit.history).sort();
                  if (dates.length > 90) {
                    const datesToRemove = dates.slice(0, dates.length - 90);
                    datesToRemove.forEach(date => {
                      delete habit.history[date];
                    });
                    cleanedUp = true;
                  }
                }
              });
              
              // Save back
              localStorage.setItem(key, JSON.stringify(habits));
            }
          } else {
            // Standard history object with dates as keys
            const dates = Object.keys(history).sort();
            
            // If we have more than 90 days of history, remove oldest
            if (dates.length > 90) {
              const datesToRemove = dates.slice(0, dates.length - 90);
              datesToRemove.forEach(date => {
                delete history[date];
              });
              
              // Save back
              localStorage.setItem(key, JSON.stringify(history));
              cleanedUp = true;
            }
          }
        } catch (e) {
          console.error(`Error cleaning up ${key}:`, e);
        }
      });
      
      return cleanedUp;
    } catch (e) {
      console.error('Error in cleanup:', e);
      return false;
    }
  },
  
  // Safe set item with quota checking
  safeSetItem: function(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      // If storage error, try to clean up
      if (e.name === 'QuotaExceededError' || 
          e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          e.code === 22) {
        
        // Try cleanup
        const cleaned = this.cleanupOldData();
        
        if (cleaned) {
          // Try again after cleanup
          try {
            localStorage.setItem(key, value);
            utils.showToast('Older history has been archived to free up storage space.', 'info');
            return true;
          } catch (e2) {
            utils.showToast('Storage limit reached. Please export and clear some data.', 'error');
            return false;
          }
        } else {
          utils.showToast('Storage limit reached. Please export and clear some data.', 'error');
          return false;
        }
      }
      
      // Other error
      utils.showToast('Error saving data: ' + e.message, 'error');
      return false;
    }
  }
};

// Constants
const STORAGE_KEYS = {
  THEME: 'app_theme',
  LAST_RESET_PREFIX: 'lastResetDate_',
  GOAL_PREFIX: 'goal_',
  INTAKE_PREFIX: 'intake_',
  HISTORY_PREFIX: 'history_',
  REMINDER: 'global_reminder'
};

// Theme colors for different sections
const THEME_COLORS = {
  water: '#2196F3',
  protein: '#F44336',
  workout: '#673AB7',
  habits: '#4CAF50'  
};

// Global reminder interval defined in notification.js

// Utility Functions
const utils = {
  /**
   * Format date as YYYY-MM-DD (ISO format for better consistency)
   * @param {Date} date - Date to format
   * @returns {string} Formatted date
   */
  formatDate(date) {
    // Ensure we're working with a Date object
    const d = new Date(date);
    
    // Check for invalid date
    if (isNaN(d.getTime())) {
      console.error('Invalid date provided to formatDate:', date);
      // Return current date as fallback
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    
    // Use explicit UTC methods for consistency
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  },
  
  // Add date comparison function to handle different formats
  isSameDay(date1, date2) {
    // Convert to Date objects if they aren't already
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    // Check for invalid dates
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      return false;
    }
    
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  },

  // Add date parsing function for handling different formats
  parseDate(dateString) {
    // Try different formats
    let date;
    
    // Try ISO format
    date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Try YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Try MM/DD/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
      const [month, day, year] = dateString.split('/').map(Number);
      date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Return current date as fallback
    console.error('Unable to parse date:', dateString);
    return new Date();
  },

  // Add date formatter with localization
  formatDateForDisplay(date, options = {}) {
    const defaults = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    
    const opts = {...defaults, ...options};
    
    try {
      return new Date(date).toLocaleDateString(undefined, opts);
    } catch (e) {
      // Fallback for browsers with limited toLocaleDateString support
      const d = new Date(date);
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    }
  },
  
  /**
   * Create and show a toast notification with improved stability
   * @param {string} message - Message to display
   * @param {string} type - Type of toast (success, warning, error)
   * @param {number} duration - Duration in milliseconds (default 3000ms)
   */
  showToast(message, type = 'success', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = document.createElement('i');
    icon.className = 'material-icons-round';
    
    switch (type) {
      case 'success':
        icon.textContent = 'check_circle';
        break;
      case 'warning':
        icon.textContent = 'warning';
        break;
      case 'error':
        icon.textContent = 'error';
        break;
    }
    
    toast.appendChild(icon);
    toast.appendChild(document.createTextNode(message));
    toastContainer.appendChild(toast);
    
    // Remove toast after specified duration
    setTimeout(() => {
      toast.classList.add('toast-closing');
      setTimeout(() => {
        if (toast.parentNode) {
          toastContainer.removeChild(toast);
        }
      }, 300); // Wait for fadeOut animation to complete
    }, duration);
    
    // Limit max number of toasts to 3 to prevent stacking
    const toasts = toastContainer.querySelectorAll('.toast');
    if (toasts.length > 3) {
      toastContainer.removeChild(toasts[0]);
    }
  },
  
  /**
   * Change the theme color in the meta tag
   * @param {string} color - Color in hex format
   */
  changeThemeColor(color) {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    // Create meta tag if it doesn't exist
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    
    // Set the color
    metaThemeColor.setAttribute('content', color);
  }
};

/**
 * Initialize the application when DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Check if localStorage is available
  if (!storageManager.isAvailable()) {
    alert('Your browser does not support local storage or it is disabled. The app may not work properly.');
    return;
  }
  
  // Check if we're near quota
  if (storageManager.isNearQuota()) {
    utils.showToast('Storage space is running low. Consider exporting and clearing old data.', 'warning');
    
    // Try to clean up automatically
    storageManager.cleanupOldData();
  }

  // Initialize trackers
  window.waterTracker = new Tracker({ type: 'water', unit: 'ml' });
  window.proteinTracker = new Tracker({ type: 'protein', unit: 'g' });
  window.workoutTracker = new WorkoutTracker();
  window.habitsTracker = new HabitsTracker(); // Initialize habits tracker
  
  // Set up theme
  initializeTheme();
  
  // Set up tab navigation
  initializeTabNavigation();
  
  // Set up panels (settings, history, more options)
  initializePanels();
  
  // Set up action buttons for water tracker
  initializeTrackerActions(waterTracker);
  
  // Set up action buttons for protein tracker
  initializeTrackerActions(proteinTracker);
  
  // Set up action buttons for workout tracker
  initializeWorkoutTrackerActions(workoutTracker);
  
  // Set up global notifications
  initializeGlobalNotifications();
  
  // Set up data import/export
  initializeDataManagement();
  
  // Apply initial theme color based on current theme
  const isDarkTheme = document.body.classList.contains('dark-theme') || 
                      (!document.body.classList.contains('light-theme') && 
                       window.matchMedia('(prefers-color-scheme: dark)').matches);
  utils.changeThemeColor(isDarkTheme ? '#121212' : THEME_COLORS.water);
});

/**
 * Initialize data import/export functionality
 */
function initializeDataManagement() {
  // Export data button
  const exportBtn = document.getElementById('export-data');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
  }
  
  // Import data file input
  const importFileInput = document.getElementById('import-file');
  if (importFileInput) {
    importFileInput.addEventListener('change', importData);
  }
}

/**
 * Export tracking data to CSV file with improved error handling
 */
function exportData() {
  try {
    // Collect and convert data to CSV
    const csvString = convertDataToCSV();
    
    // Create CSV blob
    const csvBlob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const csvUrl = URL.createObjectURL(csvBlob);
    
    // Create download link
    const link = document.createElement('a');
    link.setAttribute('href', csvUrl);
    link.setAttribute('download', `health-tracker-export-${new Date().toISOString().slice(0,10)}.csv`);
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(csvUrl); // Free memory
    }, 100);
    
    utils.showToast('Data exported successfully as CSV!', 'success');
    
    // Close the panel
    document.getElementById('more-options-panel').classList.remove('active');
  } catch (error) {
    console.error('Export error:', error);
    utils.showToast(`Error exporting data: ${error.message}`, 'error');
  }
}

/**
 * Import tracking data from CSV file with enhanced validation
 * @param {Event} event - Change event from file input
 */
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file size
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    utils.showToast('File is too large. Maximum size is 5MB.', 'error');
    event.target.value = '';
    return;
  }
  
  // Validate file type
  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    utils.showToast('Invalid file type. Please upload a CSV file.', 'error');
    event.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      // Parse CSV with detailed error handling
      let csvData;
      try {
        csvData = e.target.result;
      } catch (parseError) {
        throw new Error('File is not valid CSV. Please ensure the file is correctly formatted.');
      }
      
      // Convert CSV to app data format
      const importedData = parseCSVData(csvData);
      
      // Validate the data structure
      if (!importedData) {
        throw new Error('Import file is empty or corrupt.');
      }
      
      // Calculate estimated storage requirements
      const importSize = JSON.stringify(importedData).length;
      const availableSpace = 5 * 1024 * 1024; // Approximate localStorage limit (5MB)
      
      if (importSize > availableSpace * 0.9) { // If import would use more than 90% of storage
        throw new Error('Import file is too large for browser storage. Please try a smaller export file.');
      }
      
      // Confirm before importing
      if (confirm('This will replace your current tracking data. Are you sure you want to proceed?')) {
        // Start with a backup
        const backup = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          backup[key] = localStorage.getItem(key);
        }
        
        try {
          // Import water data
          if (importedData.water.goal) {
            localStorage.setItem(STORAGE_KEYS.GOAL_PREFIX + 'water', importedData.water.goal);
          }
          if (importedData.water.intake) {
            localStorage.setItem(STORAGE_KEYS.INTAKE_PREFIX + 'water', importedData.water.intake);
          }
          if (importedData.water.history) {
            localStorage.setItem(STORAGE_KEYS.HISTORY_PREFIX + 'water', importedData.water.history);
          }
          
          // Import protein data
          if (importedData.protein.goal) {
            localStorage.setItem(STORAGE_KEYS.GOAL_PREFIX + 'protein', importedData.protein.goal);
          }
          if (importedData.protein.intake) {
            localStorage.setItem(STORAGE_KEYS.INTAKE_PREFIX + 'protein', importedData.protein.intake);
          }
          if (importedData.protein.history) {
            localStorage.setItem(STORAGE_KEYS.HISTORY_PREFIX + 'protein', importedData.protein.history);
          }
          
          // Import workout data if available
          if (importedData.workout) {
            if (importedData.workout.state) {
              localStorage.setItem('workout_state', importedData.workout.state);
            }
            if (importedData.workout.count) {
              localStorage.setItem('workout_count', importedData.workout.count);
            }
            if (importedData.workout.history) {
              localStorage.setItem('workout_history', importedData.workout.history);
            }
          }
          
          // Import habits data if available
          if (importedData.habits && importedData.habits.data) {
            localStorage.setItem('habits_data', importedData.habits.data);
          }
          
          // Import settings
          if (importedData.settings && importedData.settings.theme) {
            localStorage.setItem(STORAGE_KEYS.THEME, importedData.settings.theme);
          }
          if (importedData.settings && importedData.settings.reminder) {
            localStorage.setItem(STORAGE_KEYS.REMINDER, importedData.settings.reminder);
          }
          
          utils.showToast('Data imported successfully from CSV! Reloading app...', 'success');
          
          // Reload the page to apply imported data
          setTimeout(() => location.reload(), 1500);
        } catch (storageError) {
          // Restore backup if import fails
          console.error('Storage error during import:', storageError);
          
          // Clear localStorage first
          localStorage.clear();
          
          // Restore backup
          Object.keys(backup).forEach(key => {
            localStorage.setItem(key, backup[key]);
          });
          
          throw new Error('Error saving imported data. Your previous data has been restored.');
        }
      }
    } catch (error) {
      utils.showToast(`Error importing data: ${error.message}`, 'error');
      console.error('Import error:', error);
    }
    
    // Reset the file input
    event.target.value = '';
  };
  
  reader.onerror = function() {
    utils.showToast('Error reading file. Please try again.', 'error');
    event.target.value = '';
  };
  
  reader.readAsText(file);
}

/**
 * Convert application data to CSV format
 * @returns {string} CSV data as string
 */
function convertDataToCSV() {
  // Initialize an array to hold all data rows
  const rows = []; 
  
  // Add CSV header row
  const headers = [
    "data_type", 
    "key", 
    "value", 
    "date", 
    "amount", 
    "timestamp", 
    "type", 
    "count", 
    "name", 
    "color", 
    "completed", 
    "order"
  ];
  rows.push(headers.join(","));
  
  // Helper function to escape CSV values
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // If value contains commas, quotes, or newlines, wrap in quotes and escape any quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };
  
  // Helper function to add a data row
  const addRow = (dataType, key, value) => {
    const row = new Array(headers.length).fill(''); // Initialize with empty strings
    row[0] = dataType;
    row[1] = key;
    row[2] = value;
    rows.push(row.map(escapeCSV).join(','));
  };
  
  // Add version info
  addRow("meta", "version", "2.0");
  addRow("meta", "exportDate", new Date().toISOString());
  
  // Process water data
  const waterGoal = localStorage.getItem(STORAGE_KEYS.GOAL_PREFIX + 'water');
  addRow("water", "goal", waterGoal);
  
  const waterIntake = localStorage.getItem(STORAGE_KEYS.INTAKE_PREFIX + 'water');
  addRow("water", "intake", waterIntake);
  
  const waterHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY_PREFIX + 'water') || '{}');
  Object.entries(waterHistory).forEach(([date, entries]) => {
    entries.forEach((entry, index) => {
      const row = new Array(headers.length).fill('');
      row[0] = "water_history";
      row[1] = `${date}_${index}`;
      row[3] = date;
      row[4] = entry.amount;
      row[5] = entry.timestamp;
      rows.push(row.map(escapeCSV).join(','));
    });
  });
  
  // Process protein data
  const proteinGoal = localStorage.getItem(STORAGE_KEYS.GOAL_PREFIX + 'protein');
  addRow("protein", "goal", proteinGoal);
  
  const proteinIntake = localStorage.getItem(STORAGE_KEYS.INTAKE_PREFIX + 'protein');
  addRow("protein", "intake", proteinIntake);
  
  const proteinHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY_PREFIX + 'protein') || '{}');
  Object.entries(proteinHistory).forEach(([date, entries]) => {
    entries.forEach((entry, index) => {
      const row = new Array(headers.length).fill('');
      row[0] = "protein_history";
      row[1] = `${date}_${index}`;
      row[3] = date;
      row[4] = entry.amount;
      row[5] = entry.timestamp;
      rows.push(row.map(escapeCSV).join(','));
    });
  });
  
  // Process workout data
  const workoutState = JSON.parse(localStorage.getItem('workout_state') || '{}');
  Object.entries(workoutState).forEach(([type, state]) => {
    const row = new Array(headers.length).fill('');
    row[0] = "workout_state";
    row[1] = type;
    row[6] = type;
    row[10] = state.completed;
    row[11] = state.order;
    rows.push(row.map(escapeCSV).join(','));
  });
  
  const workoutCount = JSON.parse(localStorage.getItem('workout_count') || '{}');
  Object.entries(workoutCount).forEach(([type, count]) => {
    const row = new Array(headers.length).fill('');
    row[0] = "workout_count";
    row[1] = type;
    row[6] = type;
    row[7] = count;
    rows.push(row.map(escapeCSV).join(','));
  });
  
  const workoutHistory = JSON.parse(localStorage.getItem('workout_history') || '{}');
  Object.entries(workoutHistory).forEach(([date, entries]) => {
    entries.forEach((entry, index) => {
      const row = new Array(headers.length).fill('');
      row[0] = "workout_history";
      row[1] = `${date}_${index}`;
      row[3] = date;
      row[5] = entry.timestamp;
      row[6] = entry.type;
      row[7] = entry.count;
      rows.push(row.map(escapeCSV).join(','));
    });
  });
  
  // Process habits data
  const habitsData = JSON.parse(localStorage.getItem('habits_data') || '[]');
  habitsData.forEach((habit, habitIndex) => {
    const row = new Array(headers.length).fill('');
    row[0] = "habit";
    row[1] = habitIndex.toString();
    row[8] = habit.name;
    row[9] = habit.color;
    rows.push(row.map(escapeCSV).join(','));
    
    // Process habit history
    if (habit.history) {
      Object.entries(habit.history).forEach(([date, status]) => {
        const historyRow = new Array(headers.length).fill('');
        historyRow[0] = "habit_history";
        historyRow[1] = `${habitIndex}_${date}`;
        historyRow[2] = status;
        historyRow[3] = date;
        rows.push(historyRow.map(escapeCSV).join(','));
      });
    }
  });
  
  // Add settings
  const theme = localStorage.getItem(STORAGE_KEYS.THEME);
  addRow("settings", "theme", theme);
  
  const reminder = localStorage.getItem(STORAGE_KEYS.REMINDER);
  addRow("settings", "reminder", reminder);
  
  return rows.join('\n');
}

/**
 * Parse CSV data and import to app
 * @param {string} csvData - CSV data as string
 * @returns {Object} - Parsed data structure
 */
function parseCSVData(csvData) {
  // Split the CSV into rows and process header
  const rows = csvData.split(/\r?\n/);
  if (rows.length < 2) throw new Error('Invalid CSV file format');
  
  const headers = parseCSVRow(rows[0]);
  const headerMap = {};
  headers.forEach((header, index) => {
    headerMap[header] = index;
  });
  
  // Initialize data structure
  const importedData = {
    version: "2.0",
    exportDate: new Date().toISOString(),
    water: {
      goal: null,
      intake: null,
      history: {}
    },
    protein: {
      goal: null,
      intake: null,
      history: {}
    },
    workout: {
      state: {},
      count: {},
      history: {}
    },
    habits: {
      data: []
    },
    settings: {
      theme: null,
      reminder: null
    }
  };
  
  // Process each data row
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i].trim()) continue; // Skip empty rows
    
    const row = parseCSVRow(rows[i]);
    const dataType = row[headerMap.data_type];
    const key = row[headerMap.key];
    const value = row[headerMap.value];
    
    switch (dataType) {
      case 'meta':
        if (key === 'version') importedData.version = value;
        if (key === 'exportDate') importedData.exportDate = value;
        break;
        
      case 'water':
        if (key === 'goal') importedData.water.goal = value;
        if (key === 'intake') importedData.water.intake = value;
        break;
        
      case 'water_history':
        const waterDate = row[headerMap.date];
        const waterAmount = parseInt(row[headerMap.amount]);
        const waterTimestamp = row[headerMap.timestamp];
        
        if (!importedData.water.history[waterDate]) {
          importedData.water.history[waterDate] = [];
        }
        
        importedData.water.history[waterDate].push({
          amount: waterAmount,
          timestamp: waterTimestamp
        });
        break;
        
      case 'protein':
        if (key === 'goal') importedData.protein.goal = value;
        if (key === 'intake') importedData.protein.intake = value;
        break;
        
      case 'protein_history':
        const proteinDate = row[headerMap.date];
        const proteinAmount = parseInt(row[headerMap.amount]);
        const proteinTimestamp = row[headerMap.timestamp];
        
        if (!importedData.protein.history[proteinDate]) {
          importedData.protein.history[proteinDate] = [];
        }
        
        importedData.protein.history[proteinDate].push({
          amount: proteinAmount,
          timestamp: proteinTimestamp
        });
        break;
        
      case 'workout_state':
        const workoutType = row[headerMap.type];
        const completed = row[headerMap.completed] === 'true';
        const order = parseInt(row[headerMap.order]);
        
        importedData.workout.state[workoutType] = {
          completed: completed,
          order: order
        };
        break;
        
      case 'workout_count':
        const countType = row[headerMap.type];
        const count = parseInt(row[headerMap.count]);
        
        importedData.workout.count[countType] = count;
        break;
        
      case 'workout_history':
        const workoutDate = row[headerMap.date];
        const entryType = row[headerMap.type];
        const entryCount = parseInt(row[headerMap.count]);
        const entryTimestamp = row[headerMap.timestamp];
        
        if (!importedData.workout.history[workoutDate]) {
          importedData.workout.history[workoutDate] = [];
        }
        
        importedData.workout.history[workoutDate].push({
          type: entryType,
          count: entryCount,
          timestamp: entryTimestamp
        });
        break;
        
      case 'habit':
        const habitIndex = parseInt(key);
        const habitName = row[headerMap.name];
        const habitColor = row[headerMap.color];
        
        while (importedData.habits.data.length <= habitIndex) {
          importedData.habits.data.push({ history: {} });
        }
        
        importedData.habits.data[habitIndex] = {
          name: habitName,
          color: habitColor,
          history: importedData.habits.data[habitIndex].history || {}
        };
        break;
        
      case 'habit_history':
        const [habitIdx, historyDate] = key.split('_');
        const status = value;
        
        const idx = parseInt(habitIdx);
        while (importedData.habits.data.length <= idx) {
          importedData.habits.data.push({ history: {} });
        }
        
        if (!importedData.habits.data[idx].history) {
          importedData.habits.data[idx].history = {};
        }
        
        importedData.habits.data[idx].history[historyDate] = status;
        break;
        
      case 'settings':
        if (key === 'theme') importedData.settings.theme = value;
        if (key === 'reminder') importedData.settings.reminder = value;
        break;
    }
  }
  
  // Convert the parsed data to the format expected by the importData function
  return {
    version: importedData.version,
    exportDate: importedData.exportDate,
    water: {
      goal: importedData.water.goal,
      intake: importedData.water.intake,
      history: JSON.stringify(importedData.water.history)
    },
    protein: {
      goal: importedData.protein.goal,
      intake: importedData.protein.intake,
      history: JSON.stringify(importedData.protein.history)
    },
    workout: {
      state: JSON.stringify(importedData.workout.state),
      count: JSON.stringify(importedData.workout.count),
      history: JSON.stringify(importedData.workout.history)
    },
    habits: {
      data: JSON.stringify(importedData.habits.data)
    },
    settings: importedData.settings
  };
}

/**
 * Parse a single CSV row, handling quoted values correctly
 * @param {string} row - CSV row
 * @returns {Array} - Array of values
 */
function parseCSVRow(row) {
  const result = [];
  let insideQuotes = false;
  let currentValue = '';
  let i = 0;
  
  // Process each character
  while (i < row.length) {
    const char = row[i];
    
    if (char === '"') {
      // Check if this is an escaped quote
      if (i + 1 < row.length && row[i + 1] === '"') {
        currentValue += '"';
        i += 2; // Skip both quotes
        continue;
      }
      
      // Toggle the insideQuotes flag
      insideQuotes = !insideQuotes;
      i++;
      continue;
    }
    
    if (char === ',' && !insideQuotes) {
      // End of field
      result.push(currentValue);
      currentValue = '';
      i++;
      continue;
    }
    
    // Regular character
    currentValue += char;
    i++;
  }
  
  // Don't forget the last field
  result.push(currentValue);
  
  return result;
}

/**
 * Register service worker for PWA support with improved error handling
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Add a timeout to prevent registration taking too long
    const swRegistrationTimeout = setTimeout(() => {
      console.warn('Service Worker registration is taking too long. App will continue without offline support.');
      utils.showToast('Offline mode may not be available. Please check your connection.', 'warning');
    }, 10000); // 10 second timeout
    
    navigator.serviceWorker.register('service-worker.js')
      .then(registration => {
        clearTimeout(swRegistrationTimeout);
        console.log('Service Worker registered with scope:', registration.scope);
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              utils.showToast('App update available. Please refresh the page.', 'info');
            }
          });
        });
      })
      .catch(error => {
        clearTimeout(swRegistrationTimeout);
        console.error('Service Worker registration failed:', error);
        
        // Provide specific error messages based on error type
        if (error.name === 'SecurityError') {
          utils.showToast('Service Worker blocked due to security settings.', 'error');
        } else if (error.name === 'TypeError') {
          utils.showToast('Service Worker URL is invalid. Please contact support.', 'error');
        } else {
          utils.showToast('App may not work offline. Please refresh the page.', 'warning');
        }
        
        // Attempt to recover by unregistering any failed service workers
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) {
            registration.unregister();
          }
        });
      });
  });
}