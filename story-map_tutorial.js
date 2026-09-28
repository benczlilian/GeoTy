var mapboxAccessToken = 'pk.eyJ1IjoibGJlbmN6IiwiYSI6ImNsZGVuZDJudzBhdDgzb3FiY3N6eDBhaXgifQ.78HzulaJ8rRPgX0bxND9zg';
var mapboxStyleId = 'lbencz/clw6n5q530c5p01pk10p54u70';

var map;
var scroller;
var markers = []; 
var overlays = []; 

var showLayers = true; 
var currentChapterIndex = -1; 

function initStoryMap(data) {
    var isMobile = (window.innerWidth <= 768) || (L.Browser.mobile);

    var startLat = 0;
    var startLon = -2;
    var startZoom = 12;

    if (data.length > 0) {
        startLat = parseFloat(data[0].Latitude.replace(',', '.'));
        startLon = parseFloat(data[0].Longitude.replace(',', '.'));
        startZoom = parseFloat(data[0].Zoom) || 12;
    }

    // MAPA
    map = L.map('map', {
        center: [startLat, startLon], 
        zoom: startZoom,
        scrollWheelZoom: false, 
        zoomControl: false,     
        dragging: !isMobile,
        tap: !isMobile,
        touchZoom: !isMobile
    });

    if (isMobile) {
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
        if (map.tap) map.tap.disable();
    }

    L.tileLayer(`https://api.mapbox.com/styles/v1/${mapboxStyleId}/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxAccessToken}`, {
        attribution: 'Lilian Bencz | Mapbox', maxZoom: 18, tileSize: 512, zoomOffset: -1
    }).addTo(map);

    L.control.zoom({ position: 'topleft' }).addTo(map);

    
    // Cria o container que agrupa os botões
    var controlsDiv = document.createElement('div');
    controlsDiv.id = 'floating-controls';
    controlsDiv.className = 'buttons-hidden'; // Começa escondido (na capa)
    document.body.appendChild(controlsDiv);

    // Cria o botão de Camadas
    var layerBtn = document.createElement('button');
    layerBtn.className = 'btn-floating btn-layer'; 
    layerBtn.innerHTML = 'Ver layers';
    layerBtn.onclick = function() {
        showLayers = !showLayers;
        if (showLayers) {
            layerBtn.classList.remove('layers-off');
            layerBtn.innerHTML = 'Ver layers';
        } else {
            layerBtn.classList.add('layers-off');
            layerBtn.innerHTML = 'Ocultar Camadas';
        }
        // Atualiza layer
        if (currentChapterIndex >= 0 && overlays[currentChapterIndex]) {
            var layer = overlays[currentChapterIndex].layerInstance;
            if (layer) {
                if (showLayers) {
                    if (!map.hasLayer(layer)) map.addLayer(layer);
                } else {
                    if (map.hasLayer(layer)) map.removeLayer(layer);
                }
            }
        }
    };
    
    controlsDiv.appendChild(layerBtn);


    var toggleBtn = document.getElementById('toggle-mode');
    if (toggleBtn) {
        // Remove classes antigas de posicionamento se houver
        toggleBtn.classList.add('btn-floating');
        controlsDiv.appendChild(toggleBtn);
    }
    // ------------------------------------------------

    var storyContainer = document.getElementById('story');
    var chapters = [];

    // HEADER
    var headerId = 'header-step';
    var headerDiv = document.createElement('div');
    headerDiv.setAttribute('id', headerId);
    headerDiv.classList.add('step'); 
    
    headerDiv.innerHTML = `
        <video id="video-piece-title-video" preload="auto" playsinline="" autoplay="" muted="" loop="" poster="">
            <source src="media_tutorial/abertura.mp4" type="video/mp4">
        </video>
        <div class="header-content">
            <img src="media_tutorial/logo.jpg" alt="" class="header-image">
            <h1> </h1>
            <p>História adaptada do Livro de Ana Maria Gonçalves. </p>
        </div>
        <div id="scroll-overlay"> Continue ↓ </div>
    `;
    storyContainer.insertBefore(headerDiv, storyContainer.firstChild);

    chapters.push({
        id: headerId,
        index: -1, 
        isHeader: true 
    });


    var florIcon = L.icon({
        iconUrl: 'media_tutorial/flor.png',
        iconSize: [40, 40],     // Ajuste o tamanho (largura, altura) em pixels
        iconAnchor: [20, 40],   // Ponto do ícone que corresponderá à coordenada (centro da base)
        popupAnchor: [0, -40]   // Ponto de onde o popup deve abrir em relação ao anchor
    });

    // DADOS
    data.forEach((row, i) => {
        if (!row.Latitude || !row.Chapter) return;

        var lat = parseFloat(row.Latitude.replace(',', '.'));
        var lon = parseFloat(row.Longitude.replace(',', '.'));
        var zoomLevel = parseFloat(row.Zoom) || 12;
        
        // Removido o switch anterior. Agora usamos apenas o florIcon.
        var marker = L.marker([lat, lon], { icon: florIcon, opacity: 0 });
        marker.addTo(map); 
        markers.push(marker);

        // Overlay
        var layerObj = null; 
        if (row.Overlay && row.Overlay.trim() !== "") {
            var input = row.Overlay.trim();
            if (input.endsWith('.geojson') || input.endsWith('.json')) {
                layerObj = { type: 'geojson', url: input, layerInstance: null };
            } else {
                var layerName = input;
                var wmsUrl = 'https://idea.ufpr.br/geoserver/ows';
                if (!layerName.includes(':') && !layerName.startsWith('http')) layerName = 'geonode:' + layerName;
                if (layerName.startsWith('http')) {
                     layerObj = { type: 'image', url: input, layerInstance: null };
                } else {
                    var wmsLayer = L.tileLayer.wms(wmsUrl, {
                        layers: layerName, format: 'image/png', transparent: true,
                        opacity: parseFloat(row['Overlay Transparency']) || 0.8
                    });
                    layerObj = { type: 'wms', layerInstance: wmsLayer };
                }
            }
        }
        overlays.push(layerObj);

        // Conteúdo
        var chapterId = 'chapter-' + i;
        var container = document.createElement('div');
        container.setAttribute('id', chapterId);
        container.classList.add('step', 'centered');

        var content = document.createElement('div');
        content.classList.add('light');
        
        if (row.Chapter) content.innerHTML += `<h3>${row.Chapter}</h3>`;
        
        if (row['Media Link']) {
            var m = row['Media Link'].trim();
            var mLower = m.toLowerCase(); 

            if (mLower.includes('youtube') || mLower.includes('youtu.be')) {
                var videoId = m.split('v=')[1];
                if(videoId && videoId.indexOf('&') != -1) videoId = videoId.split('&')[0];
                var embedUrl = "https://www.youtube.com/embed/" + videoId;
                content.innerHTML += `<div class="video-container"><iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe></div>`;
            } else if (mLower.endsWith('.mp3') || mLower.endsWith('.wav') || mLower.endsWith('.ogg')) {
                content.innerHTML += `<div style="margin: 20px 0;"><audio controls style="width: 100%;"><source src="${m}" type="audio/mpeg"></audio></div>`;
            } else if (mLower.endsWith('.mp4') || mLower.endsWith('.webm') || mLower.endsWith('.mov')) {
                 content.innerHTML += `<div class="video-container" style="padding-bottom: 0; height: auto;"><video controls style="width: 100%; border-radius: 5px;"><source src="${m}" type="video/mp4"></video></div>`;
            } else {
                content.innerHTML += `<img src="${m}" alt="${row.Chapter}">`;
            }
            if (row['Media Credit']) content.innerHTML += `<p class="caption">${row['Media Credit']}</p>`;
        }
        if (row.Description) content.innerHTML += `<p>${row.Description}</p>`;
        container.appendChild(content);
        storyContainer.appendChild(container);

        chapters.push({ id: chapterId, index: i, location: [lat, lon], zoom: zoomLevel, isHeader: false });
    });

    $('#loader').fadeOut();

    scroller = scrollama();

    scroller
        .setup({ step: '.step', offset: 0.5, progress: true })
        .onStepEnter(response => {
            var chapter = chapters.find(c => c.id === response.element.id);
            $('.step').removeClass('active');
            response.element.classList.add('active');

            if (chapter) {
                // --- VISIBILIDADE DO GRUPO DE BOTÕES ---
                if (chapter.isHeader) {
                    $('#floating-controls').addClass('buttons-hidden'); // ESCONDE O GRUPO
                    
                    currentChapterIndex = -1; 
                    markers.forEach(m => m.setOpacity(0));
                    overlays.forEach(obj => {
                        if (obj && obj.layerInstance && map.hasLayer(obj.layerInstance)) map.removeLayer(obj.layerInstance);
                    });
                } else {
                    $('#floating-controls').removeClass('buttons-hidden'); // MOSTRA O GRUPO

                    map.flyTo(chapter.location, chapter.zoom, { animate: true, duration: 1.5 });
                    var idx = chapter.index;
                    currentChapterIndex = idx; 

                    markers.forEach((m, i) => {
                        if (i === idx) {
                            m.setOpacity(1); m.getElement().style.pointerEvents = 'auto'; 
                        } else {
                            m.setOpacity(0); if(m.getElement()) m.getElement().style.pointerEvents = 'none';
                        }
                    });

                    overlays.forEach(obj => {
                        if (obj && obj.layerInstance && map.hasLayer(obj.layerInstance)) map.removeLayer(obj.layerInstance);
                    });
                    
                    var currentOverlay = overlays[idx];
                    if (currentOverlay) {
                        var prepareLayer = function() {
                            if (currentOverlay.type === 'wms') {} 
                            else if (currentOverlay.type === 'image') {
                                if(!currentOverlay.layerInstance) currentOverlay.layerInstance = L.tileLayer(currentOverlay.url);
                            }
                            else if (currentOverlay.type === 'geojson') {
                                if (!currentOverlay.layerInstance) {
                                    fetch(currentOverlay.url).then(res => res.json()).then(data => {
                                        currentOverlay.layerInstance = L.geoJSON(data, { style: { color: '#DC4D01', weight: 2, opacity: 1, fillOpacity: 0.5 }});
                                        if(currentChapterIndex === idx && showLayers) currentOverlay.layerInstance.addTo(map);
                                    });
                                    return false; 
                                }
                            }
                            return true; 
                        };
                        var ready = prepareLayer();
                        if (ready && showLayers && currentOverlay.layerInstance) currentOverlay.layerInstance.addTo(map);
                    }
                }
            }
        })
        .onStepExit(response => {
            var chapter = chapters.find(c => c.id === response.element.id);
            if (chapter && !chapter.isHeader) {
                if (markers[chapter.index]) markers[chapter.index].setOpacity(0);
                var ov = overlays[chapter.index];
                if (ov && ov.layerInstance && map.hasLayer(ov.layerInstance)) map.removeLayer(ov.layerInstance);
            }
        });

    window.addEventListener('resize', scroller.resize);

    $('#toggle-mode').click(function() {
        var storyDiv = $('#story');
        var btn = $(this);
        var currentIsMobile = (window.innerWidth <= 768) || (L.Browser.mobile);
        
        storyDiv.toggleClass('story-hidden');
        var isHidden = storyDiv.hasClass('story-hidden');

        if (isHidden) {
            btn.html('Ver História');
            map.dragging.enable();
            map.touchZoom.enable();
            map.doubleClickZoom.enable();
        } else {
            btn.html('Ver Mapa');
            if (currentIsMobile) {
                map.dragging.disable();
                map.touchZoom.disable();
                map.doubleClickZoom.disable();
                if (map.tap) map.tap.disable();
            }
            scroller.resize();
        }
    });
}

$(document).ready(function() {
    if (typeof googleDocURL !== 'undefined' && googleDocURL && typeof googleApiKey !== 'undefined' && googleApiKey) {
        var spreadsheetId = googleDocURL.split('/d/')[1].split('/')[0];
        $.ajax({
            url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Chapters?key=${googleApiKey}`,
            dataType: 'json',
            success: function(response) { initStoryMap(parseGoogleSheetData(response.values)); },
            error: function(e) { console.error("Erro API:", e); $('#loader').html("Erro ao carregar."); }
        });
    } else { alert('Configure google-doc-url.js'); }
});

function parseGoogleSheetData(rows) {
    if (!rows || rows.length === 0) return [];
    var headers = rows[0];
    var data = [];
    for (var i = 1; i < rows.length; i++) {
        var row = rows[i]; var obj = {};
        for (var j = 0; j < headers.length; j++) { obj[headers[j]] = row[j] ? row[j] : ""; }
        data.push(obj);
    }
    return data;
}