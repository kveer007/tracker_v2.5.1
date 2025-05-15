/**
 * Health Tracker App - Workout Tracker
 * This file contains the implementation of the workout tracker functionality
 */

/**
 * WorkoutTracker class for tracking workout exercises
 */
class WorkoutTracker {
    /**
     * Create a new workout tracker
     */
    constructor() {
        // Define storage keys
        this.stateKey = 'workout_state';
        this.historyKey = 'workout_history';
        this.countKey = 'workout_count';
        this.lastResetKey = `${STORAGE_KEYS.LAST_RESET_PREFIX}workout`;
        
        // Define workout types - Added "Shoulders" to the list
        this.workoutTypes = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Abs', 'Legs'];
        
        // Load data from localStorage
        this.workoutState = JSON.parse(localStorage.getItem(this.stateKey)) || 
          this.workoutTypes.reduce((acc, type) => {
            acc[type] = { completed: false, order: this.workoutTypes.indexOf(type) };
            return acc;
          }, {});
        
        this.workoutCounts = JSON.parse(localStorage.getItem(this.countKey)) || 
          this.workoutTypes.reduce((acc, type) => {
            acc[type] = 0;
            return acc;
          }, {});
      
        this.workoutHistory = JSON.parse(localStorage.getItem(this.historyKey)) || {};
        
        // Set DOM elements
        this.elements = {
            tabsContainer: document.getElementById('workout-tabs-container'),
            historyPanel: document.getElementById('workout-history-popup'),
            dailyHistoryTab: document.getElementById('workout-daily-history'),
            currentWorkoutsTab: document.getElementById('workout-current-exercises'),
            // New Analytics elements
            analyticsTab: document.getElementById('workout-analytics'),
            workoutChart: document.getElementById('workout-chart'),
            chartLabels: document.getElementById('workout-chart-labels'),
            workoutStreaks: document.getElementById('workout-streaks'),
            viewTypeSelect: document.getElementById('workout-view-type'),
            timePeriodSelect: document.getElementById('workout-time-period')
        };
        
        // Default analytics settings
        this.selectedWorkoutView = 'all';
        this.selectedTimePeriod = 'weekly';
        
        // Initialize tracker
        this.initializeTracker();
    }
    
    /**
     * Initialize tracker
     */
    initializeTracker() {
        // Check for daily reset
        this.checkAndResetDailyWorkouts();
        
        // Set up auto-reset at midnight
        this.setupMidnightReset();
        
        // Render workout tabs
        this.renderWorkoutTabs();
        
        // Update display
        this.updateDisplay();
        
        // Initialize workout analytics
        this.initializeWorkoutAnalytics();
    }
    
    /**
     * Render workout tabs in the container
     */
    renderWorkoutTabs() {
        if (!this.elements.tabsContainer) return;
        
        this.elements.tabsContainer.innerHTML = '';
        
        // Sort workout types by completed status and then by order
        const sortedWorkouts = Object.entries(this.workoutState)
        .sort(([, a], [, b]) => {
            // Completed workouts go to the bottom
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            // Otherwise, maintain original order
            return a.order - b.order;
        })
        .map(([type]) => type);
        
        // Create tabs for each workout type
        sortedWorkouts.forEach(type => {
            const tab = document.createElement('button');
            tab.className = `workout-tab ${this.workoutState[type].completed ? 'completed' : ''}`;
            tab.dataset.type = type;
            
            const icon = document.createElement('i');
            icon.className = 'material-icons-round';
            icon.textContent = this.workoutState[type].completed ? 'check_circle' : 'radio_button_unchecked';
            
            const text = document.createElement('span');
            text.textContent = type;
            
            // Add count badge if clicked more than once
            if (this.workoutCounts[type] > 1) {
                const badge = document.createElement('span');
                badge.className = 'count-badge';
                badge.textContent = this.workoutCounts[type];
                tab.appendChild(badge);
            }
            
            tab.appendChild(icon);
            tab.appendChild(text);
            
            // Add click event
            tab.addEventListener('click', () => this.toggleWorkout(type));
            
            this.elements.tabsContainer.appendChild(tab);
        });
    }
    
    /**
     * Toggle workout completion status
     * @param {string} type - Workout type
     */
    toggleWorkout(type) {
        // Increase count
        this.workoutCounts[type] += 1;
        
        // Update completion status
        this.workoutState[type].completed = true;
        
        // Record in history
        this.saveWorkoutHistory(type);
        
        // Check if all workouts are completed
        const allCompleted = Object.values(this.workoutState).every(state => state.completed);
        if (allCompleted) {
            this.resetWorkoutTabs();
            utils.showToast('All workouts completed! Tabs have been reset.', 'success');
        } else {
            // Save state and update display
            this.saveState();
            this.renderWorkoutTabs();
            this.refreshHistory();
            
            utils.showToast(`${type} workout marked as complete!`, 'success');
        }
    }
    
    /**
     * Save the current state to localStorage
     */
    saveState() {
        localStorage.setItem(this.stateKey, JSON.stringify(this.workoutState));
        localStorage.setItem(this.countKey, JSON.stringify(this.workoutCounts));
    }
    
    /**
     * Reset workout tabs (but keep history)
     */
    resetWorkoutTabs() {
        // Reset workout state
        this.workoutTypes.forEach(type => {
            this.workoutState[type].completed = false;
            this.workoutState[type].order = this.workoutTypes.indexOf(type);
        });
        
        // Reset workout counts
        this.workoutTypes.forEach(type => {
            this.workoutCounts[type] = 0;
        });
        
        // Save and update display
        this.saveState();
        this.renderWorkoutTabs();
        this.refreshHistory();
    }
    
    /**
     * Save workout to daily history
     * @param {string} type - Workout type
     */
    saveWorkoutHistory(type) {
        const currentDate = utils.formatDate(new Date());
        
        if (!this.workoutHistory[currentDate]) {
            this.workoutHistory[currentDate] = [];
        }
        
        this.workoutHistory[currentDate].push({
            type,
            count: this.workoutCounts[type],
            timestamp: new Date().toISOString()
        });
        
        localStorage.setItem(this.historyKey, JSON.stringify(this.workoutHistory));
    }
    
    /**
     * Refresh history displays
     */
    refreshHistory() {
        this.showDailyHistory();
        this.showCurrentWorkouts();
        this.renderWorkoutAnalytics(); // Add analytics rendering
    }
    
    /**
     * Show daily history (weekly summary)
     */
    showDailyHistory() {
        if (!this.elements.dailyHistoryTab) return;
        
        this.elements.dailyHistoryTab.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        // Sort dates (most recent first) and limit to 7 days
        const dates = Object.keys(this.workoutHistory).sort((a, b) => {
            return b.localeCompare(a);
        }).slice(0, 7);
        
        if (dates.length === 0) {
            const noData = document.createElement('p');
            noData.textContent = 'No workout history available.';
            fragment.appendChild(noData);
        } else {
            dates.forEach(date => {
                const entries = this.workoutHistory[date];
                
                const dayEntry = document.createElement('div');
                dayEntry.className = 'day-entry';
                
                const dateText = document.createElement('p');
                dateText.innerHTML = `<b>${date}</b>`;
                dayEntry.appendChild(dateText);
                
                // Group workouts by type
                const workoutsByType = {};
                entries.forEach(entry => {
                    if (!workoutsByType[entry.type]) {
                        workoutsByType[entry.type] = 0;
                    }
                    workoutsByType[entry.type] += 1;
                });
                
                // Show workout summary
                const workoutSummary = document.createElement('p');
                workoutSummary.textContent = `Completed workouts: ${Object.keys(workoutsByType).length} types`;
                dayEntry.appendChild(workoutSummary);
                
                // List each workout type
                const workoutList = document.createElement('ul');
                workoutList.style.paddingLeft = '20px';
                workoutList.style.marginTop = '5px';
                
                Object.entries(workoutsByType).forEach(([type, count]) => {
                    const workoutItem = document.createElement('li');
                    workoutItem.textContent = `${type}: ${count} ${count === 1 ? 'time' : 'times'}`;
                    workoutList.appendChild(workoutItem);
                });
                
                dayEntry.appendChild(workoutList);
                fragment.appendChild(dayEntry);
            });
        }
        
        this.elements.dailyHistoryTab.appendChild(fragment);
        this.elements.dailyHistoryTab.classList.add('active');
        
        if (this.elements.currentWorkoutsTab) {
            this.elements.currentWorkoutsTab.classList.remove('active');
        }
    }
    
    /**
     * Show current day's workouts
     */
    showCurrentWorkouts() {
        if (!this.elements.currentWorkoutsTab) return;
        
        this.elements.currentWorkoutsTab.innerHTML = '';
        const currentDate = utils.formatDate(new Date());
        const entries = this.workoutHistory[currentDate] || [];
        
        const container = document.createElement('div');
        
        const header = document.createElement('h3');
        header.textContent = `Today's Workouts`;
        container.appendChild(header);
        
        if (entries.length === 0) {
            const noEntries = document.createElement('p');
            noEntries.textContent = 'No workouts recorded today.';
            container.appendChild(noEntries);
        } else {
            // Group entries by workout type and count
            const groupedEntries = {};
            entries.forEach(entry => {
                if (!groupedEntries[entry.type]) {
                    groupedEntries[entry.type] = [];
                }
                groupedEntries[entry.type].push(entry);
            });
            
            const entriesList = document.createElement('ul');
            
            Object.entries(groupedEntries).forEach(([type, typeEntries]) => {
                const entryItem = document.createElement('li');
                const lastEntry = typeEntries[typeEntries.length - 1];
                const time = new Date(lastEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                entryItem.innerHTML = `<b>${type}</b>: ${typeEntries.length} ${typeEntries.length === 1 ? 'time' : 'times'} (last at ${time})`;
                entriesList.appendChild(entryItem);
            });
            
            container.appendChild(entriesList);
        }
        
        this.elements.currentWorkoutsTab.appendChild(container);
    }
    
    /**
     * Check if daily workouts need to be reset
     */
    checkAndResetDailyWorkouts() {
    const currentDate = utils.formatDate(new Date());
    const lastResetDate = localStorage.getItem(this.lastResetKey);
    
    // Only record the date check, but don't reset unless all workouts are completed
    if (lastResetDate !== currentDate) {
        // Just update the last reset date without resetting workouts
        localStorage.setItem(this.lastResetKey, currentDate);
        
        this.preserveTodaysWorkoutData();
    }
     }
    
    /**
 * New helper function to preserve workout data across days
 */
preserveTodaysWorkoutData() {
    // Instead of removing today's history, we'll keep what we have
    // and just update the internal tracking date
    const currentDate = utils.formatDate(new Date());
    
    // Make sure current date's data structure exists
    if (!this.workoutHistory[currentDate]) {
        this.workoutHistory[currentDate] = [];
        localStorage.setItem(this.historyKey, JSON.stringify(this.workoutHistory));
    }
    }

    /**
     * Setup automatic reset at midnight
     */
    setupMidnightReset() {
        // Calculate time until next midnight
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const midnight = new Date(tomorrow.setHours(0, 0, 0, 0));
        const msUntilMidnight = midnight - now;
        
        // Set timeout for midnight reset
        setTimeout(() => {
            this.checkAndResetDailyWorkouts();
            this.setupMidnightReset(); // Set up next day's reset
        }, msUntilMidnight);
    }
    
    /**
     * Reset daily workouts and remove today's history
     */
    resetDailyWorkouts() {
        // Reset workout tabs
        this.resetWorkoutTabs();
        
        // Remove today's history
        const currentDate = utils.formatDate(new Date());
        if (this.workoutHistory[currentDate]) {
            delete this.workoutHistory[currentDate];
            localStorage.setItem(this.historyKey, JSON.stringify(this.workoutHistory));
        }
    }
    
    /**
     * Reset all data for this tracker
     */
    resetAllData() {
        localStorage.removeItem(this.stateKey);
        localStorage.removeItem(this.countKey);
        localStorage.removeItem(this.historyKey);
        localStorage.removeItem(this.lastResetKey);
        
        utils.showToast('All workout tracking data has been reset.', 'warning');
        
        // Reload the page to reset all instances
        setTimeout(() => location.reload(), 1500);
    }
    
    /**
     * Update display
     */
    updateDisplay() {
        this.renderWorkoutTabs();
        this.refreshHistory();
    }

    /**
     * Initialize workout analytics
     */
    initializeWorkoutAnalytics() {
        // Populate workout type options in dropdown
        if (this.elements.viewTypeSelect) {
            // Clear any existing options after the first two (All and Comparison)
            while (this.elements.viewTypeSelect.options.length > 2) {
                this.elements.viewTypeSelect.remove(2);
            }
            
            // Add individual workout options
            this.workoutTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type.toLowerCase();
                option.textContent = type;
                this.elements.viewTypeSelect.appendChild(option);
            });
            
            // Add event listener for dropdown change
            this.elements.viewTypeSelect.addEventListener('change', (e) => {
                this.selectedWorkoutView = e.target.value;
                this.renderWorkoutAnalytics();
            });
        }
        
        // Add event listener for time period dropdown
        if (this.elements.timePeriodSelect) {
            this.elements.timePeriodSelect.addEventListener('change', (e) => {
                this.selectedTimePeriod = e.target.value;
                this.renderWorkoutAnalytics();
            });
        }
        
        // Initialize view
        this.renderWorkoutAnalytics();
    }
    
    /**
     * Render workout analytics (graph and streaks)
     */
    renderWorkoutAnalytics() {
        this.renderWorkoutGraph();
        this.renderWorkoutStreaks();
    }

    /**
 * Aggregate data points by month for yearly view
 * @param {Array} dataPoints - Array of data points
 * @returns {Array} - Aggregated data by month
 */
aggregateDataByMonth(dataPoints) {
    // Group data by month
    const monthlyGroups = {};
    
    dataPoints.forEach(point => {
        // Extract year and month from date (format: YYYY-MM-DD)
        const [year, month] = point.date.split('-');
        const monthKey = `${year}-${month}`;
        
        if (!monthlyGroups[monthKey]) {
            monthlyGroups[monthKey] = {
                date: new Date(parseInt(year), parseInt(month) - 1, 1), // First day of month
                total: 0,
                count: 0
            };
        }
        
        monthlyGroups[monthKey].total += point.value;
        monthlyGroups[monthKey].count++;
    });
    
    // Convert to array and calculate average values
    const monthlyData = Object.values(monthlyGroups).map(group => {
        return {
            date: utils.formatDate(group.date),
            value: group.total / group.count // Average value
        };
    });
    
    // Sort by date (oldest first)
    return monthlyData.sort((a, b) => a.date.localeCompare(b.date));
}
    
    /**
 * Get workout data by time period
 * @returns {Array|Object} Array or object of data points for visualization
 */
getWorkoutDataByTimePeriod() {
    const today = new Date();
    let dataPoints = [];
    
    // Determine date range based on time period
    let daysToInclude = 7;
    if (this.selectedTimePeriod === 'monthly') {
        daysToInclude = 30;
    } else if (this.selectedTimePeriod === 'quarterly') {
        daysToInclude = 90;
    } else if (this.selectedTimePeriod === 'yearly') {
        daysToInclude = 365; // Full year of data
    }
    
    // Generate dates in range (newest to oldest)
    const dates = [];
    for (let i = 0; i < daysToInclude; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        dates.push(utils.formatDate(date));
    }
    
    // Process based on selected view
    if (this.selectedWorkoutView === 'all') {
        // All workouts combined - single line
        dataPoints = dates.map(dateKey => {
            const entries = this.workoutHistory[dateKey] || [];
            return {
                date: dateKey,
                value: entries.length // Total number of workouts completed
            };
        });
    } else if (this.selectedWorkoutView === 'comparison') {
        // Workout comparison - multiple lines
        dataPoints = {};
        
        this.workoutTypes.forEach(type => {
            dataPoints[type] = dates.map(dateKey => {
                const entries = this.workoutHistory[dateKey] || [];
                const typeEntries = entries.filter(entry => entry.type === type);
                return {
                    date: dateKey,
                    value: typeEntries.length
                };
            });
        });
    } else {
        // Individual workout type
        const selectedType = this.selectedWorkoutView.charAt(0).toUpperCase() + 
                            this.selectedWorkoutView.slice(1);
        
        dataPoints = dates.map(dateKey => {
            const entries = this.workoutHistory[dateKey] || [];
            const typeEntries = entries.filter(entry => entry.type === selectedType);
            return {
                date: dateKey,
                value: typeEntries.length
            };
        });
    }
    
    // For yearly data, we might want to aggregate by month for clarity
    if (this.selectedTimePeriod === 'yearly') {
        // If it's a comparison view with multiple lines
        if (this.selectedWorkoutView === 'comparison') {
            const aggregatedData = {};
            
            Object.entries(dataPoints).forEach(([type, typeData]) => {
                // Group by month and aggregate
                const monthlyData = this.aggregateDataByMonth(typeData);
                aggregatedData[type] = monthlyData;
            });
            
            return aggregatedData;
        } else {
            // Single line - aggregate by month
            return this.aggregateDataByMonth(dataPoints);
        }
    }
    
    return dataPoints;
}

    
    /**
     * Calculate workout streaks
     * @returns {Array} Array of streak objects
     */
    calculateWorkoutStreaks() {
        // Get all workout dates in ascending order
        const sortedDates = Object.keys(this.workoutHistory).sort();
        const streaks = [];
        
        if (this.selectedWorkoutView === 'all') {
            // Calculate streaks for any workout
            let currentStreak = null;
            
            sortedDates.forEach(date => {
                const entries = this.workoutHistory[date];
                if (!entries || entries.length === 0) {
                    // No workouts on this day, end streak
                    if (currentStreak && currentStreak.length > 1) {
                        streaks.push(currentStreak);
                    }
                    currentStreak = null;
                    return;
                }
                
                if (!currentStreak) {
                    // Start new streak
                    currentStreak = { start: date, end: date, length: 1 };
                } else {
                    // Check if this date is consecutive
                    const lastDate = new Date(currentStreak.end);
                    const nextDay = new Date(lastDate);
                    nextDay.setDate(lastDate.getDate() + 1);
                    const currentDate = new Date(date);
                    
                    if (currentDate.getTime() === nextDay.getTime()) {
                        // Consecutive day, extend streak
                        currentStreak.end = date;
                        currentStreak.length++;
                    } else {
                        // Non-consecutive, save streak and start new one
                        streaks.push(currentStreak);
                        currentStreak = { start: date, end: date, length: 1 };
                    }
                }
            });
            
            // Add final streak if exists
            if (currentStreak && currentStreak.length > 1) {
                streaks.push(currentStreak);
            }
            
        } else if (this.selectedWorkoutView === 'comparison') {
            // Show top streak for each workout type
            this.workoutTypes.forEach(type => {
                const typeStreak = this.calculateWorkoutTypeStreak(type);
                if (typeStreak && typeStreak.length > 1) {
                    streaks.push({
                        ...typeStreak,
                        type: type
                    });
                }
            });
            
        } else {
            // Individual workout type
            const selectedType = this.selectedWorkoutView.charAt(0).toUpperCase() + 
                                 this.selectedWorkoutView.slice(1);
            const typeStreaks = this.calculateAllWorkoutTypeStreaks(selectedType);
            streaks.push(...typeStreaks);
        }
        
        return streaks.sort((a, b) => b.length - a.length);
    }
    
    /**
     * Calculate streaks for specific workout type
     * @param {string} type - Workout type
     * @returns {Object|null} Best streak object or null
     */
    calculateWorkoutTypeStreak(type) {
        const sortedDates = Object.keys(this.workoutHistory).sort();
        let bestStreak = null;
        let currentStreak = null;
        
        sortedDates.forEach(date => {
            const entries = this.workoutHistory[date] || [];
            const hasWorkout = entries.some(entry => entry.type === type);
            
            if (!hasWorkout) {
                // No workout of this type, end streak
                if (currentStreak && currentStreak.length > 1) {
                    if (!bestStreak || currentStreak.length > bestStreak.length) {
                        bestStreak = currentStreak;
                    }
                }
                currentStreak = null;
                return;
            }
            
            if (!currentStreak) {
                // Start new streak
                currentStreak = { start: date, end: date, length: 1 };
            } else {
                // Check if consecutive
                const lastDate = new Date(currentStreak.end);
                const nextDay = new Date(lastDate);
                nextDay.setDate(lastDate.getDate() + 1);
                const currentDate = new Date(date);
                
                if (currentDate.getTime() === nextDay.getTime()) {
                    // Consecutive, extend streak
                    currentStreak.end = date;
                    currentStreak.length++;
                } else {
                    // Non-consecutive, save if best
                    if (!bestStreak || currentStreak.length > bestStreak.length) {
                        bestStreak = currentStreak;
                    }
                    currentStreak = { start: date, end: date, length: 1 };
                }
            }
        });
        
        // Check final streak
        if (currentStreak && currentStreak.length > 1) {
            if (!bestStreak || currentStreak.length > bestStreak.length) {
                bestStreak = currentStreak;
            }
        }
        
        return bestStreak;
    }
    
    /**
     * Calculate all streaks for a specific workout type
     * @param {string} type - Workout type
     * @returns {Array} Array of streak objects
     */
    calculateAllWorkoutTypeStreaks(type) {
        const sortedDates = Object.keys(this.workoutHistory).sort();
        const streaks = [];
        let currentStreak = null;
        
        sortedDates.forEach(date => {
            const entries = this.workoutHistory[date] || [];
            const hasWorkout = entries.some(entry => entry.type === type);
            
            if (!hasWorkout) {
                // No workout of this type, end streak
                if (currentStreak && currentStreak.length > 1) {
                    streaks.push(currentStreak);
                }
                currentStreak = null;
                return;
            }
            
            if (!currentStreak) {
                // Start new streak
                currentStreak = { start: date, end: date, length: 1 };
            } else {
                // Check if consecutive
                const lastDate = new Date(currentStreak.end);
                const nextDay = new Date(lastDate);
                nextDay.setDate(lastDate.getDate() + 1);
                const currentDate = new Date(date);
                
                if (currentDate.getTime() === nextDay.getTime()) {
                    // Consecutive, extend streak
                    currentStreak.end = date;
                    currentStreak.length++;
                } else {
                    // Non-consecutive, save and start new
                    streaks.push(currentStreak);
                    currentStreak = { start: date, end: date, length: 1 };
                }
            }
        });
        
        // Add final streak if exists
        if (currentStreak && currentStreak.length > 1) {
            streaks.push(currentStreak);
        }
        
        return streaks;
    }
    
    /**
     * Render workout graph
     */
    renderWorkoutGraph() {
        const chartContainer = this.elements.workoutChart;
        if (!chartContainer) return;
        
        // Clear existing content except labels
        const yLabels = chartContainer.querySelector('.workout-chart-y-labels');
        const axis = chartContainer.querySelector('.workout-chart-axis');
        chartContainer.innerHTML = '';
        if (yLabels) chartContainer.appendChild(yLabels);
        if (axis) chartContainer.appendChild(axis);
        
        // Get data
        const dataPoints = this.getWorkoutDataByTimePeriod();
        
        // Check if chart container is visible
        if (chartContainer.offsetWidth === 0) {
            setTimeout(() => this.renderWorkoutGraph(), 100);
            return;
        }
        
        // Render based on view type
        if (this.selectedWorkoutView === 'all' || 
            this.selectedWorkoutView !== 'comparison') {
            // Single line chart
            this.renderSingleLineChart(dataPoints, chartContainer);
        } else {
            // Multiple line chart for comparison
            this.renderMultiLineChart(dataPoints, chartContainer);
        }
        
        // Render labels
        this.renderChartLabels();
    }
    
    /**
     * Render single line chart
     * @param {Array} dataPoints - Data points
     * @param {Element} container - Chart container
     */
    renderSingleLineChart(dataPoints, container) {
        // Determine max value for y-axis scaling
        let maxValue = Math.max(...dataPoints.map(point => point.value));
        maxValue = maxValue <= 0 ? 10 : Math.ceil(maxValue * 1.2); // Add 20% padding, minimum of 10
        
        // Update y-axis labels with dynamic scale
        this.updateYAxisLabels(maxValue);
        
        // Calculate coordinates for smooth curve
        const pathPoints = this.calculateSmoothCurve(dataPoints, container, maxValue);
        
        // Create SVG path for smooth line
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        
        // Create path element
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", pathPoints);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", this.getWorkoutColor());
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);
        container.appendChild(svg);
        
        // Render data points
        dataPoints.forEach((point, index) => {
            if (point.value > 0) { // Only show points for days with workouts
                const x = 40 + (index / (dataPoints.length - 1)) * (container.offsetWidth - 50);
                const y = container.offsetHeight - (point.value / maxValue) * (container.offsetHeight - 20);
                
                const pointElement = document.createElement('div');
                pointElement.className = `workout-chart-point`;
                pointElement.style.left = `${x}px`;
                pointElement.style.top = `${y}px`;
                container.appendChild(pointElement);
            }
        });
    }
    
    /**
     * Render multi line chart for comparison
     * @param {Object} dataPoints - Data points keyed by workout type
     * @param {Element} container - Chart container
     */
    renderMultiLineChart(dataPoints, container) {
        // Find max value across all workout types
        let maxValue = 0;
        Object.values(dataPoints).forEach(typeData => {
            const typeMax = Math.max(...typeData.map(point => point.value));
            maxValue = Math.max(maxValue, typeMax);
        });
        maxValue = maxValue <= 0 ? 10 : Math.ceil(maxValue * 1.2); // Add 20% padding, minimum of 10
        
        // Update y-axis labels with dynamic scale
        this.updateYAxisLabels(maxValue);
        
        // Create SVG for all lines
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        
        // Create legend
        const legend = document.createElement('div');
        legend.className = 'workout-chart-legend';
        
        // Process each workout type
        Object.entries(dataPoints).forEach(([type, typeData], typeIndex) => {
            // Get color for this workout
            const color = this.getWorkoutColor(type, typeIndex);
            
            // Calculate path
            const pathPoints = this.calculateSmoothCurve(typeData, container, maxValue);
            
            // Create path element
            const path = document.createElementNS(svgNS, "path");
            path.setAttribute("d", pathPoints);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", color);
            path.setAttribute("stroke-width", "2");
            path.setAttribute("stroke-linecap", "round");
            path.setAttribute("stroke-linejoin", "round");
            svg.appendChild(path);
            
            // Add legend item
            const legendItem = document.createElement('div');
            legendItem.className = 'workout-legend-item';
            
            const colorSwatch = document.createElement('span');
            colorSwatch.className = 'workout-color-swatch';
            colorSwatch.style.backgroundColor = color;
            
            const typeName = document.createElement('span');
            typeName.textContent = type;
            
            legendItem.appendChild(colorSwatch);
            legendItem.appendChild(typeName);
            legend.appendChild(legendItem);
            
            // Render data points for this type
            typeData.forEach((point, index) => {
                if (point.value > 0) { // Only show points for days with workouts
                    const x = 40 + (index / (typeData.length - 1)) * (container.offsetWidth - 50);
                    const y = container.offsetHeight - (point.value / maxValue) * (container.offsetHeight - 20);
                    
                    const pointElement = document.createElement('div');
                    pointElement.className = `workout-chart-point`;
                    pointElement.style.backgroundColor = color;
                    pointElement.style.left = `${x}px`;
                    pointElement.style.top = `${y}px`;
                    container.appendChild(pointElement);
                }
            });
        });
        
        // Add svg and legend to container
        container.appendChild(svg);
        container.appendChild(legend);
    }
    
    /**
     * Update Y-axis labels based on data maximum
     * @param {number} maxValue - Maximum value in data
     */
    updateYAxisLabels(maxValue) {
        const yLabelsContainer = this.elements.workoutChart.querySelector('.workout-chart-y-labels');
        if (!yLabelsContainer) return;
        
        // Clear existing labels
        yLabelsContainer.innerHTML = '';
        
        // Create labels with appropriate scale
        const steps = 4; // Number of steps (including 0)
        for (let i = steps - 1; i >= 0; i--) {
            const value = Math.round(maxValue * i / (steps - 1));
            const label = document.createElement('span');
            label.textContent = value;
            yLabelsContainer.appendChild(label);
        }
    }
    
    /**
     * Calculate smooth curve path for SVG
     * @param {Array} points - Data points
     * @param {Element} container - Chart container
     * @param {number} maxValue - Maximum value for scaling
     * @returns {string} - SVG path data
     */
    calculateSmoothCurve(points, container, maxValue) {
        if (points.length < 2) return '';
        
        const width = container.offsetWidth;
        const height = container.offsetHeight;
        const coordinates = points.map((point, index) => {
            const x = 40 + (index / (points.length - 1)) * (width - 50);
            const y = height - (point.value / maxValue) * (height - 20);
            return [x, y];
        });
        
        // Create path data for smooth curve
        let path = `M ${coordinates[0][0]},${coordinates[0][1]}`;
        
        // Add curved segments between points
        for (let i = 0; i < coordinates.length - 1; i++) {
            const x1 = coordinates[i][0];
            const y1 = coordinates[i][1];
            const x2 = coordinates[i + 1][0];
            const y2 = coordinates[i + 1][1];
            
            // Calculate control points for smooth curve
            const cpx1 = x1 + (x2 - x1) / 3;
            const cpy1 = y1;
            const cpx2 = x1 + 2 * (x2 - x1) / 3;
            const cpy2 = y2;
            
            // Add cubic bezier curve
            path += ` C ${cpx1},${cpy1} ${cpx2},${cpy2} ${x2},${y2}`;
        }
        
        return path;
    }
    
    /**
     * Get color for workout
     * @param {string} type - Workout type (optional)
     * @param {number} index - Index for color selection (optional)
     * @returns {string} - Color hex code
     */
    getWorkoutColor(type, index) {
        // Predefined color palette for different workout types
        const colors = [
            '#FF5042', // coral (chest)
            '#5B6EF7', // royalblue (back)
            '#B96CDA', // purple (shoulders)
            '#58B5F0', // skyblue (biceps)
            '#4AD6B8', // seagreen (triceps)
            '#FF7B29', // tangerine (abs)
            '#4CAF50'  // green (legs)
        ];
        
        // If specific workout type is provided
        if (type) {
            const typeIndex = this.workoutTypes.indexOf(type);
            if (typeIndex >= 0) {
                return colors[typeIndex % colors.length];
            }
            return colors[index % colors.length];
        }
        
        // Default workout color (if no type provided)
        return '#4CAF50'; // workout primary color
    }
    
    /**
 * Render chart labels for time axis
 */
renderChartLabels() {
    if (!this.elements.chartLabels) return;
    
    this.elements.chartLabels.innerHTML = '';
    
    // Get dates based on time period
    const today = new Date();
    let labelDates = [];
    
    switch (this.selectedTimePeriod) {
        case 'weekly':
            // Last 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                labelDates.push(date);
            }
            break;
            
        case 'monthly':
            // Last 30 days, but show only key dates
            for (let i = 0; i < 30; i += 5) {
                const date = new Date(today);
                date.setDate(today.getDate() - 29 + i);
                labelDates.push(date);
            }
            // Always include today
            labelDates.push(today);
            break;
            
        case 'quarterly':
            // Last 90 days, but show only key dates
            for (let i = 0; i < 90; i += 15) {
                const date = new Date(today);
                date.setDate(today.getDate() - 89 + i);
                labelDates.push(date);
            }
            // Include today
            labelDates.push(today);
            break;
            
        case 'yearly':
            // Last 12 months, show monthly labels
            for (let i = 11; i >= 0; i--) {
                const date = new Date(today);
                date.setMonth(today.getMonth() - i);
                date.setDate(1); // First day of month
                labelDates.push(date);
            }
            break;
    }
    
    // Determine how many labels to show (reduce for smaller screens)
    const maxLabels = window.innerWidth < 400 ? 3 : 5;
    const step = Math.ceil(labelDates.length / maxLabels);
    
    // Add labels with proper spacing
    labelDates.forEach((date, index) => {
        // Only show beginning, end, and some intermediate labels
        if (index === 0 || index === labelDates.length - 1 || index % step === 0) {
            const label = document.createElement('span');
            label.textContent = this.formatDateForTimePeriod(date);
            this.elements.chartLabels.appendChild(label);
        }
    });
}
    
    /**
 * Format date for time period display
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
formatDateForTimePeriod(date) {
    switch (this.selectedTimePeriod) {
        case 'weekly':
            return (date.getMonth() + 1) + '/' + date.getDate();
            
        case 'monthly':
            const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
            return monthShort + ' ' + date.getDate();
            
        case 'quarterly':
            const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
            return month + ' ' + date.getDate();
            
        case 'yearly':
            // For yearly view, just show the month name
            const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
            return monthName + ' ' + date.getFullYear().toString().substr(2, 2); // Show "Jan 23" format
            
        default:
            return (date.getMonth() + 1) + '/' + date.getDate();
    }
}
    
    /**
     * Render workout streaks
     */
    renderWorkoutStreaks() {
        if (!this.elements.workoutStreaks) return;
        
        this.elements.workoutStreaks.innerHTML = '';
        
        // Calculate streaks
        const streaks = this.calculateWorkoutStreaks();
        
        // Show top 3 streaks
        const topStreaks = streaks.slice(0, 3);
        
        if (topStreaks.length === 0) {
            const noStreaks = document.createElement('p');
            noStreaks.textContent = 'No streaks recorded yet.';
            this.elements.workoutStreaks.appendChild(noStreaks);
            return;
        }
        
        // Create streak bars
        topStreaks.forEach(streak => {
            const streakBar = document.createElement('div');
            streakBar.className = 'workout-streak-bar';
            
            const startDate = new Date(streak.start);
            const endDate = new Date(streak.end);
            
            const dateRange = document.createElement('div');
            dateRange.className = 'workout-streak-date';
            dateRange.textContent = `${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`;
            
            const streakVisual = document.createElement('div');
            streakVisual.className = `workout-streak-visual`;
            
            // Set color based on workout type if available
            if (streak.type) {
                const typeIndex = this.workoutTypes.indexOf(streak.type);
                streakVisual.style.backgroundColor = this.getWorkoutColor(streak.type, typeIndex);
                
                // Add type name for comparison view
                if (this.selectedWorkoutView === 'comparison') {
                    streakVisual.textContent = `${streak.type}: ${streak.length} days`;
                } else {
                    streakVisual.textContent = `${streak.length} days`;
                }
            } else {
                streakVisual.textContent = `${streak.length} days`;
            }
            
            streakBar.appendChild(dateRange);
            streakBar.appendChild(streakVisual);
            
            this.elements.workoutStreaks.appendChild(streakBar);
        });
    }
}

