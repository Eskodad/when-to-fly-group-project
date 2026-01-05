// API Key openweather
const apiKey = "b773ba3167fd9791028d0f0f123759cc";
// Default coordinates (center of USA) so forecast loads on page open
let lat = 37.6;
let lon = -95.665;
// Default view for map of the North American continent.
mapboxgl.accessToken = 'pk.eyJ1IjoibWVsbGlzMTAyMzk2IiwiYSI6ImNrbXVwcDhhNjEzeXEyd3E1cmdjOWc0emwifQ.Jusfg2NUaXj_tZbA899ZSg';
var map = new mapboxgl.Map({
  container: 'map', // container id
  style: 'mapbox://styles/mellis102396/ckmups1cn4s5e17nosaokzhl8', // style URL
  center: [-95.665, 37.6], // starting position [lng, lat]
  zoom: 2 // starting zoom
});
// track whether directions control has been added to avoid duplicates
let directionsAdded = false;
// Will take input from user to zero in on map to users location
$("#subButton").click(function (e) {
  zipper = $("#userInput").val();
  zipInput = parseInt(zipper)
  // Stores last used zipcode in local storage also prevents duplicates in dropdown.
  const zipcode = JSON.parse(localStorage.getItem("zipcode")) || [];
  const savedZip = zipInput;
  if (isNaN(zipInput)) {
    UIkit.modal.dialog('<p>Please Enter a Valid ZIP code!</p>');
    $("#userInput").val('');
  } else {
    if (zipcode.includes(savedZip) === false) {
      zipcode.push(savedZip);
      localStorage.setItem("zipcode", JSON.stringify(zipcode));
    }
    zipLookUp(zipInput);
    loadLocalStorage();
    $("#userInput").val('');
    $('#forcastBox').html('');
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
        UIkit.modal.dialog('<p>Please Enter a Valid ZIP code!</p>');
      }
    })
    .catch(err => {
      console.error('zipLookUp error:', err);
      UIkit.modal.dialog('<p>Unable to look up ZIP code. Please try again later.</p>');
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
      $('#forcastBox').html('');
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

        // build clickable card
        const $card = $("<div>").addClass('day-wrapper').append(
          $("<div>")
            .addClass('uk-card uk-card-body ' + advisoryClass + ' day-card')
            .attr('data-day-index', dayDetails.length - 1)
            .append($("<h5>").text(fiveDate))
            .append($("<img>").attr('src', bIcon))
            .append($("<p>").text('Temp: ' + bTemp + ' °F'))
            .append($("<p>").text('Max Wind: ' + maxWind + ' m/s'))
        );

        $("#forcastBox").append($card);
      }
    })
    .catch(function(err){ console.error('fiveDay error', err); });
}

// click handler for day cards (delegated)
$(document).on('click', '.day-card', function (e) {
  const idx = $(this).data('day-index');
  if (idx === undefined || dayDetails.length === 0) return;
  const entries = dayDetails[idx];

  // fetch current weather for the location for real-time data
  fetch('https://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon=' + lon + '&appid=' + apiKey + '&units=imperial')
    .then(resp => resp.json())
    .then(function (current) {
      let content = '<div style="text-align:left; max-height:60vh; overflow:auto;">';
      content += '<h3>Current Conditions</h3>';
      content += '<p><strong>' + (current.name || 'Current Location') + '</strong> - ' + (current.weather && current.weather[0] ? current.weather[0].description : '') + '</p>';
      content += '<p>Temp: ' + Math.round(current.main.temp) + ' °F • Wind: ' + current.wind.speed + ' m/s • Humidity: ' + current.main.humidity + '%</p>';

      content += '<hr><h3>Forecast for ' + moment(entries[0].dt_txt.slice(0,10)).format('MM/DD/YY') + '</h3>';
      content += '<ul>';
      for (const it of entries) {
        const time = it.dt_txt.slice(11,16);
        content += '<li>' + time + ' — ' + (it.weather && it.weather[0] ? it.weather[0].description : '') + ' • Temp: ' + Math.round(it.main.temp) + ' °F • Wind: ' + it.wind.speed + ' m/s</li>';
      }
      content += '</ul>';
      content += '</div>';

      UIkit.modal.dialog(content);
    })
    .catch(function (err) {
      console.error('current weather fetch error', err);
      UIkit.modal.dialog('<p>Unable to fetch current weather details.</p>');
    });
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

// Top-right menu behavior: toggle dropdown and handle link placeholders
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('menuButton');
  const dd = document.getElementById('menuDropdown');
  if (!btn || !dd) return;

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    const isOpen = dd.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen);
    dd.setAttribute('aria-hidden', !isOpen);
  });

  // Close the menu when clicking outside
  document.addEventListener('click', function () {
    if (dd.classList.contains('open')) {
      dd.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      dd.setAttribute('aria-hidden', 'true');
    }
  });

  // Placeholder handlers for menu items
  const loginLink = document.getElementById('loginLink');
  if (loginLink) loginLink.addEventListener('click', function (e) { e.preventDefault(); UIkit.modal.dialog('<p>Login flow placeholder.</p>'); });
  const subscribeLink = document.getElementById('subscribeLink');
  if (subscribeLink) subscribeLink.addEventListener('click', function (e) { e.preventDefault(); UIkit.modal.dialog('<p>Subscription placeholder.</p>'); });
  const supportLink = document.getElementById('supportLink');
  if (supportLink) supportLink.addEventListener('click', function (e) { e.preventDefault(); UIkit.modal.dialog('<p>Support placeholder.</p>'); });
  const settingsLink = document.getElementById('settingsLink');
  if (settingsLink) settingsLink.addEventListener('click', function (e) { e.preventDefault(); UIkit.modal.dialog('<p>Settings placeholder.</p>'); });

  // Load initial five-day forecast beneath Wind Advisory
  $('#forcastBox').html('');
  fiveDay();

});


