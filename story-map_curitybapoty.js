var map;
var glLayer; 
var scroller;
var markers = []; 
var overlays = []; 
var extraMarkersGroup;
var vectorCache = {}; 
var showLayers = true; 
var currentChapterIndex = -1; 

function applyGeoJsonStyle(data, url, overlayOpacity) {
    var fileName = url.split('/').pop();
    var configKey = fileName.substring(0, fileName.lastIndexOf('.')).toLowerCase();
    
    var config = (typeof geojsonConfigs !== 'undefined' && geojsonConfigs[configKey]) ? geojsonConfigs[configKey] : null;

    var options = {
        style: function(feature) {
            var defaultColor = '#DC4D01';
            var defaultFillOpacity = overlayOpacity !== undefined ? overlayOpacity : 0.5;
            
            if (!config) return { color: defaultColor, weight: 2, opacity: 1, fillOpacity: defaultFillOpacity };
            
            var style = {
                color: config.corBorda || defaultColor,
                weight: config.pesoBorda !== undefined ? config.pesoBorda : 2,
                opacity: config.opacidadeBorda !== undefined ? config.opacidadeBorda : 1,
                fillOpacity: config.opacidadePreenchimento !== undefined ? config.opacidadePreenchimento : defaultFillOpacity,
                fillColor: defaultColor
            };

            if (config.cores) {
                var foundColor = false;
                for (var prop in feature.properties) {
                    var val = feature.properties[prop];
                    if (config.cores[val]) {
                        style.fillColor = config.cores[val];
                        if (!config.corBorda) style.color = config.cores[val]; // Se não tiver cor da borda, usa a cor do fill
                        foundColor = true;
                        break;
                    }
                }
                if (!foundColor) {
                    for (var prop in feature.properties) {
                        if (config.cores[prop]) {
                            style.fillColor = config.cores[prop];
                            if (!config.corBorda) style.color = config.cores[prop];
                            break;
                        }
                    }
                }
            }
            return style;
        },
        onEachFeature: function(feature, layer) {
            if (config && config.atributosTooltip && config.atributosTooltip.length > 0) {
                var tooltipContent = config.atributosTooltip.map(function(attr) {
                    return feature.properties[attr] ? "<b>" + attr + ":</b> " + feature.properties[attr] : "";
                }).filter(Boolean).join("<br>");
                
                if (tooltipContent) {
                    layer.bindTooltip(tooltipContent, { sticky: true });
                }
            }
        }
    };

    if (config && config.tamanhoPonto) {
        options.pointToLayer = function(feature, latlng) {
            return L.circleMarker(latlng, { radius: config.tamanhoPonto });
        };
    }

    return L.geoJSON(data, options);
}

function initStoryMap(data) {
    var isMobile = (window.innerWidth <= 768) || (L.Browser.mobile);

    var startLat = -25.4284;
    var startLon = -49.2733;
    var startZoom = 12;

    if (data.length > 0) {
        startLat = parseFloat(data[0].Latitude.replace(',', '.'));
        startLon = parseFloat(data[0].Longitude.replace(',', '.'));
        startZoom = parseFloat(data[0].Zoom) || 12;
    }

    data.forEach(row => {
        if (row.Overlay) {
            var inputs = row.Overlay.split(',');
            inputs.forEach(input => {
                var url = input.trim();
                var lower = url.toLowerCase();
                if ((lower.endsWith('.geojson') || lower.endsWith('.json')) && !vectorCache[url]) {
                    vectorCache[url] = fetch(url)
                        .then(res => res.json())
                        .catch(err => console.error("Falha no pré-load:", url));
                }
            });
        }
    });

    // --- MAPA ---
    map = L.map('map', {
        center: [startLat, startLon], 
        zoom: startZoom,
        zoomControl: false,     
        scrollWheelZoom: false, 
        dragging: !isMobile,
        touchZoom: !isMobile,
        doubleClickZoom: !isMobile,
        tap: !isMobile 
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

    glLayer = L.maplibreGL({
        style: 'https://api.maptiler.com/maps/019e61fe-eb43-71a1-a50b-f638cb3514d6/style.json?key=mJszyGhKhVRJv3iG1dvu',
        preserveDrawingBuffer: true
    }).addTo(map);

    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('V.02 | <a href="https://www.linkedin.com/in/lilianbencz" target="_blank">Lilian Bencz </a> , <a href="https://leafletjs.com" target="_blank" title="A JavaScript library for interactive maps">Leaflet</a>  ');

    extraMarkersGroup = L.layerGroup().addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);

    setTimeout(function(){ map.invalidateSize(); }, 500);

    // BOTÕES 
    var controlsDiv = document.createElement('div');
    controlsDiv.id = 'floating-controls';
    document.body.appendChild(controlsDiv);

    var layerBtn = document.createElement('button');
    layerBtn.className = 'btn-floating btn-layer'; 
    layerBtn.innerHTML = 'Ocultar Layers';
    layerBtn.title = 'Ocultar camadas do mapa'; 
    
    layerBtn.onclick = function() {
        showLayers = !showLayers;
        if (showLayers) {
            layerBtn.classList.remove('layers-off');
            layerBtn.innerHTML = 'Ocultar Layers';
            layerBtn.title = 'Ocultar camadas do mapa'; 
        } else {
            layerBtn.classList.add('layers-off');
            layerBtn.innerHTML = ' Ver Layers';
            layerBtn.title = 'Mostrar camadas do mapa'; 
        }
        
        if (currentChapterIndex >= 0 && overlays[currentChapterIndex]) {
            var currentLayers = overlays[currentChapterIndex]; 
            currentLayers.forEach(function(layerObj) {
                if (layerObj && layerObj.layerInstance) {
                    if (showLayers) {
                        if (!map.hasLayer(layerObj.layerInstance)) map.addLayer(layerObj.layerInstance);
                    } else {
                        if (map.hasLayer(layerObj.layerInstance)) map.removeLayer(layerObj.layerInstance);
                    }
                }
            });
        }
    };
    controlsDiv.appendChild(layerBtn);

    var toggleBtn = document.getElementById('toggle-mode');
    if (toggleBtn) {
        toggleBtn.classList.add('btn-floating');
        toggleBtn.title = 'Navegar livremente pelo mapa';
        controlsDiv.appendChild(toggleBtn);
    }

    var storyContainer = document.getElementById('story');
    var chapters = [];

    // HEADER
    var headerId = 'header-step';
    var headerDiv = document.createElement('div');
    headerDiv.setAttribute('id', headerId);
    headerDiv.classList.add('step'); 
    
    headerDiv.innerHTML = `
        <video id="video-piece-title-video" preload="auto" playsinline="" autoplay="" muted="" loop="" poster="">
            <source src="media/intropoty.mp4" type="video/mp4">
        </video>
        <div class="header-content">
            <img src="media/poty.png" alt="Poty Lazzarotto" class="header-image">
            <h1> </h1>
            <p>Em uma jornada pela história de Curitiba, exploraremos como o saneamento e a mobilidade moldaram o crescimento da cidade ao longo do tempo. Viajaremos através dos anos, explorando mapas históricos e descobrindo como o artista Poty Lazzarotto retratou essa narrativa em suas obras, que permeiam toda a cidade.</p>
        </div>
        <div id="scroll-overlay"> Continue ↓ </div>
    `;
    storyContainer.insertBefore(headerDiv, storyContainer.firstChild);

    chapters.push({ id: headerId, index: -1, isHeader: true, extraMarkersData: [] });

    if (typeof araucIcon === 'undefined') console.warn("Aviso: Ícones globais não encontrados.");

    var lastLat = null;
    var lastLon = null;
    var lastZoom = null;
    var lastIcon = null;

    // LOOP DADOS
    data.forEach((row, i) => {
        if (row.Latitude && row.Latitude.trim() !== "") {
            lastLat = parseFloat(row.Latitude.replace(',', '.'));
            lastLon = parseFloat(row.Longitude.replace(',', '.'));
            lastZoom = parseFloat(row.Zoom) || 12;
        } else if (lastLat === null) {
            return;
        }

        var lat = lastLat;
        var lon = lastLon;
        var zoomLevel = lastZoom;
        
        var customIcon = (typeof araucIcon !== 'undefined') ? araucIcon : new L.Icon.Default();
        var sheetIconName = row.Pin || row.Icon || row.Icone || row['Ícone'];

        if (sheetIconName && sheetIconName.trim() !== "") {
            var iconNameClean = sheetIconName.trim();
            if (typeof window[iconNameClean] !== 'undefined') {
                customIcon = window[iconNameClean];
            } else {
                console.warn("Aviso: O ícone '" + iconNameClean + "' não foi encontrado. Usando o ícone padrão.");
            }
            lastIcon = customIcon; 
        } else if (lastIcon !== null) {
            customIcon = lastIcon;
        } else {
            lastIcon = customIcon;
        }

        var marker = L.marker([lat, lon], { icon: customIcon, opacity: 0 });
        
        if (row.Chapter && row.Chapter.trim() !== "") {
            marker.bindPopup(`<strong>${row.Chapter}</strong>`, { 
                className: 'chapter-marker-popup',
                offset: [0, -15]  
            });
        }

        marker.addTo(map); 
        markers.push(marker);

        // EXTRAS
        var chapterExtras = [];
        if (row['Extra Markers'] && row['Extra Markers'].trim() !== "") {
            var rawExtras = row['Extra Markers'].split(';'); 
            rawExtras.forEach(function(item) {
                var parts = item.split('|'); 
                if (parts.length >= 3) {
                    var exLat = parseFloat(parts[0].trim().replace(',', '.'));
                    var exLon = parseFloat(parts[1].trim().replace(',', '.'));
                    var exText = parts[2].trim();
                    var iconToUse = (typeof pinhaoIcon !== 'undefined') ? pinhaoIcon : customIcon;

                    if (parts.length >= 4) {
                        var iconVarName = parts[3].trim();
                        if (iconVarName !== "" && typeof window[iconVarName] !== 'undefined') {
                            iconToUse = window[iconVarName];
                        }
                    }
                    
                    var extraMarker = L.marker([exLat, exLon], { icon: iconToUse, opacity: 1 });
                    extraMarker.bindPopup(exText);
                    chapterExtras.push(extraMarker);
                }
            });
        }
        
        // OVERLAYS 
        var chapterLayers = []; 
        if (row.Overlay && row.Overlay.trim() !== "") {
            var inputs = row.Overlay.split(',');
            var opacities = [];
            if (row['Overlay Transparency']) {
                opacities = row['Overlay Transparency'].toString().split(',');
            }
            inputs.forEach(function(rawInput, idx) {
                var input = rawInput.trim();
                if (input === "") return;
                var currentOpacity = 0.8; 
                if (opacities[idx]) currentOpacity = parseFloat(opacities[idx].trim()) || 0.8;
                else if (opacities.length > 0) currentOpacity = parseFloat(opacities[0].trim()) || 0.8;

                var layerObj = null;
                var inputLower = input.toLowerCase(); 

                if (inputLower.endsWith('.geojson') || inputLower.endsWith('.json')) {
                    layerObj = { type: 'geojson', url: input, layerInstance: null, opacity: currentOpacity };
                } else {
                    var layerName = input;
                    var wmsUrl = 'https://idea.ufpr.br/geoserver/ows';
                    
                    var isLocalTileOrImage = layerName.startsWith('http') || layerName.includes('/') || inputLower.includes('{z}') || inputLower.endsWith('.png') || inputLower.endsWith('.jpg');
                    
                    if (isLocalTileOrImage) {
                        layerObj = { type: 'image', url: input, layerInstance: null, opacity: currentOpacity };
                    } else {
                        if (!layerName.includes(':')) layerName = 'geonode:' + layerName;
                        
                        var wmsLayer = L.tileLayer.wms(wmsUrl, {
                            layers: layerName, 
                            format: 'image/png', 
                            transparent: true,
                            opacity: currentOpacity,
                            noWrap: true, 
                            tms: false,
                            updateWhenIdle: true, 
                            keepBuffer: 2
                        });
                        layerObj = { type: 'wms', layerInstance: wmsLayer };
                    }
                }
                if (layerObj) chapterLayers.push(layerObj);
            });
        }
        overlays.push(chapterLayers); 

        // HTML
        var chapterId = 'chapter-' + i;
        var container = document.createElement('div');
        container.setAttribute('id', chapterId);
        container.classList.add('step');
        
        var posValue = (row.Position || row.Posicao || row['Posição'] || row.Alinhamento || '').toLowerCase().trim();
        if (posValue === 'centro' || posValue === 'center') container.classList.add('pos-center');
        else if (posValue === 'direita' || posValue === 'right') container.classList.add('pos-right');
        else if (posValue === 'esquerda' || posValue === 'left') container.classList.add('pos-left');
        
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

        chapters.push({ 
            id: chapterId, index: i, location: [lat, lon], zoom: zoomLevel, isHeader: false, extraMarkersData: chapterExtras 
        });
    });

    var validChapters = chapters.filter(c => !c.isHeader && c.location);
    var lineFeatures = [];

    for (let j = 0; j < validChapters.length - 1; j++) {
        let p1 = [validChapters[j].location[1], validChapters[j].location[0]];
        let p2 = [validChapters[j+1].location[1], validChapters[j+1].location[0]];
        
        lineFeatures.push({
            type: 'Feature',
            properties: { toIdx: validChapters[j+1].index },
            geometry: { type: 'LineString', coordinates: [p1, p2] }
        });
    }

    var storyLinesGeoJSON = { type: 'FeatureCollection', features: lineFeatures };

    function getGLMap() {
        if (!glLayer) return null;
        return glLayer.getMaplibreMap ? glLayer.getMaplibreMap() : (glLayer.getMap ? glLayer.getMap() : glLayer._glMap);
    }

    function initNativeLine() {
        var gl = getGLMap();
        if (!gl) {
            setTimeout(initNativeLine, 500); 
            return;
        }

        var setupLayer = function() {
            if (gl.getSource('story-lines')) return;
            gl.addSource('story-lines', { type: 'geojson', data: storyLinesGeoJSON });
            gl.addLayer({
                id: 'story-lines-layer',
                type: 'line',
                source: 'story-lines',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#ab472e', 'line-width': 3.5, 'line-opacity': 0.4 },
                filter: ['<=', ['get', 'toIdx'], currentChapterIndex !== undefined ? currentChapterIndex : -1]
            });
        };

        if (gl.isStyleLoaded()) {
            setupLayer();
        } else {
            gl.once('load', setupLayer);
        }
    }
    
    setTimeout(initNativeLine, 300);

    // RODAPÉ
    var footerDiv = document.createElement('div');
    footerDiv.setAttribute('id', 'footer');
    footerDiv.innerHTML = `<button class="btn-restart" onclick="window.scrollTo({top: 0, behavior: 'smooth'})"> Voltar ao Início</button>`;
    storyContainer.appendChild(footerDiv);

    // LIGHTBOX
    $('body').append('<div id="lightbox"><span id="lightbox-close">&times;</span><div id="lightbox-content"></div></div>');
    
    $(document).on('click', '.step img', function(e) {
        var parentStep = $(this).closest('.step');
        if (parentStep.attr('id') === 'header-step' || parentStep.attr('id') === 'footer-video-step') return;
        if ($('#story').hasClass('story-hidden')) { e.preventDefault(); e.stopPropagation(); return; }
        $('#lightbox-content').html('<img src="' + $(this).attr('src') + '">');
        $('#lightbox').addClass('active');
    });

    $(document).on('click', '.step video', function(e) {
        var parentStep = $(this).closest('.step');
        if (parentStep.attr('id') === 'header-step' || parentStep.attr('id') === 'footer-video-step' || this.id === 'video-final-full') return;
        if ($('#story').hasClass('story-hidden')) { e.preventDefault(); e.stopPropagation(); return; }
        $('#lightbox-content').html(`<video controls autoplay style="max-width: 100%; max-height: 90vh;"><source src="${$(this).find('source').attr('src')}" type="video/mp4"></video>`);
        $('#lightbox').addClass('active');
    });

    $(document).on('click', '#lightbox, #lightbox-close', function(e) {
        if (e.target.id === 'lightbox' || e.target.id === 'lightbox-close') {
            $('#lightbox').removeClass('active');
            setTimeout(function(){ $('#lightbox-content').empty(); }, 300); 
        }
    });

    $('#loader').fadeOut();

    scroller = scrollama();
    var lastView = { lat: null, lon: null, zoom: null };

    scroller
        .setup({ step: '.step', offset: 0.5, progress: true })
        .onStepEnter(response => {
            var chapter = chapters.find(c => c.id === response.element.id);
            if (!chapter) return; 

            $('.step').removeClass('active');
            response.element.classList.add('active');

            var currentIsMobile = (window.innerWidth <= 768) || (L.Browser.mobile);

            if (chapter.isHeader) {
                $('#floating-controls').addClass('buttons-hidden'); 
                currentChapterIndex = -1; 
                lastView = { lat: null, lon: null, zoom: null }; 
                markers.forEach(m => m.setOpacity(0));
                extraMarkersGroup.clearLayers(); 
                
                try {
                    var gl = getGLMap();
                    if (gl && gl.getLayer('story-lines-layer')) {
                        gl.setFilter('story-lines-layer', ['<=', ['get', 'toIdx'], -1]);
                    }
                } catch (e) { }

                overlays.forEach(chapterLayers => {
                    chapterLayers.forEach(obj => {
                        if (obj && obj.layerInstance && map.hasLayer(obj.layerInstance)) map.removeLayer(obj.layerInstance);
                    });
                });

            } else {
                $('#floating-controls').removeClass('buttons-hidden'); 

                var isSameView = (lastView.lat === chapter.location[0] &&
                                  lastView.lon === chapter.location[1] &&
                                  lastView.zoom === chapter.zoom);

                if (!isSameView) {
                    if (currentIsMobile) {
                        map.setView(chapter.location, chapter.zoom);
                    } else {
                        map.flyTo(chapter.location, chapter.zoom, { 
                            animate: true, duration: 8, easeLinearity: 0.8 
                        });
                    }
                    lastView = { lat: chapter.location[0], lon: chapter.location[1], zoom: chapter.zoom };
                }

                var idx = chapter.index;
                currentChapterIndex = idx; 

                try {
                    var gl = getGLMap();
                    if (gl && gl.getLayer('story-lines-layer')) {
                        gl.setFilter('story-lines-layer', ['<=', ['get', 'toIdx'], idx]);
                    }
                } catch (e) { }
                
                markers.forEach((m, i) => {
                    if (i <= idx) { 
                        m.setOpacity(1); 
                        if(m.getElement()) m.getElement().style.pointerEvents = 'auto'; 
                    } 
                    else { 
                        m.setOpacity(0); 
                        if(m.getElement()) m.getElement().style.pointerEvents = 'none'; 
                        if (m.isPopupOpen()) m.closePopup(); 
                    }
                });

                extraMarkersGroup.clearLayers(); 
                if (chapter.extraMarkersData && chapter.extraMarkersData.length > 0) {
                    chapter.extraMarkersData.forEach(function(m) {
                        extraMarkersGroup.addLayer(m); 
                    });
                }

                overlays.forEach((chapterLayers, i) => {
                    if (i !== idx) {
                        chapterLayers.forEach(obj => {
                            if (obj && obj.layerInstance && map.hasLayer(obj.layerInstance)) map.removeLayer(obj.layerInstance);
                        });
                    }
                });
                
                var currentLayers = overlays[idx];
                if (currentLayers && currentLayers.length > 0) {
                    currentLayers.forEach(function(currentOverlay) {
                        var prepareLayer = function() {
                            if (currentOverlay.type === 'wms') {} 
                            else if (currentOverlay.type === 'image') {
                                if(!currentOverlay.layerInstance) {
                                    currentOverlay.layerInstance = L.tileLayer(currentOverlay.url, { 
                                        noWrap: true, 
                                        tms: false,
                                        opacity: currentOverlay.opacity !== undefined ? currentOverlay.opacity : 0.8
                                    });
                                }
                            }
                            else if (currentOverlay.type === 'geojson') {
                                if (!currentOverlay.layerInstance) {
                                    if (vectorCache[currentOverlay.url]) {
                                        vectorCache[currentOverlay.url].then(data => {
                                            currentOverlay.layerInstance = applyGeoJsonStyle(data, currentOverlay.url, currentOverlay.opacity);
                                            if(currentChapterIndex === idx && showLayers) currentOverlay.layerInstance.addTo(map);
                                        });
                                    } else {
                                        fetch(currentOverlay.url)
                                            .then(res => res.json())
                                            .then(data => {
                                                currentOverlay.layerInstance = applyGeoJsonStyle(data, currentOverlay.url, currentOverlay.opacity);
                                                if(currentChapterIndex === idx && showLayers) currentOverlay.layerInstance.addTo(map);
                                            })
                                            .catch(err => console.error("Erro GeoJSON:", err));
                                    }
                                    return false; 
                                }
                            }
                            return true; 
                        };
                        var ready = prepareLayer();
                        if (ready && showLayers && currentOverlay.layerInstance) {
                            if (!map.hasLayer(currentOverlay.layerInstance)) currentOverlay.layerInstance.addTo(map);
                        }
                    });
                }
            }
        })
        .onStepExit(response => {
            var chapter = chapters.find(c => c.id === response.element.id);
            if (chapter) response.element.classList.remove('active');
        });

    window.addEventListener('resize', scroller.resize);

    $(document).off('click', '#toggle-mode');
    
    $(document).on('click', '#toggle-mode', function(e) {
        e.preventDefault(); 
        var storyDiv = $('#story');
        var btn = $(this);
        var currentIsMobile = (window.innerWidth <= 768) || (L.Browser.mobile);
        
        storyDiv.toggleClass('story-hidden');
        var isHidden = storyDiv.hasClass('story-hidden');

        if (isHidden) {
            btn.html('Ver História');
            btn.attr('title', 'Retornar para a leitura da história');
            map.dragging.enable();
            
            if (!currentIsMobile) {
                map.touchZoom.enable();
                map.doubleClickZoom.enable();
                map.scrollWheelZoom.enable();
                if (map.tap) map.tap.enable();
            } else {
                map.touchZoom.disable();
                map.doubleClickZoom.disable();
                map.scrollWheelZoom.disable();
                if (map.tap) map.tap.enable();
            }
            $('#map').css('cursor', 'grab');
        } else {
            btn.html('Ver Mapa');
            btn.attr('title', 'Navegar livremente pelo mapa');
            map.scrollWheelZoom.disable();

            if (currentIsMobile) {
                map.dragging.disable();
                map.touchZoom.disable();
                map.doubleClickZoom.disable();
                if (map.tap) map.tap.disable();
            } else {
                map.dragging.enable();
            }
            $('#map').css('cursor', '');
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

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwy9dxknaAOpPVIpm3QSri8EGPMMdJs10gaNd3_emx0oPNVMOQwLt-zQWN_sCEm8c0l/exec'; 
const sessionId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'sess_' + Date.now();

document.addEventListener('click', function(event) {
    const tag = event.target.tagName || '';
    const id = event.target.id ? '#' + event.target.id : '';
    const className = event.target.className && typeof event.target.className === 'string' 
                      ? '.' + event.target.className.split(' ').join('.') 
                      : '';
    const elementClassId = id + className;

    let latLngStr = "";
    if (event.target.closest('#map') && typeof map !== 'undefined' && map !== null) {
        const rect = document.getElementById('map').getBoundingClientRect();
        const mapX = event.clientX - rect.left;
        const mapY = event.clientY - rect.top;
        
        try {
            const latLng = map.containerPointToLatLng([mapX, mapY]);
            latLngStr = `${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}`;
        } catch (e) {
            console.warn("Não foi possível converter o clique em coordenada geográfica.");
        }
    }

    const clickData = {
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        x: event.clientX,
        y: event.clientY,
        elementTag: tag,
        elementClassId: elementClassId,
        latLng: latLngStr,
        chapterIndex: typeof currentChapterIndex !== 'undefined' ? currentChapterIndex : 'desconhecido'
    };

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(clickData),
        headers: {
            'Content-Type': 'text/plain;charset=utf-8' 
        }
    })
    .catch(error => console.error('Erro de conexão ao salvar clique:', error));
});