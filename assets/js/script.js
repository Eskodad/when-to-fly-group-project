// API Key openweather
const apiKey = "b773ba3167fd9791028d0f0f123759cc";
// Default coordinates (center of USA) so forecast loads on page open
let lat = 37.6;
let lon = -95.665;
// Default view for map of the North American continent.
mapboxgl.accessToken = 'pk.eyJ1IjoibWVsbGlzMTAyMzk2IiwiYSI6ImNrbXVwcDhhNjEzeXEyd3E1cmdjOWc0emwifQ.Jusfg2NUaXj_tZbA899ZSg';
const map = new mapboxgl.Map({
  container: 'map', // container id
  style: 'mapbox://styles/mellis102396/ckmups1cn4s5e17nosaokzhl8', // style URL
  center: [-95.665, 37.6], // starting position [lng, lat]
  zoom: 2 // starting zoom
});
// If the style references missing images (eg. airport-11), create a simple fallback image
map.on && map.on('styleimagemissing', function (e) {
  try {
    const id = e.id || '';
    if (!id) return;
    // create a small canvas with a plane-like marker (simple triangle)
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // transparent background
    ctx.clearRect(0, 0, size, size);
    // draw circle base
    ctx.fillStyle = 'rgba(255,200,0,0.95)';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/3, 0, Math.PI*2);
    ctx.fill();
    // draw simple plane (triangle)
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    ctx.moveTo(size*0.35, size*0.45);
    ctx.lineTo(size*0.65, size*0.5);
    ctx.lineTo(size*0.35, size*0.55);
    ctx.closePath();
    ctx.fill();
    if (!map.hasImage || !map.addImage) return;
    // add image under the missing id so the style can use it
    try { map.addImage(id, canvas); } catch (err) { try { map.addImage(id, canvas, {sdf:false}); } catch(e){/*ignore*/} }
  } catch (err) {
    console.error('styleimagemissing handler error', err);
  }
});
// track whether directions control has been added to avoid duplicates
let directionsAdded = false;
// track whether Overpass API is reachable in this session
let overpassAvailable = true;
// Will take input from user to zero in on map to users location
$("#subButton").click(function (e) {
  zipper = $("#userInput").val();
  zipInput = parseInt(zipper)
  // Stores last used zipcode in local storage also prevents duplicates in dropdown.
  const zipcode = JSON.parse(localStorage.getItem("zipcode")) || [];
  const savedZip = zipInput;
  if (Number.isNaN(zipInput)) {
    showAlert('Please Enter a Valid ZIP code!');
    $("#userInput").val('');
  } else {
    if (zipcode.includes(savedZip) === false) {
      zipcode.push(savedZip);
      localStorage.setItem("zipcode", JSON.stringify(zipcode));
    }
    zipLookUp(zipInput);
    loadLocalStorage();
    $("#userInput").val('');
    $('#forecastBox').html('');
  }
});
// Use of opendatasoft.com to get the longitude and latitude of user via zip code
// opendatasoft api for zip code conversion to longitude latitude
// https://public.opendatasoft.com/api/records/1.0/search/?dataset=us-zip-code-latitude-and-longitude&q=&facet=state&facet=timezone&facet=dst
// example of use
// https://public.opendatasoft.com/api/records/1.0/search/?dataset=us-zip-code-latitude-and-longitude&q=43606&facet=state&facet=timezone&facet=dst
function zipLookUp(zipInput) {
  // Use Zippopotam.us for zip -> lat/lon (no API key required)
  const api = 'https://api.zippopotam.us/us/' + encodeURIComponent(zipInput);
  fetch(api)
    .then(response => {
      if (!response.ok) throw new Error('Zippopotam.us lookup failed: ' + response.status);
      return response.json();
    })
    .then(function (data) {
      // zippopotam.us returns places array with latitude/longitude as strings
      if (data && Array.isArray(data.places) && data.places.length > 0) {
        const place = data.places[0];
        lon = parseFloat(place.longitude);
        lat = parseFloat(place.latitude);
        if (isNaN(lon) || isNaN(lat)) throw new Error('Invalid coordinates from zippopotam.us');
        console.log('zipLookUp coords ->', { lon: lon, lat: lat });
        mapZipDisplay();
        fiveDay();
      } else {
        showAlert('Please Enter a Valid ZIP code!');
      }
    })
    .catch(err => {
      console.error('zipLookUp error:', err);
      showAlert('Unable to look up ZIP code. Please try again later.');
    });
}
// Adjusts the map to the users current location via zip with an adjusted zoom level.
// Includes Api key for map 
function mapZipDisplay() {
  // smoothly move the existing map to the new coordinates and zoom in
  try {
    console.log('mapZipDisplay called with', { lon: lon, lat: lat, mapExists: !!map });
    if (!map || typeof map.flyTo !== 'function') {
      console.error('map object not ready');
      return;
    }
    const center = [parseFloat(lon), parseFloat(lat)];
    const doFly = () => {
      try {
        map.resize();
          map.flyTo({ center: center, zoom: 11, speed: 0.8, curve: 1.2, essential: true });
        try {
          map.once('moveend', function () { showAreaInfo(center[1], center[0]); });
        } catch (err) {
          console.error('failed to attach moveend handler', err);
        }
      } catch (err) {
        console.error('flyTo failed:', err);
      }
      // add directions control once
      if (!directionsAdded && typeof MapboxDirections !== 'undefined') {
        try {
          map.addControl(new MapboxDirections({ accessToken: mapboxgl.accessToken }), 'top-left');
          directionsAdded = true;
        } catch (err) {
          console.error('adding directions failed:', err);
        }
      }
    };

    // If map style not yet loaded, wait for load event
    if (typeof map.loaded === 'function' && !map.loaded()) {
      map.once('load', doFly);
    } else {
      doFly();
    }
  } catch (err) {
    console.error('mapZipDisplay error:', err);
  }
}

  // Show detailed area info after zoom: current weather, reverse-geocoded place, simple flying-zone heuristics
  async function showAreaInfo(latParam, lonParam) {
    try {
      const latVal = latParam || lat;
      const lonVal = lonParam || lon;
      const weatherUrl = 'https://api.openweathermap.org/data/2.5/weather?lat=' + latVal + '&lon=' + lonVal + '&appid=' + apiKey + '&units=imperial';
      const [wResp, nResp] = await Promise.all([
        fetch(weatherUrl),
        fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + encodeURIComponent(latVal) + '&lon=' + encodeURIComponent(lonVal))
      ]);

      const weather = wResp.ok ? await wResp.json() : null;
      const nominatim = nResp.ok ? await nResp.json() : null;

      let locationName = (nominatim && nominatim.display_name) ? nominatim.display_name : (weather && weather.name) ? weather.name : 'Selected Area';

      // Heuristics for flying zones / restrictions
      const reasons = [];
      let zoneAdvice = 'Unknown';
      // nearest airport ICAO/ref (if identified) for NOTAM checks
      let nearestIcao = null;
      // Check nearby airports using Overpass API
      try {
        const airports = await checkNearbyAirports(latVal, lonVal, 16093); // 10 miles ~ 16093 m
        if (airports && airports.length > 0) {
          const nearest = airports[0];
          // capture ICAO or ref if present to allow NOTAM lookups
          nearestIcao = (nearest.tags && (nearest.tags.icao || nearest.tags.ref)) ? (nearest.tags.icao || nearest.tags.ref) : null;
          reasons.push('Nearest airport: ' + (nearest.tags && (nearest.tags.name || nearest.tags.ref) ? (nearest.tags.name || nearest.tags.ref) + ' — ' : '') + nearest.distance.toFixed(1) + ' m away.');
          // If within 8046 m (~5 miles) consider not safe
          if (nearest.distance <= 8046) {
            zoneAdvice = 'Not Safe';
            reasons.push('Aircraft operations likely nearby (within 5 miles). Do NOT fly without authorization.');
          } else if (nearest.distance <= 16093) {
            if (zoneAdvice !== 'Not Safe') zoneAdvice = 'Caution';
            reasons.push('Airport within 10 miles — remain cautious and check NOTAMs.');
          }
        }
      } catch (err) {
        console.warn('airport check failed', err);
      }
      // Check for nearby airport/aeroway
      if (nominatim && (nominatim.category === 'aeroway' || /airport/i.test(locationName) || (nominatim.address && (nominatim.address.aeroway || nominatim.address.airport)))) {
        reasons.push('This area appears to be at or near an airport or aerodrome — flying is restricted or prohibited.');
        zoneAdvice = 'Not Safe';
      }
      // Park/Protected areas caution
      if (nominatim && (/park|national park|forest|reserve|protected/i.test(locationName) || (nominatim.type && /park|forest|reserve/.test(nominatim.type)))) {
        reasons.push('This area appears to be a park or protected area. Check local park rules before flying.');
        if (zoneAdvice !== 'Not Safe') zoneAdvice = 'Caution';
      }

      // Weather-based advice
      if (weather && weather.wind) {
        const w = weather.wind.speed; // m/s
        if (w > 9) {
          reasons.push('High winds detected (' + w + ' m/s). Not safe to fly.');
          zoneAdvice = 'Not Safe';
        } else if (w > 5) {
          reasons.push('Moderate winds detected (' + w + ' m/s). Exercise caution and consider postponing.');
          if (zoneAdvice !== 'Not Safe') zoneAdvice = 'Caution';
        } else {
          reasons.push('Wind conditions look good (' + w + ' m/s).');
          if (zoneAdvice === 'Unknown') zoneAdvice = 'Likely Safe';
        }
      }

      if (reasons.length === 0) reasons.push('No immediate restrictions detected from quick checks. Always verify local laws and NOTAMs before flying.');

      // Color class for summary badge
      let badgeClass = 'lowWind';
      if (zoneAdvice === 'Not Safe') badgeClass = 'highWind';
      else if (zoneAdvice === 'Caution') badgeClass = 'cautionWind';

      let content = '<div style="text-align:left; max-height:70vh; overflow:auto;">';
      content += '<h2>' + locationName + '</h2>';
      // If we found nearby airport details, show quick link to NOTAM lookup
      if (nominatim && nominatim.address && nominatim.address.state) {
        // nothing here, placeholder for future state-specific info
      }
      if (weather) {
        content += '<p><strong>Weather:</strong> ' + (weather.weather && weather.weather[0] ? weather.weather[0].description : '') + ' • Temp: ' + Math.round(weather.main.temp) + ' °F • Wind: ' + weather.wind.speed + ' m/s • Humidity: ' + weather.main.humidity + '%</p>';
      }
      content += '<p><strong>Advisory:</strong> <span class="' + badgeClass + '" style="padding:6px 10px; border-radius:6px;">' + zoneAdvice + '</span></p>';
      content += '<h4>Why this advice?</h4><ul>';
      for (const r of reasons) content += '<li>' + r + '</li>';
      content += '</ul>';
      // Local FAA rules guidance
      content += '<h4>Local FAA Rules</h4>';
      content += '<ul>';
      content += '<li>Follow FAA regulations: see <a href="https://www.faa.gov/uas" target="_blank" rel="noopener">FAA UAS</a> for Part 107 & recreational guidance.</li>';
      content += '<li>Do not operate in controlled airspace without authorization — use LAANC or FAA authorization portals.</li>';
      content += '<li>Check the B4UFLY guidance and FAA airspace maps: <a href="https://www.faa.gov/uas/recreational_fliers/where_can_i_fly/b4ufly" target="_blank" rel="noopener">B4UFLY</a>.</li>';
      if (nearestIcao) {
        // safe-escape the ICAO/ref value
        const safeIcao = nearestIcao.replace(/'/g, "\\'");
        content += '<li>Nearest airport identifier: <strong>' + nearestIcao + '</strong> — <button onclick="verifyNOTAMs(\'' + safeIcao + '\')">Verify NOTAMs</button></li>';
      } else {
        content += '<li>No nearby airport identifier found automatically. You can still check NOTAMs for a known airport ICAO.</li>';
      }
      content += '</ul>';
      content += '<div id="notamResults" style="margin-top:8px;"></div>';
      content += '</div>';

      showDialog(content);
    } catch (err) {
      console.error('showAreaInfo error:', err);
      showAlert('Unable to fetch detailed area info.');
    }
  }

  // Helper to verify NOTAMs when user clicks the button in the modal
  async function verifyNOTAMs(icao) {
    try {
      if (!icao) {
          showAlert('No ICAO provided for NOTAM lookup.');
          return;
        }
      const container = document.getElementById('notamResults');
      if (!container) {
        showAlert('NOTAM results container not available.');
        return;
      }
      container.innerHTML = '<p>Loading NOTAMs for ' + icao + '...</p>';
      const data = await fetchNOTAMsForAirport(icao);
      if (!data) {
        container.innerHTML = '<p>No NOTAM data available or fetch failed.</p>';
        return;
      }

      // Try to find an array of NOTAM entries in common response shapes
      let formatted = '';
      const candidates = Object.values(data).filter(v => Array.isArray(v) && v.length > 0);
      let found = false;
      for (const arr of candidates) {
        const sample = arr[0];
        if (sample && (sample.text || sample.notam || sample.raw_text || sample.notice)) {
          formatted = '<ul>' + arr.map(n => '<li>' + (n.text || n.notam || n.raw_text || n.notice || JSON.stringify(n)) + '</li>').join('') + '</ul>';
          found = true;
          break;
        }
      }
      if (!found) {
        // Fallback: render the JSON so user can inspect raw response
        formatted = '<pre style="max-height:200px; overflow:auto; background:#f6f6f6; padding:8px;">' + JSON.stringify(data, null, 2) + '</pre>';
      }
      container.innerHTML = '<h5>NOTAMs for ' + icao + '</h5>' + formatted;
    } catch (err) {
      console.error('verifyNOTAMs error', err);
      showAlert('Unable to load NOTAMs. Try again later.');
    }
  }

  // Overpass API: find nearby airports/aerodromes within radius (meters)
  async function checkNearbyAirports(latVal, lonVal, radiusMeters) {
    try {
      if (!overpassAvailable) return [];
      const query = `[out:json];(node["aeroway"~"aerodrome|airport"](around:${radiusMeters},${latVal},${lonVal});way["aeroway"~"aerodrome|airport"](around:${radiusMeters},${latVal},${lonVal});relation["aeroway"~"aerodrome|airport"](around:${radiusMeters},${latVal},${lonVal}););out center;`;
      // timeout wrapper for fetch (7s)
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 7000);
      const resp = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query, signal: controller.signal });
      clearTimeout(id);
      if (!resp.ok) {
        // mark Overpass unavailable to avoid repeated timeouts
        overpassAvailable = false;
        throw new Error('Overpass query failed: ' + resp.status);
      }
      const data = await resp.json();
      if (!data || !Array.isArray(data.elements)) return [];
      // compute distance for each element
      const results = data.elements.map(el => {
        let latE = el.lat;
        let lonE = el.lon;
        if (!latE && el.center) { latE = el.center.lat; lonE = el.center.lon; }
        const distance = (latE && lonE) ? haversineDistanceMeters(latVal, lonVal, latE, lonE) : Infinity;
        return { id: el.id, tags: el.tags || {}, lat: latE, lon: lonE, distance };
      }).filter(r => isFinite(r.distance)).sort((a,b) => a.distance - b.distance);
      return results;
    } catch (err) {
      console.warn('checkNearbyAirports error', err);
      // degrade gracefully: mark unavailable and return empty
      overpassAvailable = false;
      return [];
    }
  }

  function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const toRad = x => x * Math.PI / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Simple NOTAM lookup attempt using FAA ADDS (may be limited); requires ICAO code to query
  async function fetchNOTAMsForAirport(icao) {
    try {
      if (!icao) return null;
      const url = 'https://aeronav.faa.gov/adds/dataserver_current/httpparam?dataSource=notams&requestType=retrieve&format=JSON&locationIdentifier=' + encodeURIComponent(icao);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('NOTAM fetch failed: ' + resp.status);
      const data = await resp.json();
      return data;
    } catch (err) {
      console.warn('fetchNOTAMsForAirport failed', err);
      return null;
    }
  }
// Random drone tips video on page reload. 
function randoVideo() {
  var videos = ["https://www.youtube.com/embed/7vFCA2EVxbo", "https://www.youtube.com/embed/5pOZ9L5cr00", "https://www.youtube.com/embed/hpGVW3PWJeE", "https://www.youtube.com/embed/p98MzO8APqE", "https://www.youtube.com/embed/cA76r-pZtIs", "https://www.youtube.com/embed/P_w_SxRu7ZU", "https://www.youtube.com/embed/e2bqG60DItQ", "https://www.youtube.com/embed/GlT-MwZb2Gg"];
  function loadRandom() {
    var playerDiv = document.getElementById("rando_player");
    var player = document.createElement("iframe");
    var randomVidUrl = videos[Math.floor(Math.random() * videos.length)];
    player.setAttribute('width', '100%');
    player.setAttribute('height', '140');
    player.setAttribute('src', randomVidUrl);
    player.setAttribute('frameborder', '0');
    playerDiv.appendChild(player);
  }

  window.addEventListener('load', function () { loadRandom(); });
  document.getElementById("reload").addEventListener("click", function () {
    $('#rando_player').html('');
    loadRandom();
  })
  ;
}
// api call that gets the forecast for the next five days
let dayDetails = [];
function fiveDay() {
  fetch('https://api.openweathermap.org/data/2.5/forecast?lat=' + lat + '&lon=' + lon + '&appid=' + apiKey + '&units=imperial')
    .then(function (response) {
      return (response.json())
    })
    .then(function (five) {
      $('#forecastBox').html('');
      dayDetails = [];
      for (let i = 0; i != five.list.length; i += 8) {
        let aDate = five.list[i].dt_txt;
        let bDate = aDate.slice(0, 10);
        let fiveDate = moment(bDate).format('MM/DD/YY');
        // gather entries for this day (up to 8 items, 3-hour intervals)
        const dayEntries = five.list.slice(i, i + 8);
        dayDetails.push(dayEntries);

        // pick representative values for summary
        let aTemp = dayEntries[0].main.temp;
        let bTemp = Math.floor(aTemp);
        let aIcon = dayEntries[0].weather[0].icon;
        let bIcon = 'https://openweathermap.org/img/wn/' + aIcon + '@2x.png';
        // svg fallback data URL for cases where the icon host fails (certificate/network)
        const svgFallback = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="none"/><circle cx="32" cy="24" r="12" fill="#FFD54F"/><text x="32" y="48" font-size="14" text-anchor="middle" fill="#000">' + (dayEntries[0].weather[0].icon || '') + '</text></svg>');
        // compute max wind for the day to determine advisory color
        let maxWind = 0;
        for (const e of dayEntries) { if (e.wind && e.wind.speed > maxWind) maxWind = e.wind.speed; }
        let advisoryClass = '';
        if (maxWind > 9) {
          advisoryClass = "highWind";
        } else if (maxWind > 5) {
          advisoryClass = "cautionWind";
        } else {
          advisoryClass = "lowWind";
        }

        // build simplified clickable card
        const $img = $("<img>").attr('src', bIcon).attr('alt', dayEntries[0].weather[0].description || 'weather').on('error', function () { this.onerror = null; this.src = svgFallback; });
        const $summary = $("<div>").addClass('day-summary').append($("<span>").addClass('temp').text(bTemp + '°F')).append($("<span>").addClass('wind').text(' • ' + maxWind + ' m/s'));
        const $cardInner = $("<div>").addClass('uk-card uk-card-body ' + advisoryClass + ' day-card').attr('data-day-index', dayDetails.length - 1).append($("<h5>").text(fiveDate)).append($img).append($summary);
        // add explicit Details button for clarity
        const $detailsBtn = $("<button>").addClass('details-btn').text('Details').attr('data-day-index', dayDetails.length - 1);
        $cardInner.append($detailsBtn);
        const $card = $("<div>").addClass('day-wrapper').append($cardInner);
        $("#forecastBox").append($card);
      }
    })
    .catch(function(err){ console.error('fiveDay error', err); });
}

// click handler for day cards (delegated)
// show details for a selected day index
async function showDayDetails(idx) {
  if (idx === undefined || dayDetails.length === 0) return;
  const entries = dayDetails[idx];
  try {
    const resp = await fetch('https://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon=' + lon + '&appid=' + apiKey + '&units=imperial');
    const current = resp.ok ? await resp.json() : null;
    let content = '<div style="text-align:left; max-height:70vh; overflow:auto; padding:6px;">';
    if (current) {
      content += '<h3>Current Conditions</h3>';
      content += '<p><strong>' + (current.name || 'Current Location') + '</strong> - ' + (current.weather && current.weather[0] ? current.weather[0].description : '') + '</p>';
      content += '<p>Temp: ' + Math.round(current.main.temp) + ' °F • Wind: ' + current.wind.speed + ' m/s • Humidity: ' + current.main.humidity + '%</p>';
    }
    content += '<hr><h3>Forecast for ' + moment(entries[0].dt_txt.slice(0,10)).format('MM/DD/YY') + '</h3>';
    content += '<ul>';
    for (const it of entries) {
      const time = it.dt_txt.slice(11,16);
      content += '<li>' + time + ' — ' + (it.weather && it.weather[0] ? it.weather[0].description : '') + ' • Temp: ' + Math.round(it.main.temp) + ' °F • Wind: ' + it.wind.speed + ' m/s</li>';
    }
    content += '</ul>';
    content += '</div>';
    showDialog(content);
  } catch (err) {
    console.error('showDayDetails error', err);
    showAlert('Unable to load details.');
  }
}

// wire clicks for card body and details button to show details
$(document).on('click', '.day-card, .details-btn', function (e) {
  const idx = $(this).data('day-index');
  // if clicking the inner details button, its data attribute may be on the button
  const fromParent = $(this).closest('[data-day-index]').data('day-index');
  const dayIdx = (typeof idx !== 'undefined') ? idx : fromParent;
  if (typeof dayIdx === 'undefined') return;
  showDayDetails(dayIdx);
});
randoVideo();
// allows you to select a past used zipcode to submit
function pastZip(e) {
  document.getElementById("userInput").value = e.target.value
}
//load localStorage into select menu on page loadup
function loadLocalStorage() {
  $("#dropDownBox").html('')
  const zipcode = JSON.parse(localStorage.getItem("zipcode")) || [];
  for (var i = 0; i < zipcode.length; i++) {
    $("#dropDownBox").append("<option id='options' value=" + zipcode[i] + ">" + zipcode[i] + "</option>");
  }
}
// will clear localStorage, dropdown box, reload page to remove weather and reset map 
$("#clearLocal").click(function () {
  $("#dropDownBox").html('');
  location.reload();
  localStorage.clear();
})

loadLocalStorage();

// Resilient menu toggle used as an inline fallback and by event handlers
function toggleMenu(e) {
  try {
    const btn = document.getElementById('menuButton');
    const dd = document.getElementById('menuDropdown');
    if (!btn || !dd) return;
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const isOpen = dd.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen);
    dd.setAttribute('aria-hidden', !isOpen);
  } catch (err) {
    console.warn('toggleMenu failed', err);
  }
}

// Resilient dialog helper: prefer UIkit, otherwise create a simple modal node
function showDialog(htmlContent) {
  try {
    if (window.UIkit && UIkit.modal && typeof UIkit.modal.dialog === 'function') {
      UIkit.modal.dialog(htmlContent);
      return;
    }
  } catch (err) {
    console.warn('UIkit dialog failed, falling back', err);
  }
  // Fallback: create a minimal dialog
  try {
    const overlay = document.createElement('div');
    overlay.className = 'fallback-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0'; overlay.style.top = '0'; overlay.style.right = '0'; overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,0.6)'; overlay.style.zIndex = '99999';
    overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';
    const dialog = document.createElement('div');
    dialog.className = 'fallback-modal';
    dialog.style.maxWidth = '920px'; dialog.style.width = '92%'; dialog.style.maxHeight = '80vh'; dialog.style.overflow = 'auto';
    dialog.style.background = 'linear-gradient(180deg, rgba(22,30,40,0.98), rgba(12,18,26,0.98))';
    dialog.style.color = '#fff'; dialog.style.padding = '18px'; dialog.style.borderRadius = '12px'; dialog.style.boxShadow = '0 30px 80px rgba(0,0,0,0.65)';
    dialog.innerHTML = '<button class="fallback-close" style="position:absolute;right:14px;top:10px;background:transparent;border:none;color:#fff;font-size:18px;">✕</button>' + htmlContent;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    overlay.querySelector('.fallback-close').addEventListener('click', function () { document.body.removeChild(overlay); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) document.body.removeChild(overlay); });
  } catch (err) {
    // final fallback: alert
    try { window.alert((htmlContent || '').replace(/<[^>]+>/g, '')); } catch (e) { console.error('Fallback dialog failed', e); }
  }
}

function showAlert(text) { showDialog('<p>' + (text || '') + '</p>'); }

function escapeHtml(unsafeText) {
  return String(unsafeText || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function closeOpenDialogs() {
  // UIkit modal
  try {
    const openModal = document.querySelector('.uk-modal.uk-open');
    if (openModal && window.UIkit && UIkit.modal) {
      UIkit.modal(openModal).hide();
    }
  } catch (err) {
    // ignore
  }
  // Fallback modal
  try {
    const overlay = document.querySelector('.fallback-modal-overlay');
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  } catch (err) {
    // ignore
  }
}

function openSupportForm() {
  const html =
    '<h3>Support</h3>' +
    '<form id="supportForm">' +
    '<label for="supportFirstName">First name</label>' +
    '<input type="text" id="supportFirstName" name="firstName" />' +
    '<label for="supportLastName">Last name</label>' +
    '<input type="text" id="supportLastName" name="lastName" />' +
    '<label for="supportEmail">Email</label>' +
    '<input type="email" id="supportEmail" name="email" />' +
    '<label for="supportPhone">Phone</label>' +
    '<input type="tel" id="supportPhone" name="phone" />' +
    '<label for="supportTrouble">Trouble detail</label>' +
    '<textarea id="supportTrouble" name="troubleDetail" rows="4"></textarea>' +
    '<div style="margin-top:10px; display:flex; gap:8px; justify-content:flex-end;">' +
    '<button type="submit" class="example_d">Submit</button>' +
    '</div>' +
    '</form>';

  showDialog(html);
}

const SITE_DESCRIPTION_TEXT =
  'Drones are categorized as Unmanned Aircraft Systems (UAS), which with other kinds of aircraft systems are becoming highly available in almost all major electronic retail stores and online marketers. ' +
  'Every user of such technology, be it for business purposes or personal use, desires operating them whenever, wherever and most especially, making safe operation a priority. ' +
  'Conversely, it is very easy to pick one up from the shelf for use by prospective operators, but without the awareness that, you can\'t just fly or operate them anytime nor anywhere. ' +
  'When-To-Fly is a website inspired by a group of University of Texas at Austin Coding BootCamp students, that provides drone users/operators with all the guidance and information required for responsible and safe operation.';

// Top-right menu behavior: toggle dropdown and handle link placeholders
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('menuButton');
  const dd = document.getElementById('menuDropdown');
  if (!btn || !dd) return;

  // Guard against double-binding (there used to be multiple init paths)
  if (btn.dataset.menuInit) return;

  const siteDesc = document.getElementById('siteDescriptionContent');

  // Single source of truth for toggling
  btn.addEventListener('click', toggleMenu);

  // Close the menu when clicking outside
  document.addEventListener('click', function () {
    if (dd.classList.contains('open')) {
      dd.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      dd.setAttribute('aria-hidden', 'true');
    }
  });

  // Placeholder handlers for menu items
  const aboutLink = document.getElementById('aboutLink');
  if (aboutLink) {
    aboutLink.addEventListener('click', function (e) {
      e.preventDefault();
      const html = siteDesc
        ? siteDesc.innerHTML
        : '<h3 class="uk-card-title">Site Description</h3><p>' + escapeHtml(SITE_DESCRIPTION_TEXT) + '</p>';
      showDialog('<div style="text-align:left;">' + html + '</div>');
      // close menu
      dd.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      dd.setAttribute('aria-hidden', 'true');
    });
  }
  const supportLink = document.getElementById('supportLink');
  if (supportLink) {
    supportLink.addEventListener('click', function (e) {
      e.preventDefault();
      openSupportForm();
      dd.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      dd.setAttribute('aria-hidden', 'true');
    });
  }

  // Load initial five-day forecast beneath Wind Advisory
  $('#forecastBox').html('');
  fiveDay();

  btn.dataset.menuInit = '1';

});

// Handle support form submission (works for both UIkit dialog and fallback dialog)
document.addEventListener('submit', function (e) {
  try {
    const form = e.target;
    if (!form || form.id !== 'supportForm') return;
    e.preventDefault();

    const firstName = (form.querySelector('[name="firstName"]') || {}).value || '';
    const lastName = (form.querySelector('[name="lastName"]') || {}).value || '';
    const email = (form.querySelector('[name="email"]') || {}).value || '';
    const phone = (form.querySelector('[name="phone"]') || {}).value || '';
    const troubleDetail = (form.querySelector('[name="troubleDetail"]') || {}).value || '';

    const to = 'sahrk.83@yahoo.com';
    const subject = 'Flight Time Support Request';
    const bodyLines = [
      'Support request submitted from Flight Time',
      '',
      'First name: ' + firstName,
      'Last name: ' + lastName,
      'Email: ' + email,
      'Phone: ' + phone,
      '',
      'Trouble detail:',
      troubleDetail,
      ''
    ];

    const mailtoUrl =
      'mailto:' + encodeURIComponent(to) +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(bodyLines.join('\n'));

    // Close modal before opening email client to avoid UI overlap
    closeOpenDialogs();

    // Open the user's email client with a pre-filled message
    window.location.href = mailtoUrl;

    showAlert('Your email client will open with the support request. Click Send to email support.');
  } catch (err) {
    console.error('supportForm submit handler failed', err);
  }
});


