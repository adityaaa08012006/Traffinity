// Global Application State
let appState = {
    uploadedImages: {
        north: null,
        east: null,
        south: null,
        west: null
    },
    vehicleCounts: {
        north: { a: 0, b: 0, c: 0 },
        east: { a: 0, b: 0, c: 0 },
        south: { a: 0, b: 0, c: 0 },
        west: { a: 0, b: 0, c: 0 }
    },
    signalTiming: {
        north: 30,
        east: 25,
        south: 35,
        west: 28
    },
    simulationActive: false,
    currentPhase: 'north',
    cycleStartTime: null,
    distributionChart: null,
    simulationInterval: null
};

// Traffic Engineering Constants
const TRAFFIC_CONFIG = {
    baseSignalTiming: {
        minimumGreen: 20,
        maximumGreen: 90,
        yellowDuration: 3,
        allRedClearance: 2,
        pedestrianCrossing: 15
    },
    vehicleWeights: {
        twoWheeler: 1,
        fourWheeler: 2,
        heavyVehicle: 3
    },
    congestionThresholds: {
        low: 30,
        moderate: 60,
        heavy: 100
    },
    phaseSequence: ['north', 'east', 'south', 'west'] // Anti-clockwise rotation
};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Smart Junction AI - Initializing...');
    console.log('DOM fully loaded and parsed');
    
    try {
        initializeFileUploads();
        initializeButtons();
        initializeSimulatorControls();
        
        // Set default performance metrics for demo
        updatePerformanceMetrics();
        
        console.log('Smart Junction AI - Ready!');
        showNotification('Smart Junction AI system ready for traffic analysis', 'success');
        
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('System loaded with some limitations. Core functionality available.', 'warning');
    }
});

// File Upload Initialization
function initializeFileUploads() {
    const directions = ['north', 'east', 'south', 'west'];
    
    directions.forEach(direction => {
        const fileInput = document.getElementById(`file-${direction}`);
        const uploadLabel = document.querySelector(`[data-direction="${direction}"] .upload-label`);
        const uploadArea = document.getElementById(`upload-${direction}`);
        
        console.log(`Initializing ${direction}:`, {fileInput, uploadLabel, uploadArea});
        
        if (fileInput && uploadLabel) {
            fileInput.addEventListener('change', (e) => {
                console.log(`File selected for ${direction}:`, e.target.files[0]);
                if (e.target.files.length > 0) {
                    handleFileUpload(direction, e.target.files[0]);
                }
            });
            
            // Make sure click events work
            uploadLabel.addEventListener('click', () => {
                console.log(`Upload label clicked for ${direction}`);
                fileInput.click();
            });
            
            // Drag and drop functionality
            setupDragAndDrop(uploadLabel, direction);
        }
    });
}

// Setup Drag and Drop
function setupDragAndDrop(element, direction) {
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', (e) => handleFileDrop(direction, e));
    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragleave', handleDragLeave);
}

// Drag and Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.style.borderColor = 'var(--signal-yellow)';
    e.currentTarget.style.background = 'rgba(255, 210, 63, 0.05)';
}

function handleDragEnter(e) {
    e.preventDefault();
}

function handleDragLeave(e) {
    e.currentTarget.style.borderColor = 'var(--glass-border)';
    e.currentTarget.style.background = 'var(--glass-bg)';
}

function handleFileDrop(direction, e) {
    e.preventDefault();
    e.currentTarget.style.borderColor = 'var(--glass-border)';
    e.currentTarget.style.background = 'var(--glass-bg)';
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            handleFileUpload(direction, file);
        } else {
            showNotification('Please upload a valid image file', 'error');
        }
    }
}

// File Upload Handler
function handleFileUpload(direction, file) {
    if (!file || !file.type.startsWith('image/')) {
        showNotification('Please select a valid image file', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showNotification('File size must be less than 10MB', 'error');
        return;
    }
    
    console.log(`Uploading image for ${direction} lane:`, file.name);
    
    // Update UI to show uploading state
    updateUploadStatus(direction, 'uploading');
    
    // Store file reference
    appState.uploadedImages[direction] = file;
    
    // Display image preview
    displayImagePreview(direction, file);
    
    // Start analysis after short delay
    setTimeout(() => {
        analyzeVehicleImage(direction, file);
    }, 1000);
}

// Display Image Preview
function displayImagePreview(direction, file) {
    const previewContainer = document.getElementById(`preview-${direction}`);
    if (!previewContainer) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        previewContainer.innerHTML = `
            <img src="${e.target.result}" alt="${direction} lane traffic" />
            <div style="margin-top: 8px; font-size: 12px; color: var(--tech-gray); opacity: 0.7;">
                ${file.name} (${formatFileSize(file.size)})
            </div>
        `;
        previewContainer.classList.add('active');
    };
    reader.readAsDataURL(file);
}

// Vehicle Image Analysis (Simulated AI)
function analyzeVehicleImage(direction, file) {
    console.log(`Analyzing ${direction} lane image with simulated AI...`);
    
    updateUploadStatus(direction, 'analyzing');
    
    // Simulate AI processing time
    setTimeout(() => {
        const analysis = simulateVehicleDetection(file);
        console.log(`${direction} lane analysis complete:`, analysis);
        
        // Store results
        appState.vehicleCounts[direction] = {
            a: analysis.twoWheelers,
            b: analysis.fourWheelers,
            c: analysis.heavyVehicles
        };
        
        // Update UI
        updateVehicleCounts(direction, analysis);
        updateUploadStatus(direction, 'completed');
        
        // Recalculate signal timing
        appState.signalTiming = calculateOptimalSignalTiming();
        
        // Check if all lanes are analyzed
        checkAllLanesAnalyzed();
        
        showNotification(`${direction.charAt(0).toUpperCase() + direction.slice(1)} lane analysis complete: ${analysis.total} vehicles detected`, 'success');
        
    }, 2000 + Math.random() * 1000); // 2-3 seconds processing time
}

// Simulate Vehicle Detection Algorithm
function simulateVehicleDetection(file) {
    // Advanced simulation based on image properties
    const fileSize = file.size;
    const fileName = file.name.toLowerCase();
    
    // Base detection factors
    let sizeFactor = Math.max(0.5, Math.min(2.0, fileSize / (2 * 1024 * 1024))); // Normalize to 2MB
    let randomFactor = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
    let qualityFactor = fileName.includes('hd') || fileName.includes('high') ? 1.2 : 1.0;
    
    // Simulate realistic traffic counts
    const baseTwoWheelers = 15 + Math.random() * 25;
    const baseFourWheelers = 8 + Math.random() * 20;
    const baseHeavyVehicles = 1 + Math.random() * 8;
    
    const twoWheelers = Math.floor(baseTwoWheelers * sizeFactor * randomFactor * qualityFactor);
    const fourWheelers = Math.floor(baseFourWheelers * sizeFactor * randomFactor * qualityFactor);
    const heavyVehicles = Math.floor(baseHeavyVehicles * sizeFactor * randomFactor * qualityFactor);
    
    const total = twoWheelers + fourWheelers + heavyVehicles;
    
    // Calculate confidence based on image quality factors
    let confidence = 85;
    if (fileSize > 3 * 1024 * 1024) confidence += 5; // Large file = better quality
    if (fileName.includes('traffic')) confidence += 3; // Traffic-specific image
    confidence += Math.floor(Math.random() * 8); // Random variation
    confidence = Math.min(98, confidence);
    
    return {
        twoWheelers,
        fourWheelers,
        heavyVehicles,
        total,
        confidence,
        detectionAccuracy: `${confidence}%`,
        processingTime: `${(2.1 + Math.random() * 0.8).toFixed(1)}s`
    };
}

// Update Vehicle Counts Display
function updateVehicleCounts(direction, analysis) {
    const elements = {
        a: document.getElementById(`count-${direction}-a`),
        b: document.getElementById(`count-${direction}-b`),
        c: document.getElementById(`count-${direction}-c`)
    };
    
    // Animate the counts
    if (elements.a) animateCountUpdate(elements.a, analysis.twoWheelers);
    if (elements.b) animateCountUpdate(elements.b, analysis.fourWheelers);
    if (elements.c) animateCountUpdate(elements.c, analysis.heavyVehicles);
}

// Animate Count Updates
function animateCountUpdate(element, targetValue) {
    let currentValue = 0;
    const increment = Math.max(1, Math.floor(targetValue / 15));
    const timer = setInterval(() => {
        currentValue += increment;
        if (currentValue >= targetValue) {
            currentValue = targetValue;
            clearInterval(timer);
        }
        element.textContent = currentValue;
    }, 50);
}

// Update Upload Status
function updateUploadStatus(direction, status) {
    const statusElement = document.getElementById(`status-${direction}`);
    const laneUpload = document.querySelector(`[data-direction="${direction}"]`);
    
    if (statusElement) {
        statusElement.className = `upload-status ${status}`;
        
        switch(status) {
            case 'uploading':
                statusElement.textContent = 'Uploading...';
                break;
            case 'analyzing':
                statusElement.textContent = 'Analyzing...';
                break;
            case 'completed':
                statusElement.textContent = 'Complete ✓';
                break;
            default:
                statusElement.textContent = 'Ready';
        }
    }
    
    if (laneUpload) {
        laneUpload.className = `lane-upload ${status}`;
    }
    
    updateProgressIndicator();
}

// Update Progress Indicator
function updateProgressIndicator() {
    const uploadedCount = Object.values(appState.uploadedImages).filter(img => img !== null).length;
    const progressPercentage = (uploadedCount / 4) * 100;
    
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.querySelector('.progress-text');
    const startButton = document.getElementById('start-analysis');
    
    if (progressFill) {
        progressFill.style.width = `${progressPercentage}%`;
    }
    
    if (progressText) {
        if (uploadedCount === 0) {
            progressText.textContent = 'Upload images for all 4 lanes to start analysis';
        } else if (uploadedCount < 4) {
            progressText.textContent = `${uploadedCount}/4 lanes uploaded. ${4 - uploadedCount} remaining.`;
        } else {
            progressText.textContent = 'All lanes uploaded! Ready for signal optimization.';
        }
    }
    
    if (startButton) {
        startButton.disabled = uploadedCount < 4;
        if (uploadedCount === 4) {
            startButton.classList.add('pulse');
        } else {
            startButton.classList.remove('pulse');
        }
    }
}

// Check if All Lanes Analyzed
function checkAllLanesAnalyzed() {
    const analyzedCount = Object.values(appState.vehicleCounts)
        .filter(counts => counts.a + counts.b + counts.c > 0).length;
    
    if (analyzedCount === 4) {
        console.log('All lanes analyzed! Enabling optimization...');
        const startButton = document.getElementById('start-analysis');
        if (startButton) {
            startButton.disabled = false;
            startButton.classList.add('pulse');
        }
        
        showNotification('All lanes analyzed successfully! Click "Start Signal Optimization" to proceed.', 'success');
    }
}

// Initialize Buttons
function initializeButtons() {
    const startButton = document.getElementById('start-analysis');
    const resetButton = document.getElementById('reset-analysis');
    
    if (startButton) {
        startButton.addEventListener('click', startSignalOptimization);
    }
    
    if (resetButton) {
        resetButton.addEventListener('click', resetAnalysis);
    }
    
    // Export buttons
    const exportButtons = ['export-pdf', 'export-json', 'share-results'];
    exportButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', () => {
                const action = buttonId.split('-')[1] || buttonId.split('-')[0];
                handleExport(action);
            });
        }
    });
}

// Start Signal Optimization
function startSignalOptimization() {
    console.log('Starting signal optimization...');
    
    showLoadingOverlay('Calculating optimal signal timing...');
    
    setTimeout(() => {
        // Calculate optimal signal timing
        const timing = calculateOptimalSignalTiming();
        appState.signalTiming = timing;
        
        // Update results display
        displayOptimizationResults(timing);
        
        // Show results and export sections
        showSection('results-section');
        showSection('export-section');
        
        // Create distribution chart
        createDistributionChart();
        
        hideLoadingOverlay();
        
        showNotification('Signal optimization complete! View results and start simulation below.', 'success');
        
        // Scroll to results
        document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
        
    }, 3000);
}

// Calculate Optimal Signal Timing
function calculateOptimalSignalTiming() {
    console.log('Calculating optimal signal timing based on vehicle counts...');
    
    const timing = {};
    let totalWeight = 0;
    
    // Calculate total weight
    Object.keys(appState.vehicleCounts).forEach(direction => {
        const counts = appState.vehicleCounts[direction];
        const weight = (counts.a * TRAFFIC_CONFIG.vehicleWeights.twoWheeler) + 
                      (counts.b * TRAFFIC_CONFIG.vehicleWeights.fourWheeler) + 
                      (counts.c * TRAFFIC_CONFIG.vehicleWeights.heavyVehicle);
        totalWeight += weight;
    });
    
    // If no images uploaded, use default values
    if (totalWeight === 0) {
        return {
            north: 30,
            east: 25,
            south: 35,
            west: 28
        };
    }
    
    // Calculate proportional timing for each direction
    Object.keys(appState.vehicleCounts).forEach(direction => {
        const counts = appState.vehicleCounts[direction];
        const weight = (counts.a * TRAFFIC_CONFIG.vehicleWeights.twoWheeler) + 
                      (counts.b * TRAFFIC_CONFIG.vehicleWeights.fourWheeler) + 
                      (counts.c * TRAFFIC_CONFIG.vehicleWeights.heavyVehicle);
        
        // Calculate proportional time within min/max bounds
        const proportionalTime = totalWeight > 0 ? (weight / totalWeight) * 60 : 15;
        const baseTime = TRAFFIC_CONFIG.baseSignalTiming.minimumGreen;
        const calculatedTime = baseTime + proportionalTime;
        
        timing[direction] = Math.min(
            TRAFFIC_CONFIG.baseSignalTiming.maximumGreen,
            Math.max(TRAFFIC_CONFIG.baseSignalTiming.minimumGreen, Math.floor(calculatedTime))
        );
    });
    
    console.log('Calculated timing:', timing);
    return timing;
}

// Display Optimization Results
function displayOptimizationResults(timing) {
    // Calculate summary statistics
    const totalVehicles = Object.values(appState.vehicleCounts)
        .reduce((sum, counts) => sum + counts.a + counts.b + counts.c, 0);
    
    const totalCycleTime = Object.values(timing).reduce((sum, time) => sum + time, 0) + 
                          (TRAFFIC_CONFIG.baseSignalTiming.yellowDuration + 
                           TRAFFIC_CONFIG.baseSignalTiming.allRedClearance) * 4;
    
    const congestionLevel = getCongestionLevel(totalVehicles);
    const efficiencyScore = calculateEfficiencyScore(timing, appState.vehicleCounts);
    
    // Update summary display
    const elements = {
        totalVehicles: document.getElementById('total-vehicles'),
        congestionLevel: document.getElementById('congestion-level'),
        cycleTime: document.getElementById('cycle-time'),
        efficiencyScore: document.getElementById('efficiency-score')
    };
    
    if (elements.totalVehicles) elements.totalVehicles.textContent = totalVehicles || 'Demo';
    if (elements.congestionLevel) elements.congestionLevel.textContent = congestionLevel;
    if (elements.cycleTime) elements.cycleTime.textContent = `${totalCycleTime}s`;
    if (elements.efficiencyScore) elements.efficiencyScore.textContent = `${efficiencyScore}%`;
    
    // Update timing display
    Object.keys(timing).forEach(direction => {
        const element = document.getElementById(`timing-${direction}`);
        if (element) element.textContent = `${timing[direction]} sec`;
    });
    
    // Apply color coding based on congestion level
    const congestionElement = document.getElementById('congestion-level');
    if (congestionElement) {
        congestionElement.className = `stat-value ${congestionLevel.toLowerCase()}`;
    }
}

// Get Congestion Level
function getCongestionLevel(totalVehicles) {
    if (totalVehicles <= TRAFFIC_CONFIG.congestionThresholds.low) return 'Low';
    if (totalVehicles <= TRAFFIC_CONFIG.congestionThresholds.moderate) return 'Moderate';
    return 'Heavy';
}

// Calculate Efficiency Score
function calculateEfficiencyScore(timing, vehicleCounts) {
    // Complex efficiency calculation considering vehicle wait times
    let totalWaitTime = 0;
    let totalVehicles = 0;
    
    Object.keys(timing).forEach(direction => {
        const counts = vehicleCounts[direction];
        const directionVehicles = counts.a + counts.b + counts.c;
        const averageWaitTime = timing[direction] * 0.5; // Simplified calculation
        
        totalWaitTime += directionVehicles * averageWaitTime;
        totalVehicles += directionVehicles;
    });
    
    const averageWaitTime = totalVehicles > 0 ? totalWaitTime / totalVehicles : 30;
    const baselineWaitTime = 45; // Baseline wait time for comparison
    
    const efficiency = Math.max(0, Math.min(100, 
        100 - ((averageWaitTime / baselineWaitTime) * 100)));
    
    return Math.floor(efficiency) || 85; // Default for demo
}

// Create Distribution Chart
function createDistributionChart() {
    const ctx = document.getElementById('distribution-chart');
    if (!ctx) return;
    
    if (appState.distributionChart) {
        appState.distributionChart.destroy();
    }
    
    const directions = ['North', 'East', 'South', 'West'];
    const twoWheelerData = Object.values(appState.vehicleCounts).map(counts => counts.a);
    const fourWheelerData = Object.values(appState.vehicleCounts).map(counts => counts.b);
    const heavyVehicleData = Object.values(appState.vehicleCounts).map(counts => counts.c);
    
    // Use demo data if no real data
    const hasRealData = twoWheelerData.some(val => val > 0);
    if (!hasRealData) {
        twoWheelerData.splice(0, 4, 25, 18, 32, 21);
        fourWheelerData.splice(0, 4, 15, 12, 18, 14);
        heavyVehicleData.splice(0, 4, 4, 3, 6, 2);
    }
    
    appState.distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: directions,
            datasets: [
                {
                    label: 'Two-wheelers (a)',
                    data: twoWheelerData,
                    backgroundColor: '#1FB8CD',
                    borderColor: '#1FB8CD',
                    borderWidth: 2
                },
                {
                    label: 'Four-wheelers (b)',
                    data: fourWheelerData,
                    backgroundColor: '#FFC185',
                    borderColor: '#FFC185',
                    borderWidth: 2
                },
                {
                    label: 'Heavy vehicles (c)',
                    data: heavyVehicleData,
                    backgroundColor: '#B4413C',
                    borderColor: '#B4413C',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                },
                title: {
                    display: true,
                    text: 'Vehicle Distribution Across All Lanes'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Vehicle Count'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Lane Direction'
                    }
                }
            }
        }
    });
}

// Initialize Simulator Controls
function initializeSimulatorControls() {
    const startSimButton = document.getElementById('start-simulation');
    const pauseSimButton = document.getElementById('pause-simulation');
    const resetSimButton = document.getElementById('reset-simulation');
    
    if (startSimButton) {
        startSimButton.addEventListener('click', startJunctionSimulation);
    }
    
    if (pauseSimButton) {
        pauseSimButton.addEventListener('click', pauseJunctionSimulation);
    }
    
    if (resetSimButton) {
        resetSimButton.addEventListener('click', resetJunctionSimulation);
    }
}

// Start Junction Simulation
function startJunctionSimulation() {
    console.log('Starting junction simulation...');
    
    if (appState.simulationActive) {
        showNotification('Simulation is already running', 'warning');
        return;
    }
    
    appState.simulationActive = true;
    appState.cycleStartTime = Date.now();
    
    // Start traffic light cycle
    startTrafficLightCycle();
    
    showNotification('Junction simulation started!', 'success');
}

// Start Traffic Light Cycle
function startTrafficLightCycle() {
    let currentPhaseIndex = 0;
    const phases = TRAFFIC_CONFIG.phaseSequence;
    
    function runPhase() {
        if (!appState.simulationActive) return;
        
        const currentPhase = phases[currentPhaseIndex];
        const phaseTime = appState.signalTiming[currentPhase];
        
        console.log(`Starting ${currentPhase} phase for ${phaseTime} seconds`);
        
        // Update current phase display
        const currentPhaseElement = document.getElementById('current-phase');
        const nextPhaseElement = document.getElementById('next-phase');
        
        if (currentPhaseElement) {
            currentPhaseElement.textContent = currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1);
        }
        
        if (nextPhaseElement) {
            const nextPhase = phases[(currentPhaseIndex + 1) % phases.length];
            nextPhaseElement.textContent = nextPhase.charAt(0).toUpperCase() + nextPhase.slice(1);
        }
        
        // Set all lights to red first
        phases.forEach(direction => {
            setTrafficLight(direction, 'red');
            const timer = document.getElementById(`timer-${direction}`);
            if (timer) timer.textContent = '--';
        });
        
        // Set current phase to green after red clearance
        setTimeout(() => {
            if (!appState.simulationActive) return;
            
            setTrafficLight(currentPhase, 'green');
            setActiveApproach(currentPhase);
            
            // Start countdown timer
            startPhaseTimer(currentPhase, phaseTime);
            
            // Handle pedestrian crossing
            setPedestrianCrossing(currentPhase === 'north' || currentPhase === 'south');
            
        }, TRAFFIC_CONFIG.baseSignalTiming.allRedClearance * 1000);
        
        // Schedule yellow phase
        setTimeout(() => {
            if (!appState.simulationActive) return;
            setTrafficLight(currentPhase, 'yellow');
        }, (phaseTime - TRAFFIC_CONFIG.baseSignalTiming.yellowDuration) * 1000);
        
        // Schedule next phase
        setTimeout(() => {
            if (!appState.simulationActive) return;
            
            setTrafficLight(currentPhase, 'red');
            removeActiveApproach(currentPhase);
            
            // Move to next phase
            currentPhaseIndex = (currentPhaseIndex + 1) % phases.length;
            
            // Update cycle progress
            const cycleProgress = ((currentPhaseIndex / phases.length) * 100).toFixed(0);
            const progressElement = document.getElementById('cycle-progress');
            if (progressElement) progressElement.textContent = `${cycleProgress}%`;
            
            // Continue with next phase
            setTimeout(runPhase, TRAFFIC_CONFIG.baseSignalTiming.allRedClearance * 1000);
            
        }, phaseTime * 1000);
    }
    
    runPhase();
}

// Set Traffic Light
function setTrafficLight(direction, color) {
    const lightElement = document.getElementById(`light-${direction}`);
    if (!lightElement) return;
    
    // Remove active class from all lights
    lightElement.querySelectorAll('.light').forEach(light => {
        light.classList.remove('active');
    });
    
    // Add active class to specified color
    const colorLight = lightElement.querySelector(`.${color}`);
    if (colorLight) {
        colorLight.classList.add('active');
    }
}

// Set Active Approach
function setActiveApproach(direction) {
    // Remove active class from all approaches
    document.querySelectorAll('.approach').forEach(approach => {
        approach.classList.remove('active');
    });
    
    // Add active class to current approach
    const approach = document.querySelector(`.approach.${direction}`);
    if (approach) {
        approach.classList.add('active');
    }
}

// Remove Active Approach
function removeActiveApproach(direction) {
    const approach = document.querySelector(`.approach.${direction}`);
    if (approach) {
        approach.classList.remove('active');
    }
}

// Start Phase Timer
function startPhaseTimer(direction, duration) {
    let remainingTime = duration;
    const timerElement = document.getElementById(`timer-${direction}`);
    
    const timer = setInterval(() => {
        if (!appState.simulationActive || remainingTime <= 0) {
            clearInterval(timer);
            return;
        }
        
        if (timerElement) {
            timerElement.textContent = `${remainingTime}s`;
        }
        remainingTime--;
    }, 1000);
}

// Set Pedestrian Crossing
function setPedestrianCrossing(active) {
    const pedLight = document.getElementById('ped-light');
    if (pedLight) {
        pedLight.classList.toggle('active', active);
        pedLight.textContent = active ? '🚶‍♂️' : '🛑';
    }
}

// Update Performance Metrics
function updatePerformanceMetrics() {
    // Simulate performance improvements
    const metrics = {
        congestionReduction: '35%',
        avgWaitTime: '45s',
        junctionEfficiency: '92%',
        co2Emissions: '-28%'
    };
    
    setTimeout(() => {
        const elements = {
            congestionReduction: document.getElementById('congestion-reduction'),
            avgWaitTime: document.getElementById('avg-wait-time'),
            junctionEfficiency: document.getElementById('junction-efficiency'),
            co2Emissions: document.getElementById('co2-emissions')
        };
        
        if (elements.congestionReduction) elements.congestionReduction.textContent = metrics.congestionReduction;
        if (elements.avgWaitTime) elements.avgWaitTime.textContent = metrics.avgWaitTime;
        if (elements.junctionEfficiency) elements.junctionEfficiency.textContent = metrics.junctionEfficiency;
        if (elements.co2Emissions) elements.co2Emissions.textContent = metrics.co2Emissions;
    }, 1000);
}

// Pause Junction Simulation
function pauseJunctionSimulation() {
    appState.simulationActive = false;
    showNotification('Simulation paused', 'info');
}

// Reset Junction Simulation
function resetJunctionSimulation() {
    appState.simulationActive = false;
    appState.cycleStartTime = null;
    
    // Reset all traffic lights to red
    TRAFFIC_CONFIG.phaseSequence.forEach(direction => {
        setTrafficLight(direction, 'red');
        removeActiveApproach(direction);
        const timer = document.getElementById(`timer-${direction}`);
        if (timer) timer.textContent = '--';
    });
    
    // Reset simulation info
    const elements = {
        currentPhase: document.getElementById('current-phase'),
        cycleProgress: document.getElementById('cycle-progress'),
        nextPhase: document.getElementById('next-phase')
    };
    
    if (elements.currentPhase) elements.currentPhase.textContent = 'Initialization';
    if (elements.cycleProgress) elements.cycleProgress.textContent = '0%';
    if (elements.nextPhase) elements.nextPhase.textContent = '--';
    
    // Reset pedestrian crossing
    setPedestrianCrossing(false);
    
    showNotification('Simulation reset', 'info');
}

// Reset Analysis
function resetAnalysis() {
    console.log('Resetting analysis...');
    
    // Reset application state
    appState.uploadedImages = { north: null, east: null, south: null, west: null };
    appState.vehicleCounts = { 
        north: { a: 0, b: 0, c: 0 }, 
        east: { a: 0, b: 0, c: 0 }, 
        south: { a: 0, b: 0, c: 0 }, 
        west: { a: 0, b: 0, c: 0 } 
    };
    
    // Reset UI for all directions
    const directions = ['north', 'east', 'south', 'west'];
    directions.forEach(direction => {
        // Reset file inputs
        const fileInput = document.getElementById(`file-${direction}`);
        if (fileInput) fileInput.value = '';
        
        // Reset status
        updateUploadStatus(direction, 'ready');
        
        // Reset preview
        const preview = document.getElementById(`preview-${direction}`);
        if (preview) {
            preview.innerHTML = '';
            preview.classList.remove('active');
        }
        
        // Reset counts
        ['a', 'b', 'c'].forEach(type => {
            const countElement = document.getElementById(`count-${direction}-${type}`);
            if (countElement) countElement.textContent = '--';
        });
    });
    
    // Reset progress
    updateProgressIndicator();
    
    // Hide sections
    hideSection('results-section');
    hideSection('export-section');
    
    // Destroy chart
    if (appState.distributionChart) {
        appState.distributionChart.destroy();
        appState.distributionChart = null;
    }
    
    // Reset simulation
    resetJunctionSimulation();
    
    showNotification('Analysis reset successfully. Upload new images to start again.', 'info');
    
    // Scroll to top
    document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth' });
}

// Export Handlers
function handleExport(type) {
    switch(type) {
        case 'pdf':
        case 'export':
            exportPDFReport();
            break;
        case 'json':
            exportJSONData();
            break;
        case 'share':
        case 'results':
            shareResults();
            break;
        default:
            console.warn('Unknown export type:', type);
    }
}

// Export PDF Report
function exportPDFReport() {
    showLoadingOverlay('Generating PDF report...');
    
    setTimeout(() => {
        const reportData = generateReportData();
        
        // Simulate PDF generation
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `traffic_analysis_report_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        hideLoadingOverlay();
        showNotification('Report exported successfully!', 'success');
    }, 2000);
}

// Export JSON Data
function exportJSONData() {
    const data = {
        analysisDate: new Date().toISOString(),
        vehicleCounts: appState.vehicleCounts,
        signalTiming: appState.signalTiming,
        configuration: TRAFFIC_CONFIG,
        summary: {
            totalVehicles: Object.values(appState.vehicleCounts).reduce((sum, counts) => sum + counts.a + counts.b + counts.c, 0),
            totalCycleTime: Object.values(appState.signalTiming).reduce((sum, time) => sum + time, 0),
            congestionLevel: getCongestionLevel(Object.values(appState.vehicleCounts).reduce((sum, counts) => sum + counts.a + counts.b + counts.c, 0))
        }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traffic_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Data exported successfully!', 'success');
}

// Share Results
function shareResults() {
    const totalVehicles = Object.values(appState.vehicleCounts).reduce((sum, counts) => sum + counts.a + counts.b + counts.c, 0);
    const shareText = `Smart Junction AI Analysis Results:\n\n🚦 Total Vehicles: ${totalVehicles || 'Demo Mode'}\n🔄 Optimized Cycle Time: ${Object.values(appState.signalTiming).reduce((sum, time) => sum + time, 0)}s\n📊 Congestion Level: ${getCongestionLevel(totalVehicles)}\n\nGenerated by Smart Junction AI - Intelligent Traffic Signal Optimization`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Smart Junction AI Analysis Results',
            text: shareText
        }).then(() => {
            showNotification('Results shared successfully!', 'success');
        }).catch(() => {
            fallbackShare(shareText);
        });
    } else {
        fallbackShare(shareText);
    }
}

// Fallback Share
function fallbackShare(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Results copied to clipboard!', 'success');
        }).catch(() => {
            showNotification('Unable to copy to clipboard', 'warning');
        });
    } else {
        showNotification('Sharing not supported on this device', 'warning');
    }
}

// Generate Report Data
function generateReportData() {
    const totalVehicles = Object.values(appState.vehicleCounts).reduce((sum, counts) => sum + counts.a + counts.b + counts.c, 0);
    const totalCycleTime = Object.values(appState.signalTiming).reduce((sum, time) => sum + time, 0);
    
    return {
        title: 'Smart Junction AI - Traffic Analysis Report',
        date: new Date().toISOString(),
        location: 'AI Optimized 4-Lane Junction',
        summary: {
            totalVehicles: totalVehicles || 'Demo Mode',
            congestionLevel: getCongestionLevel(totalVehicles),
            totalCycleTime: `${totalCycleTime}s`,
            efficiencyScore: calculateEfficiencyScore(appState.signalTiming, appState.vehicleCounts)
        },
        vehicleDetection: appState.vehicleCounts,
        signalOptimization: {
            north: `${appState.signalTiming.north}s`,
            east: `${appState.signalTiming.east}s`,
            south: `${appState.signalTiming.south}s`,
            west: `${appState.signalTiming.west}s`
        },
        recommendations: [
            'Signal timing optimized based on actual vehicle counts',
            'Anti-clockwise phase sequence for optimal flow',
            'Variable timing adapts to traffic density',
            'Monitor and adjust during peak hours'
        ]
    };
}

// Utility Functions
function showSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }
}

function hideSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'none';
    }
}

function showLoadingOverlay(message) {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    
    if (text) text.textContent = message;
    if (overlay) overlay.classList.add('active');
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 18px;">${icons[type] || icons.info}</span>
            <span>${message}</span>
        </div>
    `;
    
    // Style notification
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: var(--glass-bg);
        border: 2px solid ${getNotificationColor(type)};
        border-radius: 12px;
        padding: 16px 20px;
        backdrop-filter: blur(20px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        max-width: 400px;
        font-weight: 500;
        color: var(--tech-gray);
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 4000);
}

function getNotificationColor(type) {
    switch(type) {
        case 'success': return '#21BF73';
        case 'error': return '#D7263D';
        case 'warning': return '#FFD23F';
        default: return '#FFD23F';
    }
}

// Error handling
window.addEventListener('error', function(e) {
    console.error('Application error:', e.error);
    showNotification('An error occurred. Please refresh and try again.', 'error');
});

// Log startup
console.log('Smart Junction AI - System Ready!');