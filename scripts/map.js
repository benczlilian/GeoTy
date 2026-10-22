$(window).on('load', function() {
  var documentSettings = {};

  $.get('csv/Options.csv', function(options) {
    $.get('csv/Chapters.csv', function(chapters) {
      initMap(
        $.csv.toObjects(options),
        $.csv.toObjects(chapters)
      )
    }).fail(function(e) { alert('Encontrado Options.csv, mas não foi possível ler Chapters.csv') });

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
        alert('Para carregar dados do Google Sheets, necessita de uma chave API do Google')
      }
    } else {
      alert('Necessita de especificar um Google Sheet válido (googleDocURL)')
    }
  });
  
  function createDocumentSettings(settings) {
    for (var i in settings) {
      var setting = settings[i];
      documentSettings[setting.Setting] = setting.Customize;
    }
  }
  
  function getSetting(s) {
    return documentSettings[constants[s]];
  }

  function addBaseMap() {
    var mapboxUrl = 'https://api.mapbox.com/styles/v1/lbencz/clw6n5q530c5p01pk10p54u70/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoibGJlbmN6IiwiYSI6ImNsZGVuZDJudzBhdDgzb3FiY3N6eDBhaXgifQ.78HzulaJ8rRPgX0bxND9zg';
    var mapboxLayer = L.tileLayer(mapboxUrl, {
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
      maxZoom: 20
    });
    
    var satelliteUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    var satelliteLayer = L.tileLayer(satelliteUrl, {
      attribution: 'Imagery &copy; Google',
      maxZoom: 20
    });
    
    mapboxLayer.addTo(map);
    
    var baseMaps = {
      "Mapa Padrão": mapboxLayer,
      "Satélite": satelliteLayer
    };
    
    L.control.layers(baseMaps, null, {
      collapsed: true,
      position: 'bottomright' 
    }).addTo(map);
  }

  function initMap(options, chapters) {
    createDocumentSettings(options);

    document.title ='GeoTy - Exploração e Rotas';
    addBaseMap();

    if (getSetting('_zoomControls') !== 'off') {
      L.control.zoom({
        position: 'bottomright' 
      }).addTo(map);
    }

    L.control.locate({
      position: 'bottomright', 
      strings: {
          title: "Mostrar a minha localização atual" 
      },
      locateOptions: {
          enableHighAccuracy: true, 
          maxZoom: 16 
      },
      icon: 'icone-gps-personalizado' 
    }).addTo(map);

    var markersLayer = new L.LayerGroup();  
    map.addLayer(markersLayer);

    var latlngs = [];

    for (var i in chapters) {
      var c = chapters[i];

      if (!isNaN(parseFloat(c['Latitude'])) && !isNaN(parseFloat(c['Longitude']))) {
        var lat = parseFloat(c['Latitude']);
        var lon = parseFloat(c['Longitude']);
        
        var icon = typeof pinhaoIcon !== 'undefined' ? pinhaoIcon : new L.Icon.Default();

        var tituloObra = c['Chapter'].replace(/'/g, "\\'");

        var popupContent = "<div class='custom-popup'>" +
                           "<h6 style='color: #DC4D01; font-weight: bold; margin-bottom: 10px; text-align: center; font-size: 16px;'>" + c['Chapter'] + "</h6>";
        
        if (c['Media Link']) {
            popupContent += "<img src='" + c['Media Link'] + "' onclick='abrirImagemModal(\"" + c['Media Link'] + "\", \"" + tituloObra + "\")' alt='Expandir imagem de " + c['Chapter'] + "'/>";
            
            if (c['Media Credit']) {
                popupContent += "<p style='font-size: 10px; color: #777; font-style: italic; text-align: right; width: 100%; margin-top: -8px; margin-bottom: 12px; line-height: 1.2;'>Crédito: " + c['Media Credit'] + "</p>";
            }
        }

        popupContent += "<p style='margin-bottom: 12px; font-size: 13px; text-align: justify; max-height: 120px; overflow-y: auto;'>" + (c['Description'] || '') + "</p>" +
                        
                        "<hr style='width: 100%; border: 0.5px solid #eee; margin: 10px 0;'/>" +
                        "<p style='margin-bottom: 8px; font-size: 12px; font-weight: 500;'>Adicionar obra à sua rota:</p>" +
                        "<div style='display: flex; gap: 8px; justify-content: center; width: 100%;'>" +
                           "<button onclick='adicionarPontoRota(" + lat + ", " + lon + ", \"foot\")' class='btn btn-sm' style='background-color: #708444; color: white; font-size: 12px; border-radius: 20px; padding: 6px 12px; border: none; cursor: pointer;'><i class='fas fa-walking'></i> + A pé</button>" +
                           "<button onclick='adicionarPontoRota(" + lat + ", " + lon + ", \"bike\")' class='btn btn-sm' style='background-color: #3D5368; color: white; font-size: 12px; border-radius: 20px; padding: 6px 12px; border: none; cursor: pointer;'><i class='fas fa-bicycle'></i> + De Bike</button>" +
                        "</div>" +
                        "</div>";

        var isMobile = window.innerWidth < 768;

        var marker = L.marker([lat, lon], {
          icon: icon,
          title: c['Chapter'],
          opacity: c['Marker'] === 'Hidden' ? 0 : 0.9,
          interactive: c['Marker'] === 'Hidden' ? false : true,
        }).bindPopup(popupContent, { 
            // Se for telemóvel a largura máxima é 280, se for computador é 320
            maxWidth: isMobile ? 280 : 320, 
            
            // Se for telemóvel, afasta só 80px do topo. Se for computador, afasta 100px.
            autoPanPaddingTopLeft: [10, isMobile ? 80 : 100], 
            autoPanPaddingBottomRight: [10, 20] 
        });  

        markersLayer.addLayer(marker);
        latlngs.push([lat, lon]); 
      }
    }

    var searchControl = new L.Control.Search({
        position: 'bottomright',
        layer: markersLayer,      
        propertyName: 'title',    
        marker: false,            
        moveToLocation: function(latlng, title, map) {
            map.flyTo(latlng, 17); 
        }
    });
    
    searchControl.on('search:locationfound', function(e) {
        if(e.layer._popup) e.layer.openPopup();
    });

    map.addControl(searchControl);

    if(latlngs.length > 0) {
        map.fitBounds(latlngs, { padding: [30, 30] });
    }

    $('#map').css('visibility', 'visible');
    $('div.loader').css('visibility', 'hidden');

    // Google Analytics
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
});

window.abrirImagemModal = function(src, title) {
    $('#custom-image-modal').remove();

    var modalHtml = `
    <div id="custom-image-modal">
        <span class="close-btn" onclick="$('#custom-image-modal').remove()">&times;</span>
        <figure id="zoom-container" style="background-image: url('${src}');" 
            onmousemove="ativarLupa(event)" onmouseleave="desativarLupa()" 
            ontouchmove="ativarLupa(event)" ontouchend="desativarLupa()">
            <img id="imagem-base" src="${src}">
        </figure>
        <p>${title}</p>
    </div>
    `;

    $('body').append(modalHtml);

    $('#custom-image-modal').on('click', function(e) {
        if (e.target.id === 'custom-image-modal') {
            $(this).remove();
        }
    });

    window.ativarLupa = function(e) {
        var container = e.currentTarget;
        var imgBase = document.getElementById("imagem-base");
        imgBase.style.opacity = 0; 
        
        var offsetX, offsetY;
        if (e.type === 'touchmove') {
            e.preventDefault(); 
            var rect = container.getBoundingClientRect();
            offsetX = e.touches[0].pageX - rect.left - window.scrollX;
            offsetY = e.touches[0].pageY - rect.top - window.scrollY;
        } else {
            offsetX = e.offsetX;
            offsetY = e.offsetY;
        }
        var x = (offsetX / container.offsetWidth) * 100;
        var y = (offsetY / container.offsetHeight) * 100;
        container.style.backgroundPosition = x + "% " + y + "%";
    };

    window.desativarLupa = function() {
        var imgBase = document.getElementById("imagem-base");
        if (imgBase) imgBase.style.opacity = 1;
    };
};

var controleRota = null;
var waypointsRota = [];
var perfilAtual = 'foot';

window.otimizarRota = function() {
    if (waypointsRota.length <= 2) return;

    var pontoPartida = waypointsRota[0]; 
    var pontosNaoVisitados = waypointsRota.slice(1); 
    var novaRotaOtimizada = [pontoPartida];
    
    var pontoAtual = pontoPartida;

    while (pontosNaoVisitados.length > 0) {
        var indiceMaisProximo = 0;
        var menorDistancia = Infinity;

        for (var i = 0; i < pontosNaoVisitados.length; i++) {
            var dist = map.distance(pontoAtual, pontosNaoVisitados[i]);
            if (dist < menorDistancia) {
                menorDistancia = dist;
                indiceMaisProximo = i;
            }
        }

        pontoAtual = pontosNaoVisitados[indiceMaisProximo];
        novaRotaOtimizada.push(pontoAtual);
        
        pontosNaoVisitados.splice(indiceMaisProximo, 1);
    }

    waypointsRota = novaRotaOtimizada;
};

window.adicionarPontoRota = function(destLat, destLon, perfil) {
    map.closePopup();
    $('div.loader').css('visibility', 'visible').text('Atualizando rota...');

    if (waypointsRota.length === 0) {
        if (!navigator.geolocation) {
            alert("O seu navegador não suporta geolocalização.");
            $('div.loader').css('visibility', 'hidden').text('Carregando...');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(function(position) {
            var userLat = position.coords.latitude;
            var userLon = position.coords.longitude;
            
            waypointsRota.push(L.latLng(userLat, userLon)); 
            waypointsRota.push(L.latLng(destLat, destLon)); 
            perfilAtual = perfil;
            
            desenharRota();
        }, function(error) {
            $('div.loader').css('visibility', 'hidden').text('Carregando...');
            alert("Por favor, permita o acesso à localização para iniciar a sua rota.");
        });
        
    } else {
        waypointsRota.push(L.latLng(destLat, destLon));
        if (perfilAtual !== perfil) perfilAtual = perfil;
        
        otimizarRota(); 
        desenharRota();
    }
};

window.desenharRota = function() {
    var urlServidor = perfilAtual === 'foot' 
        ? 'https://routing.openstreetmap.de/routed-foot/route/v1' 
        : 'https://routing.openstreetmap.de/routed-bike/route/v1';

    var corDaRota = perfilAtual === 'bike' ? '#BD9825' : '#DC4D01';

    if (controleRota === null) {
        controleRota = L.Routing.control({
            position: 'bottomleft',
            waypoints: waypointsRota,
            router: L.Routing.osrmv1({
                serviceUrl: urlServidor,
                language: 'pt-BR' 
            }),
            language: 'pt-BR', 
            
            addWaypoints: false,       
            draggableWaypoints: false, 
            routeWhileDragging: false,

            lineOptions: {
                // Aplica a cor dinâmica que definimos acima
                styles: [{color: corDaRota, opacity: 0.8, weight: 6}], 
                addWaypoints: false 
            },
            createMarker: function(i, wp, nWps) {
                if (i === 0) {
                    return L.marker(wp.latLng, {
                        icon: L.icon({
                            iconUrl: 'media/chuva.png', 
                            iconSize: [25, 45]  
                        })
                    }).bindPopup('Seu ponto de partida');
                }
                return null; 
            },
            show: true, 
            collapsible: false 
        }).addTo(map);

        controleRota.on('routingstart', function() {
            $('div.loader').css('visibility', 'visible').text('A calcular a melhor rota...');
        });

        controleRota.on('routesfound', function(e) {
            $('div.loader').css('visibility', 'hidden').text('Carregando...');
            
            setTimeout(function() {
                if ($('.btn-fechar-rota').length === 0) {
                    $('.leaflet-routing-container').append('<div id="btn-fechar-rota" class="btn-fechar-rota" style="background-color: #706e73; color: white; text-align: center; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 15px; margin-bottom: 5px; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">✖ Encerrar Rota e Limpar Mapa</div>');
                    
                    $('#btn-fechar-rota').on('click', function(event) {
                        event.stopPropagation(); 
                        fecharRota();
                    });
                }
            }, 300);
        });

        controleRota.on('routingerror', function() {
            $('div.loader').css('visibility', 'hidden').text('Carregando...');
            alert('Não foi possível calcular a rota. O servidor pode estar ocupado no momento.');
        });

    } else {
        controleRota.getRouter().options.serviceUrl = urlServidor;
        
        controleRota.options.lineOptions.styles[0].color = corDaRota;
        
        controleRota.setWaypoints(waypointsRota); 
    }
};

window.fecharRota = function() {
    if (controleRota !== null) {
        map.removeControl(controleRota);
        
        controleRota = null;
        waypointsRota = []; 

        $('.leaflet-routing-container').remove();

        map.eachLayer(function (layer) {
            if (layer.options && (layer.options.color === '#DC4D01' || layer.options.color === '#BD9825')) {
                map.removeLayer(layer);
            }
            if (layer.getPopup && layer.getPopup() && layer.getPopup().getContent() === 'Seu ponto de partida') {
                map.removeLayer(layer);
            }
        });

        $('div.loader').css('visibility', 'hidden').text('Carregando...');
    }
};

// =========================================================
// TUTORIAL DE BOAS-VINDAS (ONBOARDING) E BOTÃO DE AJUDA
// =========================================================

$(document).ready(function() {
    // 1. Constrói o código HTML do Modal e do Botão de Ajuda
    var tutorialHtml = `
    <div id="tutorial-modal">
        <div class="tutorial-content">
            <span class="fechar-tutorial" onclick="fecharTutorial()">&times;</span>
            
            <img src="media/TCC3.png" alt="GeoTy Logo" style="max-height: 60px; margin-bottom: 10px;">
            <h3 style="color: #DC4D01; margin-top: 0; margin-bottom: 5px;">Você está no GeoTy Map!</h3>
            <p style="font-size: 15px; margin-top: 0;">Aqui você encontrará as obras de Poty Lazzarotto por Curitiba e região.</p>
            
            <hr style="border: 0.5px solid #eee; margin: 15px 0;">
            
            <h4 style="color: #3D5368; text-align: left; margin-bottom: 10px;">Para navegar é simples:</h4>
            <p style="font-size: 13px; text-align: left; margin-top: 0;">No canto inferior você encontrará os seguintes botões:</p>
            
            <div class="tutorial-icones">
                <div class="tutorial-item"><img src="media/pin.png"> <span><strong>Localização:</strong> Mostra onde você está no mapa via GPS.</span></div>
                <div class="tutorial-item"><img src="media/lupa.png"> <span><strong>Pesquisa:</strong> Busque pelo nome de uma obra específica.</span></div>
                <div class="tutorial-item"><img src="media/layers.png"> <span><strong>Camadas:</strong> Alterne entre o mapa padrão e a visão de satélite.</span></div>
                <div class="tutorial-item" style="gap: 5px;"><img src="media/zoomo.png" style="margin-right: 0;"><img src="media/zoomi.png"> <span><strong>Zoom:</strong> Aproxime ou afaste a visão da cidade.</span></div>
            </div>

            <hr style="border: 0.5px solid #eee; margin: 15px 0;">
            
            <h4 style="color: #3D5368; text-align: left; margin-bottom: 10px;">Planeje sua rota:</h4>
            <p style="font-size: 13px; text-align: left; margin-top: 0;">Encontre o melhor caminho para conhecer as obras. Clique em um PINhão no mapa e escolha:</p>
            
            <div style="display: flex; gap: 8px; justify-content: center; margin: 15px 0;">
                <button class='btn btn-sm' style='background-color: #708444; color: white; font-size: 12px; border-radius: 20px; padding: 6px 12px; border: none; cursor: default;'><i class='fas fa-walking'></i> + A pé</button>
                <button class='btn btn-sm' style='background-color: #3D5368; color: white; font-size: 12px; border-radius: 20px; padding: 6px 12px; border: none; cursor: default;'><i class='fas fa-bicycle'></i> + De Bike</button>
            </div>
            
            <p style="font-size: 12px; color: #777; font-style: italic;">Dica: Adicione vários pontos! O mapa organizará o caminho mais curto de forma inteligente para que não dê voltas desnecessárias.</p>
            
            <button class="btn-comecar" onclick="fecharTutorial()">Começar a Explorar</button>
        </div>
    </div>

    <!-- Botão flutuante de interrogação -->
    <button id="btn-ajuda" onclick="abrirTutorial()" title="Ajuda / Tutorial">
        <i class="fas fa-question"></i>
    </button>
    `;

    $('body').append(tutorialHtml);
});

// Funções para Abrir e Fechar o Tutorial com animação suave
window.fecharTutorial = function() {
    $('#tutorial-modal').fadeOut(300);
    $('#btn-ajuda').fadeIn(300).css('display', 'flex');
};
