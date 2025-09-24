import requests
import json
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect
from flask_socketio import SocketIO, emit
import threading
import time

# Get your API key from: https://developer.tomtom.com/
API_KEY = "2W1y7yERAJMYRoK9k1ACtrWxNgR1R9cS"
# Add OpenWeatherMap API key for weather data
WEATHER_API_KEY = "3f17cc8fc635e6b29600fb3de9e788fa"

app = Flask(__name__)
app.config['SECRET_KEY'] = 'traffinity_secret_key'
socketio = SocketIO(app, cors_allowed_origins="*", logger=False, engineio_logger=False, 
                   async_mode='threading', ping_timeout=20, ping_interval=10)

# Store active monitoring sessions
active_monitors = {}

# Removed pretty_print function - was causing verbose output

# Traffic Flow API - Current traffic conditions
def get_current_traffic(lat, lon):
    url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
    params = {
        "point": f"{lat},{lon}",
        "key": API_KEY
    }
    try:
        res = requests.get(url, params=params)
        res.raise_for_status()
        return res.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

# Traffic Prediction using Routing API with future departure times
def predict_traffic(origin_lat, origin_lon, dest_lat, dest_lon, departure_minutes_from_now=0):
    departure_time = datetime.now() + timedelta(minutes=departure_minutes_from_now)
    departure_iso = departure_time.strftime("%Y-%m-%dT%H:%M:%S")
    
    url = f"https://api.tomtom.com/routing/1/calculateRoute/{origin_lat},{origin_lon}:{dest_lat},{dest_lon}/json"
    params = {
        "key": API_KEY,
        "departAt": departure_iso,
        "traffic": "true",
        "routeType": "fastest",
        "travelMode": "car"
    }
    
    try:
        res = requests.get(url, params=params)
        res.raise_for_status()
        return res.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

# Compare traffic at different times
def compare_traffic_times(origin_lat, origin_lon, dest_lat, dest_lon):
    times = [0, 30, 60, 120, 180]  # Now, 30min, 1hr, 2hr, 3hr from now
    results = {}
    
    for minutes in times:
        time_label = "Now" if minutes == 0 else f"{minutes} minutes from now"
        traffic_data = predict_traffic(origin_lat, origin_lon, dest_lat, dest_lon, minutes)
        
        if 'routes' in traffic_data and traffic_data['routes']:
            route = traffic_data['routes'][0]
            summary = route['summary']
            results[time_label] = {
                "duration": summary.get('travelTimeInSeconds', 0) / 60,  # Convert to minutes
                "distance": summary.get('lengthInMeters', 0) / 1000,     # Convert to km
                "traffic_delay": summary.get('trafficDelayInSeconds', 0) / 60,  # Convert to minutes
                "departure_time": (datetime.now() + timedelta(minutes=minutes)).strftime("%H:%M")
            }
        else:
            results[time_label] = {"error": "No route data available"}
    
    return results

# Get traffic incidents along a route
def get_traffic_incidents(bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon):
    url = f"https://api.tomtom.com/traffic/services/5/incidentDetails"
    params = {
        "bbox": f"{bbox_min_lon},{bbox_min_lat},{bbox_max_lon},{bbox_max_lat}",
        "fields": "{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code,iconCategory}}}}",
        "language": "en-GB",
        "key": API_KEY
    }
    
    try:
        res = requests.get(url, params=params)
        res.raise_for_status()
        return res.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

def format_traffic_analysis(traffic_data):
    """Format traffic data for better readability"""
    flow_data = traffic_data.get('flowSegmentData', {})
    
    current_speed = flow_data.get('currentSpeed', 0)
    free_flow_speed = flow_data.get('freeFlowSpeed', 0)
    road_closure = flow_data.get('roadClosure', False)
    
    # Calculate traffic congestion percentage
    if free_flow_speed > 0:
        congestion = ((free_flow_speed - current_speed) / free_flow_speed) * 100
    else:
        congestion = 0
    
    status = "🟢 Free Flow"
    if congestion > 50:
        status = "🔴 Heavy Traffic"
    elif congestion > 25:
        status = "🟡 Moderate Traffic"
    elif congestion > 10:
        status = "🟠 Light Traffic"
    
    if road_closure:
        status = "🚫 Road Closed"
    
    return {
        "status": status,
        "current_speed": f"{current_speed} km/h",
        "free_flow_speed": f"{free_flow_speed} km/h",
        "congestion_level": f"{congestion:.1f}%",
        "road_closure": road_closure
    }

def analyze_incidents(incidents_data):
    """Analyze traffic incidents and categorize them"""
    incidents = incidents_data.get('incidents', [])
    
    analysis = {
        "total_incidents": len(incidents),
        "closures": 0,
        "roadworks": 0,
        "accidents": 0,
        "traffic_jams": 0,
        "other": 0,
        "high_impact": 0
    }
    
    incident_details = []
    
    for incident in incidents:
        props = incident.get('properties', {})
        events = props.get('events', [])
        magnitude = props.get('magnitudeOfDelay', 0)
        
        if magnitude >= 3:
            analysis["high_impact"] += 1
        
        for event in events:
            code = event.get('code', 0)
            description = event.get('description', '')
            
            incident_details.append({
                "description": description,
                "severity": "High" if magnitude >= 3 else "Medium" if magnitude >= 1 else "Low",
                "impact_level": magnitude
            })
            
            # Categorize incidents
            if 400 <= code <= 499:  # Closures
                analysis["closures"] += 1
            elif 700 <= code <= 799:  # Roadworks
                analysis["roadworks"] += 1
            elif 100 <= code <= 199:  # Traffic conditions
                analysis["traffic_jams"] += 1
            elif 1800 <= code <= 1899:  # Traffic control
                analysis["other"] += 1
            else:
                analysis["other"] += 1
    
    return analysis, incident_details

def get_travel_recommendation(traffic_comparison):
    """Provide travel recommendations based on traffic predictions"""
    valid_times = {k: v for k, v in traffic_comparison.items() if 'error' not in v}
    
    if not valid_times:
        return "No valid route data available"
    
    # Find best and worst times
    best_time = min(valid_times.items(), key=lambda x: x[1]['duration'])
    worst_time = max(valid_times.items(), key=lambda x: x[1]['duration'])
    
    time_savings = worst_time[1]['duration'] - best_time[1]['duration']
    
    recommendation = f"""
🚗 TRAVEL RECOMMENDATIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ BEST TIME: {best_time[0]} at {best_time[1]['departure_time']}
   Duration: {best_time[1]['duration']:.1f} minutes
   Distance: {best_time[1]['distance']:.1f} km

❌ WORST TIME: {worst_time[0]} at {worst_time[1]['departure_time']}
   Duration: {worst_time[1]['duration']:.1f} minutes

💡 TIME SAVINGS: {time_savings:.1f} minutes by choosing the best time
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    return recommendation

# Weather Impact Analysis
def get_weather_data(lat, lon):
    """Fetch current weather data from OpenWeatherMap API"""
    url = f"https://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": WEATHER_API_KEY,
        "units": "metric"
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

def analyze_weather_impact(weather_data):
    """Analyze weather conditions and their potential impact on traffic"""
    if 'error' in weather_data:
        return {"impact": "Unknown", "conditions": "Weather data unavailable"}
    
    main = weather_data.get('main', {})
    weather = weather_data.get('weather', [{}])[0]
    wind = weather_data.get('wind', {})
    visibility = weather_data.get('visibility', 10000)
    
    temp = main.get('temp', 20)
    humidity = main.get('humidity', 50)
    weather_main = weather.get('main', '').lower()
    weather_desc = weather.get('description', '')
    wind_speed = wind.get('speed', 0) * 3.6  # Convert m/s to km/h
    
    # Determine traffic impact based on weather conditions
    impact_score = 0
    impact_factors = []
    
    # Temperature impact
    if temp < -5 or temp > 35:
        impact_score += 2
        impact_factors.append(f"Extreme temperature ({temp}°C)")
    
    # Precipitation impact
    if 'rain' in weather_main or 'drizzle' in weather_main:
        impact_score += 3
        impact_factors.append("Rain conditions")
    elif 'snow' in weather_main:
        impact_score += 5
        impact_factors.append("Snow conditions")
    elif 'thunderstorm' in weather_main:
        impact_score += 4
        impact_factors.append("Thunderstorm")
    
    # Wind impact
    if wind_speed > 50:
        impact_score += 3
        impact_factors.append(f"Strong winds ({wind_speed:.1f} km/h)")
    elif wind_speed > 30:
        impact_score += 1
        impact_factors.append(f"Moderate winds ({wind_speed:.1f} km/h)")
    
    # Visibility impact
    if visibility < 1000:
        impact_score += 4
        impact_factors.append(f"Poor visibility ({visibility}m)")
    elif visibility < 5000:
        impact_score += 2
        impact_factors.append(f"Reduced visibility ({visibility}m)")
    
    # Fog/mist impact
    if 'fog' in weather_main or 'mist' in weather_main:
        impact_score += 3
        impact_factors.append("Fog/mist conditions")
    
    # Determine impact level
    if impact_score >= 8:
        impact_level = "🔴 Severe Impact"
        traffic_multiplier = 1.5
    elif impact_score >= 5:
        impact_level = "🟠 High Impact"
        traffic_multiplier = 1.3
    elif impact_score >= 2:
        impact_level = "🟡 Moderate Impact"
        traffic_multiplier = 1.15
    else:
        impact_level = "🟢 Minimal Impact"
        traffic_multiplier = 1.0
    
    return {
        "impact": impact_level,
        "conditions": weather_desc.title(),
        "temperature": f"{temp}°C",
        "humidity": f"{humidity}%",
        "wind_speed": f"{wind_speed:.1f} km/h",
        "visibility": f"{visibility}m",
        "factors": impact_factors,
        "traffic_multiplier": traffic_multiplier,
        "score": impact_score
    }

# Multiple Route Options
def get_multiple_routes(origin_lat, origin_lon, dest_lat, dest_lon, departure_minutes=0):
    """Get multiple route alternatives with different optimization criteria"""
    departure_time = datetime.now() + timedelta(minutes=departure_minutes)
    departure_iso = departure_time.strftime("%Y-%m-%dT%H:%M:%S")
    
    route_types = {
        "fastest": "Recommended Route",
        "shortest": "Direct Route", 
        "eco": "Fuel-Efficient Route"
    }
    
    routes = {}
    
    for route_type, route_name in route_types.items():
        url = f"https://api.tomtom.com/routing/1/calculateRoute/{origin_lat},{origin_lon}:{dest_lat},{dest_lon}/json"
        params = {
            "key": API_KEY,
            "departAt": departure_iso,
            "traffic": "true",
            "routeType": route_type,
            "travelMode": "car",
            "maxAlternatives": 2 if route_type == "fastest" else 0
        }
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if 'routes' in data and data['routes']:
                route_data = []
                for i, route in enumerate(data['routes']):
                    summary = route['summary']
                    
                    # Extract major roads/highways from route instructions
                    major_roads = []
                    if 'guidance' in route and 'instructions' in route['guidance']:
                        for instruction in route['guidance']['instructions'][:5]:  # First 5 instructions
                            road_numbers = instruction.get('roadNumbers', [])
                            major_roads.extend(road_numbers)
                    
                    # Create a more descriptive route name
                    route_description = route_name
                    if major_roads:
                        unique_roads = list(dict.fromkeys(major_roads))[:3]  # Remove duplicates, max 3
                        road_text = ", ".join(unique_roads)
                        if i == 0:
                            route_description = f"{route_name} via {road_text}"
                        else:
                            route_description = f"Alternative via {road_text}"
                    elif i > 0:
                        route_description = f"Alternative Route {i+1}"
                    
                    route_info = {
                        "name": route_description,
                        "duration": summary.get('travelTimeInSeconds', 0) / 60,
                        "distance": summary.get('lengthInMeters', 0) / 1000,
                        "traffic_delay": summary.get('trafficDelayInSeconds', 0) / 60,
                        "fuel_consumption": summary.get('fuelConsumptionInLiters', 0),
                        "departure_time": departure_time.strftime("%H:%M"),
                        "route_geometry": route.get('legs', [{}])[0].get('points', []) if route.get('legs') else [],
                        "instructions": route.get('guidance', {}).get('instructions', [])[:10],  # First 10 turn-by-turn instructions
                        "route_id": f"{route_type}_{i}",
                        "major_roads": major_roads[:3]
                    }
                    route_data.append(route_info)
                
                routes[route_type] = route_data
        except requests.exceptions.RequestException as e:
            routes[route_type] = [{"error": str(e)}]
    
    return routes

def deduplicate_routes(routes_data, similarity_threshold=0.05):
    """Remove duplicate routes that are too similar in distance and duration"""
    all_routes = []
    
    # Collect all routes from different types
    for route_type, route_list in routes_data.items():
        for route in route_list:
            if 'error' not in route:
                route['original_type'] = route_type
                all_routes.append(route)
    
    # Remove duplicates based on distance and duration similarity
    unique_routes = []
    
    for route in all_routes:
        is_duplicate = False
        
        for existing_route in unique_routes:
            # Calculate similarity based on distance and duration
            distance_diff = abs(route['distance'] - existing_route['distance']) / max(route['distance'], existing_route['distance'], 0.1)
            duration_diff = abs(route['duration'] - existing_route['duration']) / max(route['duration'], existing_route['duration'], 0.1)
            
            # If both distance and duration are very similar, it's a duplicate
            if distance_diff <= similarity_threshold and duration_diff <= similarity_threshold:
                is_duplicate = True
                
                # Keep the route with better characteristics (shorter duration or less traffic delay)
                if route['duration'] < existing_route['duration'] or route['traffic_delay'] < existing_route['traffic_delay']:
                    # Replace existing with this better route
                    unique_routes.remove(existing_route)
                    unique_routes.append(route)
                break
        
        if not is_duplicate:
            unique_routes.append(route)
    
    # If we have too few unique routes, relax the threshold slightly
    if len(unique_routes) < 2 and len(all_routes) > 1 and similarity_threshold < 0.15:
        return deduplicate_routes(routes_data, similarity_threshold * 1.5)
    
    # Ensure we always have at least one route
    if len(unique_routes) == 0 and len(all_routes) > 0:
        unique_routes = [all_routes[0]]  # Keep the first route as fallback
    
    # Reorganize back into route types structure and improve naming
    deduplicated_routes = {}
    route_names = ["Recommended Route", "Alternative Route", "Backup Route"]
    
    for i, route in enumerate(unique_routes):
        route_type = route.pop('original_type')
        
        # Improve route naming for clarity
        if len(unique_routes) == 1:
            route['name'] = "Recommended Route"
        elif i < len(route_names):
            route['name'] = route_names[i]
        else:
            route['name'] = f"Route Option {i + 1}"
        
        if route_type not in deduplicated_routes:
            deduplicated_routes[route_type] = []
        deduplicated_routes[route_type].append(route)
    
    return deduplicated_routes

def compare_route_options(routes_data, weather_impact):
    """Compare different route options considering weather impact"""
    all_routes = []
    
    for route_type, route_list in routes_data.items():
        for route in route_list:
            if 'error' not in route:
                # Apply weather impact to duration
                adjusted_duration = route['duration'] * weather_impact.get('traffic_multiplier', 1.0)
                route['weather_adjusted_duration'] = adjusted_duration
                route['weather_impact'] = weather_impact.get('impact', 'Unknown')
                all_routes.append(route)
    
    # Sort by weather-adjusted duration
    all_routes.sort(key=lambda x: x.get('weather_adjusted_duration', float('inf')))
    
    return all_routes

# Real-time Web Notifications
def monitor_route_conditions(origin_lat, origin_lon, dest_lat, dest_lon, session_id, threshold_minutes=10):
    """Monitor route conditions and send real-time alerts via websocket"""
    def monitor():
        last_duration = None
        check_count = 0
        
        while session_id in active_monitors:
            try:
                # Get current traffic prediction
                traffic_data = predict_traffic(origin_lat, origin_lon, dest_lat, dest_lon)
                
                if 'routes' in traffic_data and traffic_data['routes']:
                    current_duration = traffic_data['routes'][0]['summary'].get('travelTimeInSeconds', 0) / 60
                    check_count += 1
                    
                    # Send status update every check
                    socketio.emit('monitoring_status', {
                        'type': 'status_update',
                        'duration': f"{current_duration:.1f}",
                        'check_count': check_count,
                        'timestamp': datetime.now().strftime("%H:%M:%S"),
                        'session_id': session_id
                    })
                    
                    if last_duration is not None:
                        duration_change = current_duration - last_duration
                        
                        if abs(duration_change) >= threshold_minutes:
                            # Significant change detected - send alert
                            change_type = "increased" if duration_change > 0 else "decreased"
                            alert_type = "warning" if duration_change > 0 else "success"
                            
                            socketio.emit('traffic_alert', {
                                'type': alert_type,
                                'title': f"Traffic Alert: Travel time {change_type}!",
                                'message': f"Current travel time: {current_duration:.1f} minutes",
                                'change': f"{duration_change:+.1f} minutes from last check",
                                'timestamp': datetime.now().strftime("%H:%M:%S"),
                                'session_id': session_id
                            })
                    
                    last_duration = current_duration
                
                # Wait 1 minute before next check (shorter for demo purposes)
                time.sleep(60)
                
            except Exception as e:
                print(f"Monitoring error: {e}")
                socketio.emit('monitoring_error', {
                    'error': str(e),
                    'timestamp': datetime.now().strftime("%H:%M:%S"),
                    'session_id': session_id
                })
                time.sleep(30)  # Wait 30 seconds on error
        
        # Send monitoring stopped notification
        socketio.emit('monitoring_stopped', {
            'message': 'Route monitoring has been stopped',
            'session_id': session_id
        })
    
    # Start monitoring in background thread
    monitor_thread = threading.Thread(target=monitor, daemon=True)
    monitor_thread.start()

@app.route('/')
def index():
    """Redirect to auth page on app startup"""
    return redirect('/auth')

@app.route('/auth')
def auth():
    """Serve the authentication page"""
    return render_template('auth.html')

@app.route('/home')
def home():
    """Serve the main homepage after login"""
    return render_template('main.html')

@app.route('/main')
def main():
    """Legacy route - redirect to home"""
    return redirect('/home')

@app.route('/prediction')
def prediction():
    """Serve the traffic prediction page"""
    return render_template('prediction.html')

@app.route('/monitoring')
def monitoring():
    """Serve the route monitoring page"""
    return render_template('monitoring.html')

@app.route('/dashboard')
def dashboard():
    """Serve the dashboard page (legacy route for compatibility)"""
    return redirect('/home')

@app.route('/predict', methods=['POST'])
def predict_traffic_route():
    """Handle traffic prediction requests from the web form"""
    try:
        data = request.get_json()
        origin = data.get('origin', '').strip()
        destination = data.get('destination', '').strip()
        
        if not origin or not destination:
            return jsonify({"error": "Both origin and destination are required"}), 400
        
        # Geocode locations using TomTom API
        print(f"🔍 Geocoding origin: {origin}")
        origin_coords = geocode_location(origin)
        
        print(f"🔍 Geocoding destination: {destination}")
        dest_coords = geocode_location(destination)
        
        if not origin_coords or not dest_coords:
            return jsonify({"error": "Could not find the specified locations"}), 400
        
        # Get traffic analysis
        analysis = get_traffic_analysis(
            origin_coords['lat'], origin_coords['lon'],
            dest_coords['lat'], dest_coords['lon']
        )
        
        return jsonify(analysis)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def geocode_location(location):
    """Convert location name to coordinates using TomTom Geocoding API"""
    url = f"https://api.tomtom.com/search/2/geocode/{location}.json"
    params = {
        "key": API_KEY,
        "limit": 1
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data.get('results'):
            result = data['results'][0]
            position = result['position']
            return {
                'lat': position['lat'],
                'lon': position['lon'],
                'address': result['address']['freeformAddress']
            }
    except Exception as e:
        print(f"Geocoding error: {e}")
    
    return None

def get_traffic_analysis(origin_lat, origin_lon, dest_lat, dest_lon):
    """Get comprehensive traffic analysis for web response"""
    
    # Get weather impact
    weather_data = get_weather_data(origin_lat, origin_lon)
    weather_impact = analyze_weather_impact(weather_data)
    
    # Current traffic flow
    current_traffic = get_current_traffic(origin_lat, origin_lon)
    traffic_status = "Unknown"
    
    if 'error' not in current_traffic:
        traffic_summary = format_traffic_analysis(current_traffic)
        traffic_status = traffic_summary['status']
    
    # Get multiple route options
    multiple_routes = get_multiple_routes(origin_lat, origin_lon, dest_lat, dest_lon)
    
    # Count original routes
    original_count = sum(len(routes) for routes in multiple_routes.values() if isinstance(routes, list))
    
    # Remove duplicate routes that are too similar
    unique_routes = deduplicate_routes(multiple_routes)
    
    # Count unique routes
    unique_count = sum(len(routes) for routes in unique_routes.values() if isinstance(routes, list))
    
    if original_count > unique_count:
        print(f"🔄 Route deduplication: {original_count} routes → {unique_count} unique routes")
    
    route_comparison = compare_route_options(unique_routes, weather_impact)
    
    # Traffic predictions for fastest route
    traffic_comparison = compare_traffic_times(origin_lat, origin_lon, dest_lat, dest_lon)
    
    # Format predictions for web response
    predictions = []
    best_time = None
    best_duration = float('inf')
    
    for time_label, data in traffic_comparison.items():
        if 'error' not in data:
            # Apply weather impact
            weather_adjusted = data['duration'] * weather_impact.get('traffic_multiplier', 1.0)
            predictions.append({
                'time': f"{time_label} ({data['departure_time']})",
                'duration': f"{data['duration']:.1f}",
                'weather_adjusted_duration': f"{weather_adjusted:.1f}",
                'distance': f"{data['distance']:.1f}",
                'traffic_delay': data.get('traffic_delay', 0)
            })
            
            if weather_adjusted < best_duration:
                best_duration = weather_adjusted
                best_time = {
                    'time': time_label,
                    'duration': f"{data['duration']:.1f}",
                    'weather_adjusted_duration': f"{weather_adjusted:.1f}",
                    'departure_time': data['departure_time']
                }
    
    # Traffic incidents
    bbox_buffer = 0.01
    incidents = get_traffic_incidents(
        min(origin_lat, dest_lat) - bbox_buffer,
        min(origin_lon, dest_lon) - bbox_buffer,
        max(origin_lat, dest_lat) + bbox_buffer,
        max(origin_lon, dest_lon) + bbox_buffer
    )
    
    incident_summary = {"total": 0, "closures": 0, "roadworks": 0}
    if 'error' not in incidents:
        incident_analysis, _ = analyze_incidents(incidents)
        incident_summary = {
            "total": incident_analysis["total_incidents"],
            "closures": incident_analysis["closures"],
            "roadworks": incident_analysis["roadworks"]
        }
    # Log summary instead of full data to keep terminal clean
    print(f"✅ Traffic prediction completed: {len(route_comparison)} routes found, {traffic_status}")
    return {
        "traffic_status": traffic_status,
        "weather_impact": weather_impact,
        "best_time": best_time,
        "predictions": predictions,
        "route_options": route_comparison[:5],  # Top 5 routes
        "incidents": incident_summary,
        "route": {
            "origin": f"{origin_lat:.4f}, {origin_lon:.4f}",
            "destination": f"{dest_lat:.4f}, {dest_lon:.4f}"
        }
    }

@app.route('/start_monitoring', methods=['POST'])
def start_route_monitoring():
    """Start monitoring a route for traffic changes"""
    try:
        data = request.get_json()
        origin = data.get('origin', '').strip()
        destination = data.get('destination', '').strip()
        threshold = data.get('threshold', 10)
        
        if not all([origin, destination]):
            return jsonify({"error": "Origin and destination are required"}), 400
        
        # Geocode locations using TomTom API
        print(f"🔍 Geocoding origin for monitoring: {origin}")
        origin_coords = geocode_location(origin)
        
        print(f"🔍 Geocoding destination for monitoring: {destination}")
        dest_coords = geocode_location(destination)
        
        if not origin_coords or not dest_coords:
            return jsonify({"error": "Could not find the specified locations"}), 400
        
        # Generate unique session ID
        session_id = f"monitor_{int(time.time())}"
        
        # Store monitoring session
        active_monitors[session_id] = {
            'origin': origin_coords,
            'destination': dest_coords,
            'threshold': threshold,
            'started_at': datetime.now()
        }
        
        # Start monitoring
        monitor_route_conditions(
            origin_coords['lat'], origin_coords['lon'],
            dest_coords['lat'], dest_coords['lon'],
            session_id, threshold
        )
        
        return jsonify({
            "success": True,
            "session_id": session_id,
            "message": "Route monitoring started successfully",
            "origin": origin_coords['address'],
            "destination": dest_coords['address']
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/stop_monitoring', methods=['POST'])
def stop_route_monitoring():
    """Stop monitoring a specific route"""
    try:
        data = request.get_json()
        session_id = data.get('session_id', '')
        
        if session_id in active_monitors:
            del active_monitors[session_id]
            return jsonify({"success": True, "message": "Monitoring stopped"})
        else:
            return jsonify({"error": "Monitoring session not found"}), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/active_monitors')
def get_active_monitors():
    """Get list of active monitoring sessions"""
    monitors_info = []
    for session_id, info in active_monitors.items():
        monitors_info.append({
            'session_id': session_id,
            'origin': info['origin']['address'],
            'destination': info['destination']['address'],
            'threshold': info['threshold'],
            'started_at': info['started_at'].strftime("%H:%M:%S")
        })
    
    return jsonify({"active_monitors": monitors_info})

@app.route('/route_map/<route_id>')
def route_map(route_id):
    """Serve the route map view for a specific route"""
    return render_template('route_map.html', route_id=route_id)

@app.route('/test_tomtom')
def test_tomtom():
    """Serve the TomTom API test page"""
    return render_template('tomtom_test.html')

@app.route('/test_tomtom_api')
def test_tomtom_api():
    """Test if TomTom API is accessible"""
    try:
        import requests
        
        # Test geocoding API
        test_url = f"https://api.tomtom.com/search/2/geocode/test.json?key={API_KEY}&limit=1"
        response = requests.get(test_url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return {
                'status': 'success',
                'message': 'TomTom API is working',
                'test_url': test_url,
                'response_status': response.status_code,
                'results_count': len(data.get('results', []))
            }
        else:
            return {
                'status': 'error',
                'message': f'TomTom API returned status {response.status_code}',
                'test_url': test_url,
                'response_status': response.status_code
            }
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Error connecting to TomTom API: {str(e)}',
            'test_url': test_url if 'test_url' in locals() else 'N/A'
        }

# WebSocket event handlers
@app.route('/geocode', methods=['POST'])
def geocode_endpoint():
    """Geocode a location using TomTom API"""
    try:
        data = request.get_json()
        location = data.get('location', '').strip()
        
        if not location:
            return jsonify({"error": "Location is required"}), 400
        
        coords = geocode_location(location)
        
        if not coords:
            return jsonify({"error": "Could not find the specified location"}), 404
        
        return jsonify(coords)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@socketio.on('connect')
def handle_connect():
    print(f"Client connected")
    emit('connected', {'message': 'Connected to Traffinity monitoring service'})

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected")

@socketio.on('join_monitoring')
def handle_join_monitoring(data):
    session_id = data.get('session_id')
    if session_id in active_monitors:
        emit('joined_monitoring', {
            'session_id': session_id,
            'message': f'Joined monitoring session {session_id}'
        })

@app.route('/auth/login', methods=['POST'])
def auth_login():
    """Handle login requests"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400
        
        # TODO: Replace with actual database authentication
        # For now, simulate authentication logic
        valid_users = {
            "admin@traffinity.com": "password123",
            "demo@traffinity.com": "demo123",
            "test@traffinity.com": "test123"
        }
        
        if email in valid_users and valid_users[email] == password:
            # Successful login
            user_data = {
                "email": email,
                "name": email.split('@')[0].title(),
                "login_time": datetime.now().isoformat(),
                "user_id": hash(email) % 10000  # Simple user ID generation
            }
            
            print(f"✅ Login successful: {email}")
            return jsonify({
                "success": True,
                "message": "Login successful",
                "user": user_data
            }), 200
        else:
            print(f"❌ Login failed: {email}")
            return jsonify({"error": "Invalid email or password"}), 401
            
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"error": "Login failed. Please try again."}), 500

@app.route('/auth/register', methods=['POST'])
def auth_register():
    """Handle signup/registration requests"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not all([name, email, password]):
            return jsonify({"error": "All fields are required"}), 400
        
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters long"}), 400
        
        # TODO: Replace with actual database storage
        # For now, simulate user registration
        existing_users = [
            "admin@traffinity.com",
            "demo@traffinity.com", 
            "test@traffinity.com"
        ]
        
        if email in existing_users:
            return jsonify({"error": "User with this email already exists"}), 409
        
        # Simulate successful registration
        user_data = {
            "name": name,
            "email": email,
            "registered_at": datetime.now().isoformat(),
            "user_id": hash(email) % 10000
        }
        
        print(f"✅ Registration successful: {name} ({email})")
        
        # In a real app, you would:
        # 1. Hash the password (using bcrypt or similar)
        # 2. Store user data in database
        # 3. Send verification email
        # 4. Create user session
        
        return jsonify({
            "success": True,
            "message": "Account created successfully! You can now sign in.",
            "user": user_data
        }), 201
        
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({"error": "Registration failed. Please try again."}), 500

@app.route('/auth/logout', methods=['POST'])
def auth_logout():
    """Handle logout requests"""
    try:
        # In a real app, you would:
        # 1. Invalidate the user session
        # 2. Clear authentication tokens
        # 3. Log the logout event
        
        print("✅ User logged out")
        return jsonify({
            "success": True,
            "message": "Logged out successfully"
        }), 200
        
    except Exception as e:
        print(f"Logout error: {e}")
        return jsonify({"error": "Logout failed"}), 500

@app.route('/auth/verify', methods=['POST'])
def verify_session():
    """Verify if user session is valid"""
    try:
        data = request.get_json()
        email = data.get('email', '')
        
        # TODO: Replace with actual session verification
        # For now, simulate session check
        if email:
            return jsonify({
                "valid": True,
                "user": {
                    "email": email,
                    "name": email.split('@')[0].title()
                }
            }), 200
        else:
            return jsonify({"valid": False}), 401
            
    except Exception as e:
        return jsonify({"valid": False, "error": str(e)}), 500

@app.route('/.well-known/appspecific/com.chrome.devtools.json')
def chrome_devtools():
    """Handle Chrome DevTools JSON request to prevent 404 errors in logs"""
    return jsonify({"error": "Not supported"}), 404

if __name__ == "__main__":
    # Check if API keys are set
    if API_KEY == "YOUR_API_KEY_HERE":
        print("❌ Please set your TomTom API key!")
        print("1. Go to https://developer.tomtom.com/")
        print("2. Sign up for a free account")
        print("3. Create a new app and get your API key")
        print("4. Replace 'YOUR_API_KEY_HERE' with your actual API key")
        exit()
    
    if WEATHER_API_KEY == "YOUR_OPENWEATHER_API_KEY":
        print("⚠️ Weather API key not set. Weather impact analysis will be unavailable.")
        print("1. Go to https://openweathermap.org/api")
        print("2. Sign up for a free account")
        print("3. Get your API key and replace 'YOUR_OPENWEATHER_API_KEY'")
    
    # Run Flask app with SocketIO (debug=False for cleaner terminal output)
    socketio.run(app, debug=False, host='0.0.0.0', port=5000)
