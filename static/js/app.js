// Route Risk Analysis JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('Route Risk Analysis app loaded');
    
    // Initialize form handling
    initializeFormHandling();
    
    // Initialize map if on map view
    if (document.getElementById('map')) {
        initializeMap();
    }
    
    // Initialize timeline controls
    initializeTimelineControls();
    
    // Update timestamps
    updateTimestamp();
});

function initializeFormHandling() {
    const form = document.querySelector('form[action*="analyze_route"]');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const origin = formData.get('origin');
        const destination = formData.get('destination');
        
        if (!origin || !destination) {
            alert('Please enter both origin and destination');
            return;
        }
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
        
        // Simulate route analysis (replace with actual API call)
        setTimeout(() => {
            // Hide form view and show map view
            document.getElementById('home-view').classList.remove('active');
            document.getElementById('map-view').classList.add('active');
            
            // Update route display
            document.getElementById('route-display').textContent = `Route: ${origin} → ${destination}`;
            
            // Reset button state
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
            
            // Initialize map with route data
            if (window.map) {
                displayRouteOnMap(origin, destination);
            }
        }, 2000);
    });
    
    // Back button handling
    const backBtn = document.getElementById('back-home');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            document.getElementById('map-view').classList.remove('active');
            document.getElementById('home-view').classList.add('active');
        });
    }
}

function initializeMap() {
    // Initialize Leaflet map
    window.map = L.map('map').setView([40.7128, -74.0060], 13); // Default to NYC
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(window.map);
    
    console.log('Map initialized');
}

function displayRouteOnMap(origin, destination) {
    if (!window.map) return;
    
    // This would typically geocode the addresses and display the route
    // For now, just add some example markers
    const originMarker = L.marker([40.7128, -74.0060]).addTo(window.map)
        .bindPopup(`Origin: ${origin}`);
    
    const destMarker = L.marker([40.7589, -73.9851]).addTo(window.map)
        .bindPopup(`Destination: ${destination}`);
    
    // Fit map to show both markers
    const group = new L.featureGroup([originMarker, destMarker]);
    window.map.fitBounds(group.getBounds().pad(0.1));
    
    // Simulate risk heatmap overlay
    addRiskHeatmap();
}

function addRiskHeatmap() {
    // Simulate adding risk visualization to the map
    // This would be replaced with actual risk data from the backend
    console.log('Adding risk heatmap visualization');
    
    // Update statistics with simulated data
    updateStatistics();
}

function updateStatistics() {
    // Update ETA values with simulated data
    document.getElementById('base-eta').textContent = '28 min';
    document.getElementById('eta-50th').textContent = '32 min';
    document.getElementById('eta-75th').textContent = '38 min';
    document.getElementById('eta-90th').textContent = '47 min';
    
    // Update segment count
    document.getElementById('segment-count').textContent = '12';
    
    console.log('Statistics updated');
}

function initializeTimelineControls() {
    const playBtn = document.getElementById('play-pause-btn');
    const slider = document.getElementById('timeline-slider');
    const minuteDisplay = document.getElementById('current-minute');
    
    if (!playBtn || !slider || !minuteDisplay) return;
    
    let isPlaying = false;
    let playInterval;
    
    playBtn.addEventListener('click', function() {
        isPlaying = !isPlaying;
        
        const playIcon = playBtn.querySelector('.play-icon');
        const pauseIcon = playBtn.querySelector('.pause-icon');
        
        if (isPlaying) {
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
            startTimelinePlayback();
        } else {
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
            stopTimelinePlayback();
        }
    });
    
    slider.addEventListener('input', function() {
        const minute = parseInt(slider.value);
        minuteDisplay.textContent = `Minute ${minute}`;
        updateMapForMinute(minute);
    });
    
    function startTimelinePlayback() {
        playInterval = setInterval(() => {
            let currentValue = parseInt(slider.value);
            if (currentValue >= 10) {
                currentValue = 0;
            } else {
                currentValue++;
            }
            
            slider.value = currentValue;
            minuteDisplay.textContent = `Minute ${currentValue}`;
            updateMapForMinute(currentValue);
        }, 1000);
    }
    
    function stopTimelinePlayback() {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    }
    
    function updateMapForMinute(minute) {
        // Update map visualization for specific minute
        console.log(`Updating map for minute ${minute}`);
        // This would update the risk heatmap based on time
    }
}

function updateTimestamp() {
    const timestampElement = document.getElementById('last-updated');
    if (timestampElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        timestampElement.textContent = timeString;
    }
    
    // Update every minute
    setTimeout(updateTimestamp, 60000);
}

// Tooltip handling
document.addEventListener('mousemove', function(e) {
    const tooltip = document.getElementById('risk-tooltip');
    if (!tooltip) return;
    
    // This would be triggered by map interactions
    // For now, just position the tooltip near the cursor
    if (!tooltip.classList.contains('hidden')) {
        tooltip.style.left = (e.pageX + 10) + 'px';
        tooltip.style.top = (e.pageY + 10) + 'px';
    }
});

// Export functions for external use
window.RouteRiskAnalysis = {
    initializeMap,
    displayRouteOnMap,
    updateStatistics,
    updateTimestamp
};
