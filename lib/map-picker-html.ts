// Builds a self-contained Leaflet map page for picking a lat/lng by tapping
// or dragging a marker. The page posts { lat, lng } back to the host via
// window.ReactNativeWebView.postMessage (native) or window.parent.postMessage
// (web iframe) on every marker move, so the host always has the latest pick.
export function buildMapPickerHtml(
  initialLat: number,
  initialLng: number
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    function postToHost(data) {
      var payload = JSON.stringify(data);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(payload);
      } else if (window.parent) {
        window.parent.postMessage(payload, "*");
      }
    }

    var map = L.map("map").setView([${initialLat}, ${initialLng}], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    var marker = L.marker([${initialLat}, ${initialLng}], { draggable: true }).addTo(map);

    function emitPosition(latlng) {
      postToHost({ lat: latlng.lat, lng: latlng.lng });
    }

    marker.on("dragend", function (e) {
      emitPosition(e.target.getLatLng());
    });

    map.on("click", function (e) {
      marker.setLatLng(e.latlng);
      emitPosition(e.latlng);
    });

    emitPosition(marker.getLatLng());
  </script>
</body>
</html>`;
}
