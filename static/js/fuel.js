// Application data
const appData = {
    pumps: [
        {"id": "01", "name": "Petrol Pump 01", "address": "MG Road, Pune", "coordinates": {"lat": 18.5314, "lng": 73.8446}},
        {"id": "02", "name": "Petrol Pump 02", "address": "FC Road, Pune", "coordinates": {"lat": 18.5089, "lng": 73.8350}}
    ],
    vehicleTypes: ["Two Wheelers", "Four Wheelers", "Heavy Vehicles"],
    maxFileSize: 10485760, // 10MB
    acceptedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    analysisDelay: 2000,
    colors: ["#1FB8CD", "#FFC185", "#B4413C", "#22C55E", "#FFD23F"]
};

// Application state
let uploadedImages = {
    "01": null,
    "02": null
};

let analysisResults = {
    "01": null,
    "02": null
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Petrol Pump Analyzer...');
    initializeUploadHandlers();
    initializeEventHandlers();
    showNotification('Application ready! Click upload areas to add images.', 'success');
});

// Initialize upload handlers
function initializeUploadHandlers() {
    console.log('Setting up upload handlers...');
    
    // Setup for both pumps
    ['01', '02'].forEach(pumpId => {
        const fileInput = document.getElementById(`file-${pumpId}`);
        const uploadArea = document.getElementById(`upload-${pumpId}`);
        const removeBtn = document.getElementById(`remove-${pumpId}`);

        if (!fileInput || !uploadArea) {
            console.error(`Missing elements for pump ${pumpId}`);
            return;
        }

        console.log(`Setting up upload for pump ${pumpId}`);

        // File input change handler - this should work with the label
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            console.log(`File selected for pump ${pumpId}:`, file?.name);
            
            if (file) {
                handleFileUpload(file, pumpId);
            }
        });

        // Drag and drop handlers for the upload area
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
            console.log(`Drag over pump ${pumpId}`);
        });

        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                console.log(`File dropped for pump ${pumpId}:`, files[0].name);
                // Set the file to the input and trigger change
                const dt = new DataTransfer();
                dt.items.add(files[0]);
                fileInput.files = dt.files;
                handleFileUpload(files[0], pumpId);
            }
        });

        // Remove button handler
        if (removeBtn) {
            removeBtn.addEventListener('click', function(e) {
                console.log(`Remove button clicked for pump ${pumpId}`);
                e.preventDefault();
                e.stopPropagation();
                removeImage(pumpId);
            });
        }

        console.log(`Upload handlers set up successfully for pump ${pumpId}`);
    });
}

// Initialize other event handlers
function initializeEventHandlers() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const navigateBtn = document.getElementById('navigateBtn');
    const newAnalysisBtn = document.getElementById('newAnalysisBtn');

    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', startAnalysis);
    }

    if (navigateBtn) {
        navigateBtn.addEventListener('click', navigateToOptimalPump);
    }

    if (newAnalysisBtn) {
        newAnalysisBtn.addEventListener('click', resetApplication);
    }
}

// Handle file upload
function handleFileUpload(file, pumpId) {
    console.log(`Processing file for pump ${pumpId}:`, file.name, file.size, file.type);

    // Validate file type
    if (!appData.acceptedTypes.includes(file.type)) {
        showNotification('Please upload a valid image file (JPEG, PNG, WebP)', 'error');
        return;
    }

    // Validate file size
    if (file.size > appData.maxFileSize) {
        showNotification('File size must be less than 10MB', 'error');
        return;
    }

    showNotification(`Loading image for Petrol Pump ${pumpId}...`, 'success');

    // Read and display image
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log(`Image loaded successfully for pump ${pumpId}`);
        displayImagePreview(e.target.result, pumpId);
        uploadedImages[pumpId] = e.target.result;
        updatePumpStatus(pumpId, 'uploaded');
        checkAnalyzeButton();
        showNotification(`Image uploaded successfully for Petrol Pump ${pumpId}!`, 'success');
    };

    reader.onerror = function() {
        console.error(`Error reading file for pump ${pumpId}`);
        showNotification('Error reading file. Please try again.', 'error');
    };

    reader.readAsDataURL(file);
}

// Display image preview
function displayImagePreview(imageSrc, pumpId) {
    console.log(`Displaying image preview for pump ${pumpId}`);
    
    const uploadArea = document.getElementById(`upload-${pumpId}`);
    const preview = document.getElementById(`preview-${pumpId}`);
    const image = document.getElementById(`image-${pumpId}`);

    if (uploadArea && preview && image) {
        uploadArea.style.display = 'none';
        image.src = imageSrc;
        preview.style.display = 'block';

        // Update pump card appearance
        const pumpCard = uploadArea.closest('.pump-card');
        if (pumpCard) {
            pumpCard.classList.add('uploaded');
        }
        console.log(`Image preview displayed successfully for pump ${pumpId}`);
    }
}

// Remove image
function removeImage(pumpId) {
    console.log(`Removing image for pump ${pumpId}`);

    const uploadArea = document.getElementById(`upload-${pumpId}`);
    const preview = document.getElementById(`preview-${pumpId}`);
    const fileInput = document.getElementById(`file-${pumpId}`);
    const results = document.getElementById(`results-${pumpId}`);

    // Reset UI elements
    if (uploadArea) uploadArea.style.display = 'block';
    if (preview) preview.style.display = 'none';
    if (results) results.style.display = 'none';
    if (fileInput) fileInput.value = '';

    // Reset data
    uploadedImages[pumpId] = null;
    analysisResults[pumpId] = null;

    // Update pump card appearance
    const pumpCard = uploadArea?.closest('.pump-card');
    if (pumpCard) {
        pumpCard.classList.remove('uploaded', 'analyzed');
    }

    // Update status
    updatePumpStatus(pumpId, 'ready');
    checkAnalyzeButton();
    hideComparisonSection();

    showNotification(`Image removed for Petrol Pump ${pumpId}`, 'success');
}

// Update pump status
function updatePumpStatus(pumpId, status) {
    const statusElement = document.getElementById(`status-${pumpId}`);
    if (!statusElement) return;

    switch (status) {
        case 'ready':
            statusElement.textContent = 'Ready to Upload';
            statusElement.className = 'status status--info';
            break;
        case 'uploaded':
            statusElement.textContent = 'Image Uploaded ✓';
            statusElement.className = 'status status--success';
            break;
        case 'analyzing':
            statusElement.textContent = 'Analyzing...';
            statusElement.className = 'status status--warning';
            break;
        case 'analyzed':
            statusElement.textContent = 'Analysis Complete ✓';
            statusElement.className = 'status status--success';
            break;
    }
}

// Check if analyze button should be shown
function checkAnalyzeButton() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const hasAllImages = uploadedImages['01'] && uploadedImages['02'];
    
    console.log('Checking analyze button visibility:', hasAllImages);

    if (analyzeBtn) {
        if (hasAllImages) {
            analyzeBtn.classList.remove('hidden');
            showNotification('Both images uploaded! Click "Analyze Both Pumps" to start.', 'success');
        } else {
            analyzeBtn.classList.add('hidden');
        }
    }
}

// Start analysis
function startAnalysis() {
    console.log('Starting analysis...');

    // Show loading modal
    const loadingModal = document.getElementById('loadingModal');
    if (loadingModal) {
        loadingModal.classList.remove('hidden');
    }

    // Update pump statuses
    updatePumpStatus('01', 'analyzing');
    updatePumpStatus('02', 'analyzing');

    // Hide analyze button
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.classList.add('hidden');
    }

    showNotification('AI analysis started for both pumps...', 'success');

    // Simulate analysis delay
    setTimeout(() => {
        performAnalysis();
        
        // Hide loading modal
        if (loadingModal) {
            loadingModal.classList.add('hidden');
        }

        showNotification('Analysis complete! Scroll down to see comparison results.', 'success');
    }, appData.analysisDelay);
}

// Perform mock analysis
function performAnalysis() {
    console.log('Performing analysis...');

    // Generate mock results for both pumps
    ['01', '02'].forEach(pumpId => {
        analysisResults[pumpId] = generateMockAnalysis();
        displayAnalysisResults(pumpId);
        updatePumpStatus(pumpId, 'analyzed');

        // Update pump card appearance
        const uploadArea = document.getElementById(`upload-${pumpId}`);
        const pumpCard = uploadArea?.closest('.pump-card');
        if (pumpCard) {
            pumpCard.classList.add('analyzed');
        }
    });

    // Show comparison
    showComparisonSection();
}

// Generate mock YOLO analysis
function generateMockAnalysis() {
    const twoWheelers = Math.floor(Math.random() * 8) + 1; // 1-8
    const fourWheelers = Math.floor(Math.random() * 6) + 1; // 1-6
    const heavyVehicles = Math.floor(Math.random() * 3); // 0-2

    const totalVehicles = twoWheelers + fourWheelers + heavyVehicles;
    
    // Calculate wait time based on vehicle types
    const waitTime = Math.round(
        2 + (twoWheelers * 1.0 + fourWheelers * 1.5 + heavyVehicles * 3.0) * 1.2
    );

    // Calculate efficiency score
    const efficiency = Math.max(1, Math.min(10, 10 - (waitTime / Math.max(totalVehicles, 1)) * 2)).toFixed(1);

    return {
        vehicles: {
            twoWheelers,
            fourWheelers,
            heavyVehicles,
            total: totalVehicles
        },
        waitTime: Math.max(1, waitTime),
        efficiency: parseFloat(efficiency)
    };
}

// Display analysis results
function displayAnalysisResults(pumpId) {
    const result = analysisResults[pumpId];
    console.log(`Displaying results for pump ${pumpId}:`, result);

    // Update metrics
    const vehiclesEl = document.getElementById(`vehicles-${pumpId}`);
    const waitTimeEl = document.getElementById(`wait-time-${pumpId}`);
    const efficiencyEl = document.getElementById(`efficiency-${pumpId}`);
    const resultsEl = document.getElementById(`results-${pumpId}`);

    if (vehiclesEl) vehiclesEl.textContent = result.vehicles.total;
    if (waitTimeEl) waitTimeEl.textContent = `${result.waitTime} min`;
    if (efficiencyEl) efficiencyEl.textContent = `${result.efficiency}/10`;
    if (resultsEl) resultsEl.style.display = 'block';
}

// Show comparison section
function showComparisonSection() {
    const comparisonSection = document.getElementById('comparisonSection');
    if (!comparisonSection) return;

    comparisonSection.classList.remove('hidden');
    
    // Generate comparison
    generateComparison();

    // Smooth scroll to comparison
    setTimeout(() => {
        comparisonSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
}

// Hide comparison section
function hideComparisonSection() {
    const comparisonSection = document.getElementById('comparisonSection');
    if (comparisonSection) {
        comparisonSection.classList.add('hidden');
    }
}

// Generate comparison
function generateComparison() {
    const result01 = analysisResults['01'];
    const result02 = analysisResults['02'];

    if (!result01 || !result02) return;

    console.log('Generating comparison:', result01, result02);

    // Determine winner (lower wait time wins)
    const winner = result01.waitTime <= result02.waitTime ? '01' : '02';
    const timeDiff = Math.abs(result01.waitTime - result02.waitTime);

    // Update winner announcement
    const winnerAnnouncement = document.getElementById('winnerAnnouncement');
    if (winnerAnnouncement) {
        const winnerName = winner === '01' ? 'Petrol Pump 01 (MG Road)' : 'Petrol Pump 02 (FC Road)';
        winnerAnnouncement.textContent = timeDiff > 0 ? 
            `🏆 ${winnerName} is faster by ${timeDiff} minutes!` : 
            '🏆 Both pumps have similar wait times!';
    }

    // Update optimal choice
    const optimalChoice = document.getElementById('optimalChoice');
    if (optimalChoice) {
        const optimalPump = appData.pumps.find(p => p.id === winner);
        const optimalResult = winner === '01' ? result01 : result02;
        optimalChoice.innerHTML = `
            <strong>🎯 Optimal Choice: ${optimalPump.name}</strong><br>
            <span style="color: var(--color-text-secondary);">${optimalPump.address}</span><br>
            <span style="color: var(--color-primary); font-weight: bold;">⏱️ Wait Time: ${optimalResult.waitTime} minutes | 🚗 Vehicles: ${optimalResult.vehicles.total}</span>
        `;
    }

    // Generate charts
    generateCharts();
}

// Generate charts
function generateCharts() {
    const result01 = analysisResults['01'];
    const result02 = analysisResults['02'];

    // Wait Time Chart
    const waitTimeCanvas = document.getElementById('waitTimeChart');
    if (waitTimeCanvas) {
        const ctx = waitTimeCanvas.getContext('2d');
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Petrol Pump 01\n(MG Road)', 'Petrol Pump 02\n(FC Road)'],
                datasets: [{
                    label: 'Wait Time (minutes)',
                    data: [result01.waitTime, result02.waitTime],
                    backgroundColor: [
                        result01.waitTime <= result02.waitTime ? appData.colors[0] : appData.colors[2],
                        result02.waitTime <= result01.waitTime ? appData.colors[0] : appData.colors[2]
                    ],
                    borderWidth: 0,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} minutes wait time`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Wait Time (Minutes)',
                            font: {
                                weight: 'bold'
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Petrol Pumps',
                            font: {
                                weight: 'bold'
                            }
                        }
                    }
                }
            }
        });
    }

    // Vehicle Distribution Chart
    const vehicleCanvas = document.getElementById('vehicleChart');
    if (vehicleCanvas) {
        const ctx = vehicleCanvas.getContext('2d');
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [
                    'Pump 01 - Two Wheelers', 'Pump 01 - Four Wheelers', 'Pump 01 - Heavy Vehicles',
                    'Pump 02 - Two Wheelers', 'Pump 02 - Four Wheelers', 'Pump 02 - Heavy Vehicles'
                ],
                datasets: [{
                    data: [
                        result01.vehicles.twoWheelers, result01.vehicles.fourWheelers, result01.vehicles.heavyVehicles,
                        result02.vehicles.twoWheelers, result02.vehicles.fourWheelers, result02.vehicles.heavyVehicles
                    ],
                    backgroundColor: appData.colors,
                    borderWidth: 2,
                    borderColor: 'rgba(255, 255, 255, 0.8)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            font: {
                                size: 10
                            },
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed} vehicles`;
                            }
                        }
                    }
                }
            }
        });
    }
}

// Navigate to optimal pump
function navigateToOptimalPump() {
    const result01 = analysisResults['01'];
    const result02 = analysisResults['02'];
    
    if (!result01 || !result02) return;

    // Determine optimal pump
    const optimalPumpId = result01.waitTime <= result02.waitTime ? '01' : '02';
    const optimalPump = appData.pumps.find(p => p.id === optimalPumpId);
    
    if (optimalPump) {
        // Open Google Maps with directions
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${optimalPump.coordinates.lat},${optimalPump.coordinates.lng}&travelmode=driving`;
        window.open(mapsUrl, '_blank');
        
        showNotification(`🧭 Opening Google Maps directions to ${optimalPump.name}`, 'success');
    }
}

// Reset application
function resetApplication() {
    console.log('Resetting application...');

    // Remove all images
    removeImage('01');
    removeImage('02');

    // Hide comparison section
    hideComparisonSection();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    showNotification('🔄 Application reset successfully! Ready for new analysis.', 'success');
}

// Show notification
function showNotification(message, type = 'success') {
    console.log(`Notification: ${message} (${type})`);
    
    const notification = document.getElementById('notification');
    const messageElement = notification?.querySelector('.notification-message');
    
    if (!notification || !messageElement) return;
    
    messageElement.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    // Hide after 4 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}