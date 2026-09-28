$(window).on('load', function() {
  var documentSettings = {};

  const CHAPTER_ZOOM = 5;

  $.get('csv/Options.csv', function(options) {

    $.get('csv/Chapters.csv', function(chapters) {
      initMap(
        $.csv.toObjects(options),
        $.csv.toObjects(chapters)
      )
    }).fail(function(e) { alert('Found Options.csv, but could not read Chapters.csv') });

  }).fail(function(e) {

    var parse = function(res) {
      return Papa.parse(Papa.unparse(res[0].values), {header: true} ).data;
    }

    if (typeof googleDocURL !== 'undefined' && googleDocURL) {

      if (typeof googleApiKey !== 'undefined' && googleApiKey) {

        var apiUrl = 'https://sheets.googleapis.com/v4/spreadsheets/'
        var spreadsheetId = googleDocURL.split('/d/')[1].split('/')[0];

        $.when(
          $.getJSON(apiUrl + spreadsheetId + '/values/Options?key=' + googleApiKey),
          $.getJSON(apiUrl + spreadsheetId + '/values/Chapters?key=' + googleApiKey),
        ).then(function(options, chapters) {
          initMap(parse(options), parse(chapters))
        })

      } else {
        alert('You load data from a Google Sheet, you need to add a free Google API key')
      }

    } else {
      alert('You need to specify a valid Google Sheet (googleDocURL)')
    }

  })
  function createDocumentSettings(settings) {
    for (var i in settings) {
      var setting = settings[i];
      documentSettings[setting.Setting] = setting.Customize;
    }
  }
  function getSetting(s) {
    return documentSettings[constants[s]];
  }
  function trySetting(s, def) {
    s = getSetting(s);
    if (!s || s.trim() === '') { return def; }
    return s;
  }


/*---------------------------------------------------*/

  function initMap(options, chapters) {
    createDocumentSettings(options);

    var chapterContainerMargin = 70;

    document.title ='GeoTy';
    $('#header').append('<img src="media/poty.png" width="250px" height=auto >');
    $('#header').append('<h2><small style="font-size: 11pt; margin:10px;"> Em uma jornada pela história de Curitiba, exploraremos como o saneamento e a mobilidade moldaram o crescimento da cidade ao longo do tempo. Viajaremos através dos anos, explorando mapas históricos e descobrindo como o artista Poty retratou essa narrativa em suas obras, que permeiam toda a cidade.<br><div class="arrow"><span></span><span></span><span></span></div></small></h2>');
    addBaseMap();

    if (getSetting('_zoomControls') !== 'off') {
      L.control.zoom({
        position: getSetting('_zoomControls')
      }).addTo(map);
    }

    var markers = [];
    var lines = [];
    var latlngs = [];

    var markActiveColor = function(k) {

      for (var i = 0; i < markers.length; i++) {
        if (markers[i] && markers[i]._icon) {
          markers[i]._icon.className = markers[i]._icon.className.replace(' marker-active', '');

          if (i == k) {

            markers[k]._icon.className += ' marker-active';
          }
        }
      }
    };

    var pixelsAbove = [];
    var chapterCount = 0;
    var currentlyInFocus; 
    var overlay;   
    var overlay2;   
    var geoJsonOverlay;

for (i in chapters) {
  var c = chapters[i];

  if (!isNaN(parseFloat(c['Latitude'])) && !isNaN(parseFloat(c['Longitude']))) {
    var lat = parseFloat(c['Latitude']);
    var lon = parseFloat(c['Longitude']);
    chapterCount += 1;
    
    var icon;
    switch (chapterCount) {
      case 1:
        icon = araucIcon;
        break;
      case 2:
        icon = tropeirosIcon;
        break;
      case 3:
        icon = chafarizIcon;
        break;
      case 4:
        icon = tuboIcon;
        break;
      case 5:
        icon = jacareIcon;
        break;
      default:
        icon = arauc2Icon;
    }

    markers.push(
      L.marker([lat, lon], {
        icon: icon,
        opacity: c['Marker'] = 0.9,
        interactive: c['Marker'] = true,
      })
    );


    
    latlngs.push([lat, lon]);

      }

  var container = $('<div></div>', {
    id: 'container' + i,
    class: 'chapter-container'
  });

  // Add media and credits: YouTube, audio, or image
  var media = null;
  var mediaContainer = null;

  // Add media source
  var source = '';
  if (c['Media Credit Link']) {
    source = $('<a>', {
      text: c['Media Credit'],
      href: c['Media Credit Link'],
      target: "_blank",
      class: 'source'
    });
  } else {
    source = $('<span>', {
      text: c['Media Credit'],
      class: 'source'
    });
  }

  // YouTube
  if (c['Media Link'] && c['Media Link'].indexOf('youtube.com/') > -1) {
    media = $('<iframe></iframe>', {
      src: c['Media Link'],
      width: '100%',
      height: '100%',
      frameborder: '0',
      allow: 'autoplay; encrypted-media',
      allowfullscreen: 'allowfullscreen',
    });

    mediaContainer = $('<div></div>', {
      class: 'img-container'
    }).append(media).after(source);
  }

  // If not YouTube: either audio or image
  var mediaTypes = {
    'jpg': 'img',
    'jpeg': 'img',
    'png': 'img',
    'tiff': 'img',
    'geotiff': 'img',
    'gif': 'img',
    'mp3': 'audio',
    'ogg': 'audio',
    'wav': 'audio',
  }

  var mediaExt = c['Media Link'] ? c['Media Link'].split('.').pop().toLowerCase() : '';
  var mediaType = mediaTypes[mediaExt];

  if (mediaType) {
    media = $('<' + mediaType + '>', {
      src: c['Media Link'],
      controls: mediaType === 'audio' ? 'controls' : '',
      alt: c['Chapter']
    });

    var enableLightbox = getSetting('_enableLightbox') === 'yes' ? true : false;
    if (enableLightbox && mediaType === 'img') {
      var lightboxWrapper = $('<a></a>', {
        'data-lightbox': c['Media Link'],
        'href': c['Media Link'],
        'data-title': c['Chapter'],
        'data-alt': c['Chapter'],
      });
      media = lightboxWrapper.append(media);
    }

    mediaContainer = $('<div></div', {
      class: mediaType + '-container'
    }).append(media).after(source);
  }

  container
    .append('<p class="chapter-header">' + c['Chapter'] + '</p>')
    .append(media ? mediaContainer : '')
    .append(media ? source : '')
    .append('<p class="description">' + c['Description'] + '</p>');

  $('#contents').append(container);

}
    changeAttribution();

    imgContainerHeight = parseInt(getSetting('_imgContainerHeight'));
    if (imgContainerHeight > 0) {
      $('.img-container').css({
        'height': imgContainerHeight + 'px',
        'max-height': imgContainerHeight + 'px',
      });
    }

    pixelsAbove[0] = 70;
    for (i = 1; i < chapters.length; i++) {
      pixelsAbove[i] = pixelsAbove[i-1] + $('div#container' + (i-1)).height() + chapterContainerMargin;
    }
    pixelsAbove.push(Number.MAX_VALUE);

    var currentMarkers = [];
    var currentPolyline = null;

    $('div#contents').scroll(function() {
      var currentPosition = $(this).scrollTop();

      if (currentPosition < 350) {
        $('#title').css('display', currentPosition > 20 ? 'none' : 'block');
      }

      for (var i = 0; i < pixelsAbove.length - 1; i++) {
        if (currentPosition >= pixelsAbove[i]
          && currentPosition < (pixelsAbove[i+1] - 2 * chapterContainerMargin)
          && currentlyInFocus != i
        ) {
          console.log("Changing to chapter:", i);

          // Remover markers e polyline anteriores
          currentMarkers.forEach(function(marker) {
            map.removeLayer(marker);
          });
          currentMarkers = [];
          if (currentPolyline) {
            map.removeLayer(currentPolyline);
          }

          // Adicionar markers e polyline para o capítulo atual
          var lineLatLngs = latlngs.slice(0, i + 1);
          if (lineLatLngs.length > 0) {
            lineLatLngs.forEach(function(latlng, index) {
              var marker = markers[index];
              if (!map.hasLayer(marker)) {
                marker.addTo(map);
              }
              currentMarkers.push(marker);
            });

            if (lineLatLngs.length > 1) {
              currentPolyline = L.polyline(lineLatLngs, { color: 'black', weight: 2 }).addTo(map);
            }
          }

          location.hash = i + 1;
          $('.chapter-container').removeClass("in-focus").addClass("out-focus");
          $('div#container' + i).addClass("in-focus").removeClass("out-focus");

          currentlyInFocus = i;
          markActiveColor(currentlyInFocus);

          if (overlay && map.hasLayer(overlay)) {
            map.removeLayer(overlay);
            console.log("Removed existing tile overlay");
          }
          if (overlay2 && map.hasLayer(overlay2)) {
            map.removeLayer(overlay2);
            console.log("Removed existing tile overlay");
          }
          var c = chapters[i];

          if (c['Overlay']) {
            var opacity = parseFloat(c['Overlay Transparency']) || 1;
            var url = 'https://idea.ufpr.br/geoserver/ows';
            var wmsLayers = c['Layers'];
            if (url && wmsLayers) {
              overlay = L.tileLayer.wms(url, {
                layers: wmsLayers,
                format: 'image/png',
                transparent: true,
                opacity: 0.8
              }).addTo(map);
              console.log("Added WMS tile overlay for chapter:", i);
            } else {
              overlay = L.tileLayer(c['Overlay'], { opacity: opacity }).addTo(map);
              console.log("Added tile overlay for chapter:", i);
            }
          }

          var c = chapters[i];

          if (c['Overlay2']) {
            var url2 = 'https://idea.ufpr.br/geoserver/ows';
            var wmsLayers2 = c['Layers2'];
            if (url2 && wmsLayers2) {
              overlay2 = L.tileLayer.wms(url2, {
                layers: wmsLayers2,
                format: 'image/png',
                transparent: true,
                opacity: 0.8
              }).addTo(map);
              console.log("Added WMS tile overlay for chapter:", i);
            } else if (c['Overlay2'].endsWith('.geojson')) {
              fetch(c['Overlay2'])
                .then(response => response.json())
                .then(data => {
                  overlay2 = L.geoJSON(data, {
                    style: function (feature) {
                      return { color: '#ff7800', weight: 2, opacity: 0.65 };
                    }
                  }).addTo(map);
                  console.log("Added GeoJSON overlay for chapter:", i);
                })
                .catch(error => console.log("Error loading GeoJSON overlay:", error));
            } else {
              overlay2 = L.tileLayer(c['Overlay2'], { opacity: opacity }).addTo(map);
              console.log("Added tile overlay for chapter:", i);
            }
          }


        if (c['Latitude'] && c['Longitude']) {
          var zoom = c['Zoom'] ? c['Zoom'] : CHAPTER_ZOOM;
          map.flyTo([c['Latitude'], c['Longitude']], zoom, {
            animate: true,
            duration: 2, // default is 2 seconds
          });
          console.log("Moved map to chapter location:", [c['Latitude'], c['Longitude']]);
        }

        // Não precisa iterar pelos capítulos seguintes
        break;
        }
      }
    });

    $('#contents').append(" \
      <div class='final'> \
        <div><a ><br><img src='https://images.prismic.io/museuoscarniemeyer/8a2a0a7c-134a-4b74-8c38-587f32849a97_Colecao-Poty__DSC0278+copiar.jpg' width='380px' height='auto' alt='Logo'></a><br></div>\
        <div id='final-text'><br>Trilhos e Traços - Poty 100 anos <br> Visite a mostra que reúne aproximadamente 500 obras, um recorte da doação de 4 mil peças realizada pela família do artista ao Museu, em 2022, e estará disponível ao público. <br> </div>\
        <div><br></div>\
        <div id='button'><a href='https://www.museuoscarniemeyer.org.br/exposicoes/trilhosetracos-poty-100-anos' class='button'><img src='media/MON.svg' width='50px' height='auto' alt='Logo'></a></div>\
        <div><br></div>\
        <div ><br>Conheça mais obras do Poty localizadas por Curitiba no mapa GeoTy.<br> </div>\
        <div><br></div>\
        <div id='button'><a href='geotymap.html' class='button'><img src='media/TCC2.png' width='50px' height='auto' alt='Logo'></a></div>\
        <div id='space-at-the-bottom'>\
          <a href='#top'>\
            <span class='to-top'></span><br>\
            <small>Voltar ao início</small>\
          </a>\
        </div>\
      </div>\
    ");

    let button = document.getElementById("button");
    button.addEventListener('mousemove', (e) => {
        x = e.offsetX;
        y = e.offsetY;
        button.style.setProperty('--mouse-x', x + "px");
        button.style.setProperty('--mouse-y', y + "px");
    });
    $("<style>")
      .prop("type", "text/css")
      .html("\
      #narration, #title {\
      background: " + trySetting('_narrativeBackground', '#efebd6 url("https://www.transparenttextures.com/patterns/batthern.png")') + "; \
      color: " + trySetting('_narrativeText', 'black') + "; \
      }\
      a, a:visited, a:hover {\
      color: " + trySetting('_narrativeLink', 'black') + "; \
      }\
      .in-focus {\
      background-color: " + trySetting('_narrativeActive', 'rgba(233, 229, 209, 0.7)') +  "; \
      }")
      .appendTo("head");

    endPixels = parseInt(getSetting('_pixelsAfterFinalChapter'));
    if (endPixels > 100) {
      $('#space-at-the-bottom').css({
        'height': (endPixels / 4) + 'px',
        'padding-top': (endPixels / 4) + 'px',
      });
    }

    var bounds = [];
    for (i in markers) {
      if (markers[i]) {
        markers[i]['_pixelsAbove'] = pixelsAbove[i];
        markers[i].on('click', function() {
          var pixels = parseInt($(this)[0]['_pixelsAbove']) + 5;
          $('div#contents').animate({
            scrollTop: pixels + 'px'});
        });
        bounds.push(markers[i].getLatLng());
      }
    }

    map.fitBounds(bounds);

    $('#map, #narration, #title').css('visibility', 'visible');
    $('div.loader').css('visibility', 'hidden');

    $('div#container0').addClass("in-focus");
    $('div#contents').animate({scrollTop: '1px'});

    // On first load, check hash and if it contains an number, scroll down
    if (parseInt(location.hash.substr(1))) {
      var containerId = parseInt( location.hash.substr(1) ) - 1;
      $('#contents').animate({
        scrollTop: $('#container' + containerId).offset().top
      }, 2000);
    }

    // Add Google Analytics if the ID exists
    var ga = getSetting('_googleAnalytics');
    if ( ga && ga.length >= 10 ) {
      var gaScript = document.createElement('script');
      gaScript.setAttribute('src','https://www.googletagmanager.com/gtag/js?id=' + ga);
      document.head.appendChild(gaScript);

      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', ga);
    }
  }

 function addBaseMap() {
  var mapboxUrl = 'https://api.mapbox.com/styles/v1/lbencz/clw6n5q530c5p01pk10p54u70/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoibGJlbmN6IiwiYSI6ImNsZGVuZDJudzBhdDgzb3FiY3N6eDBhaXgifQ.78HzulaJ8rRPgX0bxND9zg';
  var mapboxLayer = L.tileLayer(mapboxUrl, {
    attribution: 'Code adapted <a href="https://github.com/HandsOnDataViz/leaflet-storymaps-with-google-sheets">GitHub</a> '+
                 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> ' +
                 'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>' + ' By Lilian Bencz',
    maxZoom: 20
  });
  mapboxLayer.addTo(map);
  }

  function changeAttribution() {
    var attributionHTML = $('.leaflet-control-attribution')[0].innerHTML;
  }

});