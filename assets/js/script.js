// API Key openweather
const apiKey = "b773ba3167fd9791028d0f0f123759cc";
// Default view for map of the North American continent.
mapboxgl.accessToken = 'pk.eyJ1IjoibWVsbGlzMTAyMzk2IiwiYSI6ImNrbXVwcDhhNjEzeXEyd3E1cmdjOWc0emwifQ.Jusfg2NUaXj_tZbA899ZSg';
var map = new mapboxgl.Map({
  container: 'map', // container id
  style: 'mapbox://styles/mellis102396/ckmups1cn4s5e17nosaokzhl8', // style URL
  center: [-95.665, 37.6], // starting position [lng, lat]
  zoom: 2 // starting zoom
});
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
  let locSearch = zipInput
  fetch('https://public.opendatasoft.com/api/records/1.0/search/?dataset=us-zip-code-latitude-and-longitude&q=' + locSearch + '&facet=state&facet=timezone&facet=dst')
    // function converted via VSC suggestion
    .then(response => response.json())
    .then(function (data) {
      console.log(data);
      if (data.records.length > 0) {
        lon = data.records[0].geometry.coordinates[0]
        lat = data.records[0].geometry.coordinates[1]
        mapZipDisplay();
        fiveDay();
      } else {
        UIkit.modal.dialog('<p>Please Enter a Valid ZIP code!</p>');
      }
    })
    .catch(err => {
      console.error(err)
    })
}
// Adjusts the map to the users current location via zip with an adjusted zoom level.
// Includes Api key for map 
function mapZipDisplay() {
  areaUpdate();
  function areaUpdate() {
    mapboxgl.accessToken = 'pk.eyJ1IjoibWVsbGlzMTAyMzk2IiwiYSI6ImNrbXVwcDhhNjEzeXEyd3E1cmdjOWc0emwifQ.Jusfg2NUaXj_tZbA899ZSg';
    var map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mellis102396/ckmups1cn4s5e17nosaokzhl8',
      center: [lon, lat],
      zoom: 11
    });
    map.addControl(
      new MapboxDirections({
        accessToken: mapboxgl.accessToken
      }),
      'top-left'
    );
  }
}
// Random drone tips video on page reload. 
function randoVideo() {
  var videos = ["https://www.youtube.com/embed/7vFCA2EVxbo", "https://www.youtube.com/embed/5pOZ9L5cr00", "https://www.youtube.com/embed/hpGVW3PWJeE", "https://www.youtube.com/embed/p98MzO8APqE", "https://www.youtube.com/embed/cA76r-pZtIs", "https://www.youtube.com/embed/P_w_SxRu7ZU", "https://www.youtube.com/embed/e2bqG60DItQ", "https://www.youtube.com/embed/GlT-MwZb2Gg"];
  window.onload = function () {
    var playerDiv = document.getElementById("rando_player");
    var player = document.createElement("iframe");
    var randomVidUrl = videos[Math.floor(Math.random() * videos.length)];
    player.setAttribute('width', '100%');
    player.setAttribute('height', '310');
    player.setAttribute('src', randomVidUrl);
    playerDiv.appendChild(player);
    document.getElementById("reload").addEventListener("click", function () {
      $('#rando_player').html('');
      onload();
    })
  };
}
// api call that gets the forecast for the next five days
function fiveDay() {
  fetch('https://api.openweathermap.org/data/2.5/forecast?lat=' + lat + '&lon=' + lon + '&appid=' + apiKey + '&units=imperial')
    .then(function (response) {
      return (response.json())
    })
    .then(function (five) {
      for (let i = 0; i != five.list.length; i += 8) {
        let aDate = five.list[i].dt_txt;
        let bDate = aDate.slice(0, 10);
        let fiveDate = moment(bDate).format('MM/DD/YY');
        let aTemp = five.list[i].main.temp;
        let bTemp = Math.floor(aTemp);
        let aIcon = five.list[i].weather[0].icon;
        let bIcon = 'https://openweathermap.org/img/w/' + aIcon + '.png';
        let wind = five.list[i].wind.speed;
        let test = '';
        if (wind > 9) {
          test = "highWind"
        } else if (wind > 5) {
          test = "cautionWind"
        } else {
          test = "lowWind"
        }
        $("#forcastBox").append('<div><div class="uk-card uk-card-body ' + test  + '"><h5>' + fiveDate + '</h5><img src=' + bIcon + '><p>Temp: ' + bTemp + ' °F</p><p>Wind: ' + wind + ' m/s</p></div></div>')
      }
    })
}
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


