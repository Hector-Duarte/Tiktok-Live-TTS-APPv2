// This will use the demo backend if you open index.html locally via file://, otherwise your server will be used
// Verifica si la aplicación se está ejecutando localmente o en un servidor remoto
let backendUrl;
if (location.protocol === 'file:') {
    // Si se ejecuta localmente, usa la URL local para el servidor Socket.IO
    backendUrl = "https://tiktok-chat-reader.zerody.one/";
} else {
    // Si se ejecuta en un servidor remoto, utiliza la URL del servidor remoto
    backendUrl = "http://localhost:8081"; // Reemplaza 'example.com' con la URL real de tu servidor
}

// Asegúrate de que la URL tenga la ruta para Socket.IO
backendUrl += "";

// Crea la conexión al servidor Socket.IO con la URL obtenida
let connection = new TikTokIOConnection(backendUrl);

let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;
let previousLikeCount = 0;

// These settings are defined by obs.html
if (!window.settings) window.settings = {};
document.addEventListener('DOMContentLoaded', (event) => {
    document.body.className = 'theme-dark';
    window.settings.theme = 'dark'; // Guardar la configuración del tema
    const toggleButton = document.getElementById('dn');
    toggleButton.addEventListener('change', () => {
        if (toggleButton.checked) {
            // Si el botón de alternancia está marcado, aplicar el tema oscuro
            document.body.className = 'theme-dark';
        } else {
            // Si el botón de alternancia no está marcado, aplicar el tema claro
            document.body.className = 'theme-light';
        }
    });

});

$(document).ready(() => {
    $('#connectButton').click(connect);
    $('#uniqueIdInput').on('keyup', function (e) {
        if (e.key === 'Enter') {
            connect();
        }
    });

    if (window.settings.username) connect();
})
let isConnected = false;
let currentRoomId = null;
let currentUniqueId = null;

function connect() {
    let uniqueId = window.settings.username || $('#uniqueIdInput').val();
    if (uniqueId !== '') {
        $('#stateText').text('Connecting...');
        
        connection.connect(uniqueId, {
            processInitialData: true,
            enableExtendedGiftInfo: true,
            enableWebsocketUpgrade: true,
            requestPollingIntervalMs: 2000,
            clientParams: {
                "app_language": "en-US",
                "device_platform": "web"
            },
            requestOptions: {
                timeout: 5000
            },
            websocketOptions: {
                timeout: 5000
            }
        }).then(state => {
            console.log(`Connected to roomId ${state.roomId} upgraded ${state.upgradedToWebsocket}`, state);
            console.log(`Available Gifts:`, state.availableGifts);
            
            // Función para cargar los datos desde el localStorage
            availableGiftsimage(state);
            
            // Enviar al servidor la información de la conexión establecida
            sendToServer('connected', uniqueId);
            
            // Restablecer estadísticas
            viewerCount = 0;
            likeCount = 0;
            diamondsCount = 0;
            updateRoomStats();
            
            // Generar enlace de perfil de usuario
            const userProfileLink = generateUsernameLink({ uniqueId });
            
            // Si hay una imagen de portada de la sala, mostrarla junto con el enlace del perfil de usuario
            if (state.roomInfo.cover) {
                const userProfileImage = `<img src="${state.roomInfo.cover.url_list[1]}" alt="${uniqueId}" width="50" height="50">`;
                const userProfileContainer = `
                    <div class="user-profile-container">
                        <div class="user-profile-image">${userProfileImage}</div>
                        <div class="user-profile-link">${userProfileLink}</div>
                    </div>
                `;
                $('#stateText').html(userProfileContainer);
            }
        }).catch(errorMessage => {
            // Manejar el error en caso de que falle la conexión
            console.error("Error in connection:", errorMessage);
            // Mostrar el mensaje de error en la interfaz de usuario
            $('#stateText').text(errorMessage);
        });
    } else {
        // Mostrar una alerta si no se proporciona un nombre de usuario
        alert('No username entered');
    }
}

let globalSimplifiedStates = [];

function availableGiftsimage(state) {
    const giftImages = {};

    if (!state || !state.availableGifts) {
        // Intentar obtener los datos del localStorage
        const savedStateJson = localStorage.getItem('simplifiedState');
        const savedState = JSON.parse(savedStateJson);

        // Verificar si se encontraron datos en el localStorage
        if (savedState && savedState.availableGifts) {
            // Utilizar los datos del localStorage
            state = savedState;
        } else {
            // No se encontraron datos en el localStorage, salir de la función
            console.error('No se encontraron datos de availableGifts en el localStorage.');
            return giftImages;
        }
    }

    // Obtener el contenedor donde se agregarán los cuadros
    const container = document.getElementById('giftContainer');

    // Limpiar el contenedor antes de agregar nuevos elementos
    container.innerHTML = '';

    state.availableGifts.sort((a, b) => a.diamond_count - b.diamond_count);

    // Iterar sobre los regalos disponibles
    state.availableGifts.forEach(gift => {
        const giftName = gift.name;
        const imageUrl = gift.image.url_list[1];

        // Agregar la imagen al objeto de imágenes de regalo
        giftImages[giftName] = imageUrl;

        // Crear un nuevo elemento div para el cuadro
        const giftBox = document.createElement('div');
        giftBox.classList.add('gift-box'); // Agregar una clase para el estilo

        // Crear una imagen para el regalo
        const giftImage = document.createElement('img');
        giftImage.src = imageUrl; // Aquí obtienes la URL de la imagen del segundo elemento de url_list
        giftImage.alt = giftName; // Suponiendo que `name` es el nombre del regalo
        giftBox.appendChild(giftImage); // Agregar la imagen al cuadro

        // Crear un elemento de texto para el nombre del regalo
        const giftNameText = document.createElement('p');
        giftNameText.textContent = `${giftName} ${gift.diamond_count}🌟`;
        giftBox.appendChild(giftNameText); // Agregar el nombre al cuadro

        // Agregar el cuadro de regalo al contenedor
        container.appendChild(giftBox);
    });

    // Convertir el estado a un objeto simplificado
    const simplifiedState = {
        availableGifts: state.availableGifts.map(gift => ({
            name: gift.name,
            diamondcost:  gift.diamond_count,
            giftId: gift.id,
            imageUrl: gift.image.url_list[1]
        }))
    };

    // Convertir el estado simplificado a JSON
    const simplifiedStateJson = JSON.stringify(state);
    globalSimplifiedStates.push(simplifiedState);

    // Guardar el estado simplificado en el localStorage
    localStorage.setItem('simplifiedState', simplifiedStateJson);

    return giftImages;
}

class Groups {
    static start() {
        popup_groups.querySelector("[name=close]").onclick = e => Groups.hide();
        popup_groups.onclick = e => { e.target === e.currentTarget && Groups.hide() };
        alerts_groups.onclick = e => Groups.display(config.alerts.groups, alerts_groups);
        tts_groups.onclick = e => Groups.display(config.tts.groups, tts_groups);
        Groups.update();
    }

    static update() {
        [config.alerts.groups, config.tts.groups].forEach(e => e.forEach(x => {
            if (!globalSimplifiedStates.includes(x))
                globalSimplifiedStates.push(x);
        }));
        group_list.innerHTML = globalSimplifiedStates.map((e, i) => "<label><input type=checkbox name=" + e + ">" + e + "</label>").join("");
    }

    static display(input) {
        group_list.querySelectorAll("input").forEach(e => {
            e.checked = globalSimplifiedStates.includes(e.name);
            e.onchange = (e => {
                array_toggle(globalSimplifiedStates, e.target.name);
                input.value = globalSimplifiedStates.join(", ");
                Config.save();
            });
        });
        popup_groups.classList.remove("hide");
        document.addEventListener('keydown', Groups.hide);
    }

    static hide(e) {
        if (e && e.keyCode !== 27)
            return;
        popup_groups.classList.add("hide");
        document.removeEventListener('keydown', Groups.hide);
    }
}

// Cargar los datos del localStorage al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    const simplifiedStateJson = localStorage.getItem('simplifiedState');
    if (simplifiedStateJson) {
        const state = JSON.parse(simplifiedStateJson);
        console.log(" recibe state localstorage",state);
    }
});



// Prevent Cross site scripting (XSS)
function sanitize(text) {
    if (text) { // Verifica si la entrada no es undefined
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    } else {
        return ''; // Devuelve una cadena vacía si la entrada es undefined
    }
}

function updateRoomStats() {
    $('#roomStats').html(`Espectadores: <b>${viewerCount.toLocaleString()}</b><br>Likes: <b>${likeCount.toLocaleString()}</b><br>Diamantes: <b>${diamondsCount.toLocaleString()}</b>`);
}


function generateUsernameLink(data) {
    return `<a class="usernamelink" href="https://www.tiktok.com/@${data.uniqueId}" target="_blank">${data.uniqueId}</a>`;
}

function isPendingStreak(data) {
    return data.giftType === 1 && !data.repeatEnd;
}
/**
 * Add a new message to the chat container
 */
let lastMessage = "";
let lastNickname = "";
function addChatItem(color, data, text, summarize) {
    let container = location && location.href ? (location.href.includes('obs.html') ? $('.eventcontainer') : $('.chatcontainer')) : $('.chatcontainer');
    if (container.find('div').length > 500) {
        container.find('div').slice(0, 200).remove();
    }
    const inputValue = userpointsInput.value;
    const parsedValue = parseInt(inputValue);
    if (!userPoints[data.nickname]) {
    if (!isNaN(parsedValue)) {
        // Si es un número válido, sumarlo al puntaje del usuario
        userPoints[data.nickname] = parsedValue * 2;
      } else {
        // Si no es un número válido, utilizar el valor por defecto de 5
        userPoints[data.nickname] = 10;
      }
    }
    // Modificación para eliminar o reemplazar los caracteres especiales
    container.find('.temporary').remove();;

    container.append(`
        <div class=${summarize ? 'temporary' : 'static'}>
            <img class="miniprofilepicture" src="${data.profilePictureUrl}">
            <span>
                <b>${generateUsernameLink(data)}:</b> 
                <span style="color:${color}">${sanitize(text)}</span>

            </span>
        </div>
    `);
    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 400);
    let filterWordsInput = document.getElementById('filter-words').value;
    let filterWords = (filterWordsInput.match(/\/(.*?)\//g) || []).map(word => word.slice(1, -1));
    let remainingWords = filterWordsInput.replace(/\/(.*?)\//g, '');
    filterWords = filterWords.concat(remainingWords.split(/\s/).filter(Boolean));
    let lowerCaseText = text && text.toLowerCase() && text.replace(/[^a-zA-Z0-9áéíóúüÜñÑ.,;:!?¡¿'"(){}[\]\s]/g, '');
    let sendsoundCheckbox = document.getElementById('sendsoundCheckbox');
    if (sendsoundCheckbox.checked) {
        playSoundByText(text);
    }
    
    const customFilterWords = [
        "opahsaron", "tedesku", "unanimalh", "doketesam", "unmachetedesfigurolacara",
        "Votame", "botatu", "ardah", "vhiolar", "yoagolokeh", "tihtuh", "demih", "petatemah",
        "tonash", "klezyanas", "onunasko", "melavosh", "tttthummamma", "vansokonun", "beshilketiensh",
        "ghram", "thekomeshtu", "phuto", "bherga", "chivholitos", "endopreh", "ejakah", "nenegrho",
        "pordio0", "ñateh", "graphuta", "portuhkabeh", "poniatazo", "tumamalaneh", "belkuh", "lodedah", "satejar",
        "eztesujeto", "miliah", "datufa",
        "chupa", "phinga", "haciah", "tiradoenelpuen", "tolasvo", "pidocalen", "péné",
        "joshua.ticona", "welcome", "wó", "jaja", "30hp", "phyngal", "0hp", "ijodephutha",
        "tucuh", "darunapa", "belkun", "ª", "teboyasacarlamih", "nodeni", "narentukara",
        "pides", "graphuta", "tumamalaneh", "mentirachupamibhrgha", "ilagranpehra",
        "rretiyeroijoepuhta", "astakeh", "directo", "comparti", "kameh", "neenunaba",
        "gobioh", "@admin", "comerh", "azekkk", "kometeh", "miqaqa", "mabaslapin",
        "íbamaos", "sigue", "éramoschivolitos", "enguyete", "soychih", "Yaaaaaaa",
        "grospeh", "tolaphin", "enapretadi", "ginadebe", "gokareka", "medarisaestepela",
        "drehesunazohrra", "unahpros", "🐈‍⬛", "kuloh", "kasinoh", "muchosh", "babhosoh",
        "nalditha", "wª", "bahsura", "anopahsaron", "tedesku", "unanimalh", "doketesam",
        "unmachetedesfigurolacara", "Votame", "botatu", "ardah", "vhiolar", "yoagolokeh",
        "tihtuh", "demih", "petatemah", "tonash", "klezyanas", "onunasko", "wibond", "kalateate",
        "grabadazo", "sinenbargo", "correte", "manko", "gueh", "pohortah", "queh", "rashpeh",
        "latemueh", "grih", "mhih", "ardhah", "vah", "llah", "driya", "temuh", "wi bom",
        "feh ih", "ih toh", "neh grih", "grih toh", "yosi tepar", "tola kah", "kah beza", "beza deum", "iasi temuh",
        "zojar jacha", "driya zojar", "lah driya", "+tur", "tu boca escuchaste", "ohn tu boca",
        "harda", "gemi2", "ghemi", "hemi2", "", "", "", "", "", "", "", "",
        "", "", "", "", "", "", "", "", "", "", "", "",
        "", "", "", "", "", "", "", "", "", "", "", "",

      ];

    for (let word of customFilterWords) {
        if (word && lowerCaseText.includes(word.toLowerCase())) {
            if (userPoints[data.nickname] <= 0) {
                //console.log('Usuario con 0 puntos,:', data.nickname, userPoints[data.nickname]);
                return;
            } 
            if (userPoints[data.nickname] >= 1) {
                userPoints[data.nickname]--;
                //console.log('Puntos del usuario después de la deducción:', data.nickname, userPoints[data.nickname]);
                return;
            }
            if (userPoints[data.nickname] >= 30) {
                //userPoints[data.nickname]--;
                //console.log('Puntos del usuario después de la deducción:', data.nickname, userPoints[data.nickname]);
            }
        }
    }

    for (let word of filterWords) {
        if (word && lowerCaseText.includes(word.toLowerCase())) {
            if (userPoints[data.nickname] <= 2) {
                //console.log('Usuario con 0 puntos,:', data.nickname, userPoints[data.nickname]);
                return;
            } 
            if (userPoints[data.nickname] >= 2) {
                userPoints[data.nickname]--;
                //console.log('Puntos del usuario después de la deducción:', data.nickname, userPoints[data.nickname]);
                return;
            }
            if (userPoints[data.nickname] >= 30) {
                userPoints[data.nickname]--;
                //console.log('Puntos del usuario después de la deducción:', data.nickname, userPoints[data.nickname]);
            }
        }
    }

    const specialChars = /[#$%^&*()/,.?":{}|<>]/;
    const startsWithSpecialChar = specialChars.test(text.charAt(0));
    const messagePrefix = startsWithSpecialChar ? "!" : "";
    const messageSuffix = summarize ? "" : ` ${text}`;
    let cleanedText = text;
    if (startsWithSpecialChar) {
        cleanedText = text.replace(/[@#$%^&*()/,.?":{}|<>]/, ""); // Elimina o reemplaza los caracteres especiales al comienzo del texto con "!"
    }
    cleanedText = text.replace(/[#$%^&*/,.":{}|<>]/, "");
    let emojiRegex = /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/ug;
    let emojis = text && text.match(emojiRegex);
    if (emojis) {
        let emojiCounts = {};
        for (let emoji of emojis) {
            if (emoji in emojiCounts) {
                emojiCounts[emoji]++;
            } else {
                emojiCounts[emoji] = 1;
            }

            if (emojiCounts[emoji] >= 2) {
                return;
            }
        }
    }
    const message = messagePrefix + (cleanedText.length > 60 ? `${data.nickname} dice ${messageSuffix}` : cleanedText);
    let nickname = data.nickname;
    
    if (message === lastMessage) {
        return;
    }
    
    // Comparar mensajes basados en longitud y similitud de caracteres
    if (Math.abs(message.length - lastMessage.length) <= 2) {
        const messageSet = new Set(message);
        const lastMessageSet = new Set(lastMessage);
        const intersection = new Set([...messageSet].filter(x => lastMessageSet.has(x)));
        const uniqueCharsDiff = Math.abs(messageSet.size - lastMessageSet.size);
        if (uniqueCharsDiff <= 2 && intersection.size >= message.length - 2) {
            console.log('Mensajes similares encontrados.',message);
        }
    }
    
    // Filtrar mensajes de usuarios con pocos puntos
    
    lastMessage = message;
    const regex = /(.)\1{7,}/g;
    const matches = lowerCaseText.match(regex);
    
    if (matches && matches.length > 0) {
        console.log(`Se encontraron repeticiones de 1, 2 o 3 caracteres seguidamente más de 8 veces.`);
        return;
    }
    let nameuser = data.uniqueId; 
    let filterUsersInput = document.getElementById('filter-users').value;
    let lowerCaseUser = nameuser.toLowerCase();
    let filterUsers = filterUsersInput.toLowerCase().split(/\s+/);
    if (filterUsers.includes(lowerCaseUser)) {
        console.log("usuario de WhiteList", lowerCaseUser);
        enviarCommandID('chat', message);
    /* */    playSoundByText(message);
        leerMensajes(message);
        enviarMensaje(message);
        return;
    }

    const customfilterWords = [
        "opahsaron", "tedesku", "unanimalh", "doketesam", "unmachetedesfigurolacara",
        "Votame", "botatu", "ardah", "vhiolar", "yoagolokeh", "tihtuh", "demih", "petatemah",
        "tonash", "klezyanas", "onunasko", "melavosh", "tttthummamma", "vansokonun", "beshilketiensh",
        "ghram", "thekomeshtu", "phuto", "bherga", "chivholitos", "endopreh", "ejakah", "nenegrho",
        "pordio0", "ñateh", "graphuta", "portuhkabeh", "poniatazo", "tumamalaneh", "belkuh", "lodedah", "satejar",
        "eztesujeto", "miliah", "datufa",
        "chupa", "phinga", "haciah", "tiradoenelpuen", "tolasvo", "pidocalen", "péné",
        "joshua.ticona", "welcome", "wó", "jaja", "30hp", "phyngal", "0hp", "ijodephutha",
        "tucuh", "darunapa", "belkun", "ª", "teboyasacarlamih", "nodeni", "narentukara",
        "pides", "graphuta", "tumamalaneh", "mentirachupamibhrgha", "ilagranpehra",
        "rretiyeroijoepuhta", "astakeh", "directo", "comparti", "kameh", "neenunaba",
        "gobioh", "@admin", "comerh", "azekkk", "kometeh", "miqaqa", "mabaslapin",
        "íbamaos", "sigue", "éramoschivolitos", "enguyete", "soychih", "Yaaaaaaa",
        "grospeh", "tolaphin", "enapretadi", "ginadebe", "gokareka", "medarisaestepela",
        "drehesunazohrra", "unahpros", "🐈‍⬛", "kuloh", "kasinoh", "muchosh", "babhosoh",
        "nalditha", "wª", "bahsura", "anopahsaron", "tedesku", "unanimalh", "doketesam",
        "unmachetedesfigurolacara", "Votame", "botatu", "ardah", "vhiolar", "yoagolokeh",
        "tihtuh", "demih", "petatemah", "tonash", "klezyanas", "onunasko", "wibond", "kalateate",
        "grabadazo", "sinenbargo", "correte", "manko", "gueh", "pohortah", "queh", "rashpeh",
        "latemueh", "grih", "mhih", "ardhah", "vah", "llah", "driya", "temuh", "wi bom",
        "feh ih", "ih toh", "neh grih", "grih toh", "yosi tepar", "tola kah", "kah beza", "beza deum", "iasi temuh",
        "zojar jacha", "driya zojar", "lah driya", "+tur", "tu boca escuchaste", "ohn tu boca",
        "harda", "gemi2", "ghemi", "hemi2",

      ];
      
    for (let word of customfilterWords) {
        if (word && lowerCaseText.includes(word.toLowerCase())) {
            if (userPoints[data.nickname] <= 0) {
                userPoints[data.nickname]--;
                //console.log('Usuario con 0 puntos,:', data.nickname, userPoints[data.nickname]);
                return;
            } 
            if (userPoints[data.nickname] >= 1) {
                userPoints[data.nickname]--;
                //console.log('Puntos del usuario después de la deducción:', data.nickname, userPoints[data.nickname]);
                return;
            }
        }
    }

    for (let word of filterWords) {
        if (word && lowerCaseText.includes(word.toLowerCase())) {
            console.log(message + 'filterwords__dirname=');
        return;  
        }
    }

    let sendDataCheckbox = document.getElementById('sendDataCheckbox');
    
    let userpointsCheckbox = document.getElementById('userpointsCheckbox');

    if (userpointsCheckbox.checked) {
        //console.log(userpointsCheckbox)
        if (userPoints[data.nickname] <= 0) {
            //console.log('Usuario con 0 puntos,userpointsCheckbox:', data.nickname, userPoints[data.nickname]);
            return;
        }
    }

    if (text.length <= 7) {
        if (userPoints[data.nickname] <= 0) {
            //console.log('Usuario con 0 puntos, mensaje omitido:', data.nickname, userPoints[data.nickname]);
            return;
        }
    }
    if (text.length <= 3) {
            return;
    }
    if (sendDataCheckbox.checked) {
        if (startsWithSpecialChar) {
            if (userPoints[data.nickname] <= 4) {
                console.log('Usuario con 0 puntos, mensaje omitido:', data.nickname, userPoints[data.nickname]);
            }
        }
        enviarMensaje(message);
    }

    leerMensajes(message);
    if (nickname !== lastNickname) {
        if (!isNaN(parsedValue)) {
            // Si es un número válido, sumarlo al puntaje del usuario
            userPoints[data.nickname] += parsedValue;
          } else {
            // Si no es un número válido, utilizar el valor por defecto de 5
            userPoints[data.nickname] += 2;
          }
        console.log(`el usuario ${data.nickname}tiene mas puntos`,userPoints[data.nickname]);
    }
    if (sendsoundCheckbox.checked) {
        if (nickname !== lastNickname) {
            playSoundByText(message);
        }
        userPoints[data.nickname]--;
        lastNickname = nickname
    }

    if (sendDataCheckbox.checked) {
        if (userPoints[data.nickname] <= 3) {
            //console.log('Usuario con 0 puntos, mensaje omitido:', data.nickname, userPoints[data.nickname]);
            return;
        }
        if (nickname !== lastNickname) {
            userPoints[data.nickname] -= 1;
            enviarCommandID( 'chat', message);
    /* */        lastNickname = nickname
        }
    }
}

function isValidUrl(string) {
    try {
        new URL(string);
    } catch (_) {
        return false;
    }

    return true;
}

let lastEvent = null;
let eventDivs = {};
let giftCounters = {};
let lastFilteredPositions = [];
let lastFilteredPositionIndex = 0;

let userStats = {};

connection.on('like', (data) => {
    if (typeof data.totalLikeCount === 'number') {
        likeCount = data.totalLikeCount;
        updateRoomStats();
    }
    // Initialize user's stats
    if (!userStats[data.uniqueId]) {
        userStats[data.uniqueId] = { likes: 0, totalLikes: 0, milestone: 50 };
    }

    // Increment user's like count and total like count
    userStats[data.uniqueId].likes += data.likeCount;
    userStats[data.uniqueId].totalLikes += data.likeCount;

    // Check if user's like count has reached the milestone
    let sendDataCheckbox = document.getElementById('sendDataCheckbox');
    while (sendDataCheckbox.checked && userStats[data.uniqueId].likes >= userStats[data.uniqueId].milestone && userStats[data.uniqueId].milestone <= 500) {
        const milestoneLikes = `${userStats[data.uniqueId].milestone}LIKES`;

        console.log('Milestone Likes:', milestoneLikes);
        enviarCommandID( 'likes', `${userStats[data.uniqueId].milestone}LIKES`);

        // Send data or data.uniqueId and $ likes
        addOverlayEvent('likes', data, `${userStats[data.uniqueId].milestone} likes`, 'blue', false, 1);
        handleEvent2('likes', data);
        userStats[data.uniqueId].likes -= userStats[data.uniqueId].milestone; // Deduct milestone likes from user's like count
        userStats[data.uniqueId].milestone += 50; // Increase the milestone
        userPoints[data.nickname] + 15;
        userPoints[data.nickname] += 15;
        if (userStats[data.uniqueId].milestone > 300) {
            userStats[data.uniqueId].milestone = 50; // Reset the milestone
        }
    }
});

let overlaypage = false;
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('overlayForm').addEventListener('submit', function(event) {
        event.preventDefault();
        const url = document.getElementById('urlInput').value;
        const width = "100%";
        const height = "100%";
        addOverlayEvent('Newiframe', { url, width, height });        
    });
    
});


function addOverlayEvent(eventType, data) {
        let overlayOff = document.getElementById('overlayOff');
        if (overlayOff.checked) {
            let overlayPage = null;
            if (!overlayPage || overlayPage.closed) {
                overlayPage = window.open('index2.html', 'transparent', 'width=auto,height=auto,frame=false,transparent=true,alwaysOnTop=true,nodeIntegration=no');
                }
            const event = new CustomEvent('pageAB', { detail: { eventType, indexData: data }});
            overlayPage.dispatchEvent(event);
        }
}

//        pageB = window.open('index2.html', 'transparent', 'width=auto,height=auto,frame=false,transparent=true,nodeIntegration=no');
//        pageB = window.open('index2.html', 'transparent', 'width=auto,height=auto,frame=true,transparent=false,nodeIntegration=no');

// Resto del código...
/** ID[${data.giftId}] id regalo
 * Agregar un nuevo regalo al contenedor de regalos
 */
function addGiftItem(data) {
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.giftcontainer');
    if (container.find('div').length > 200) {
        container.find('div').slice(0, 100).remove();
    }

    let streakId = data.userId.toString() + '_' + data.giftId;
    let totalDiamonds = data.diamondCount * data.repeatCount;
    let giftIconSize = 150; // Tamaño base del icono del regalo
    if (totalDiamonds > 100) {
        giftIconSize += totalDiamonds; // Aumenta el tamaño del icono del regalo en 1 píxel por cada diamante
    }
    const profilePictureUrl = isValidUrl(data.profilePictureUrl) ? data.profilePictureUrl : 'url_de_imagen_por_defecto';
    const giftPictureUrl = isValidUrl(data.giftPictureUrl) ? data.giftPictureUrl : 'url_de_imagen_por_defecto';

    let html = `
      <div data-streakid=${isPendingStreak(data) ? streakId : ''}>
          <img class="miniprofilepicture" src="${profilePictureUrl}">
          <span>
              <b>${generateUsernameLink(data)}:</b> <span><span style="color: ${data.giftName ? 'purple' : 'black'}">${data.giftName}</span></span></span><br>
              <div>
                  <table>
                      <tr>
                          <td><img class="gifticon" src="${giftPictureUrl}" style="width: ${giftIconSize}px; height: ${giftIconSize}px;"></td>
                          <td>
                              <span><b style="${isPendingStreak(data) ? 'color:red' : ''}">x${data.repeatCount.toLocaleString()} : ${(data.diamondCount * data.repeatCount).toLocaleString()} Diamantes </b><span><br>
                          </td>
                      </tr>
                  </table>
              </div>
          </span>
      </div>
    `;

    let existingStreakItem = container.find(`[data-streakid='${streakId}']`);

    if (existingStreakItem.length) {
        existingStreakItem.replaceWith(html);
    } else {
        container.append(html);
    }


    let sendsoundCheckbox = document.getElementById('sendsoundCheckbox');

    if (sendsoundCheckbox.checked) {
        for (let i = 0; i < data.repeatCount; i++) {

            playSound(data.giftName);

        }
    }
    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 800);
}

// viewer stats
connection.on('roomUser', (data) => {
    if (typeof data.viewerCount === 'number') {
        viewerCount = data.viewerCount;
        updateRoomStats();
    }
})

// Member join
let joinMsgDelay = 0;
// Member join
connection.on('member', (data) => {

    if (window.settings.showJoins === "0") return;

    let addDelay = 250;
    if (joinMsgDelay > 500) addDelay = 100;
    if (joinMsgDelay > 1000) addDelay = 0;

    joinMsgDelay += addDelay;

    setTimeout(() => {
        joinMsgDelay -= addDelay;
        addChatItem('#CDA434', data, 'welcome', true);
        addOverlayEvent('welcome', data);
        message = data.uniqueId;
        handleEvent2('welcome', data, message, null, data);
    }, joinMsgDelay);
})
let processedMessages = {};
let lastComments = [];
let lastTenMessages = [];
let userPoints = {};

connection.on('chat', (data) => {
    const inputValue = userpointsInput.value;
    const parsedValue = parseInt(inputValue);
    if (!userPoints[data.nickname]) {
        if (!isNaN(parsedValue)) {
            // Si es un número válido, sumarlo al puntaje del usuario
            userPoints[data.nickname] = parsedValue * 2;
        } else {
            // Si no es un número válido, utilizar el valor por defecto de 5
            userPoints[data.nickname] = 10;
        }
        //console.log("puntos asignados",data.nickname,userPoints[data.nickname]);
    }
    let message = data.comment; 
    let nameuser = data.uniqueId; 
    let filterWordsInput = document.getElementById('filter-words').value;
    let filterWords = (filterWordsInput.match(/\/(.*?)\//g) || []).map(word => word.slice(1, -1));
    let remainingWords = filterWordsInput.replace(/\/(.*?)\//g, '');
    filterWords = filterWords.concat(remainingWords.split(/\s/).filter(Boolean));
    let lowerCaseText = message.toLowerCase();
    let filterUsersInput = document.getElementById('filter-users').value;
    let lowerCaseUser = nameuser.toLowerCase();
    let filterUsers = filterUsersInput.toLowerCase().split(/\s+/);
    addOverlayEvent('chat', data);

    if (filterUsers.includes(lowerCaseUser)) {
        console.log("WhiteList", lowerCaseUser);
        addChatItem('', data, message);
        sendToServer('chat', data);
        handleEvent2('chat', data);
        return;
      }
    for (let word of filterWords) {
        if (word && lowerCaseText.includes(word.toLowerCase())) {
            userPoints[data.nickname] -= 1;
            
        }
        if (userPoints[data.nickname] >= 1) {
            userPoints[data.nickname] -= 1;
            //console.log('Puntos del usuario después de la deducción:', data.nickname, userPoints[data.nickname]);
        } 
    }


    if (window.settings.showChats === "0") return;

    addChatItem('', data, message);
    sendToServer('chat', data);
    handleEvent2('chat', data);

    if (message === lastMessage) {
        return;
    }

    lastMessage = message;
    let tiempoActual = Math.floor(Date.now() / 1000);

    if (tiempoActual - data.ultimoTiempo <= 60) {
        return data.nickname; // Retorna la cantidad actual de puntos sin cambios
    }

    data.ultimoTiempo = tiempoActual;
    return data.nickname;
});
// New gift received
connection.on('gift', (data) => {
    if (!userPoints[data.nickname]) {
        userPoints[data.nickname] = 10; // Asignar 10 puntos por defecto
    } else if (userPoints[data.nickname] >= 1) {
        userPoints[data.nickname] += 10;
        userPoints[data.nickname] + 10;
        //console.log('Puntos aumentados:', data.nickname, userPoints[data.nickname]);
    }
    if (sendDataCheckbox.checked) {
    enviarCommandID( 'gift', data)/* */;
    }
    addOverlayEvent('gift',data, data.giftPictureUrl, 'red', true, data.repeatCount);
    handleEvent('gift', data, `${data.uniqueId}:${data.giftName}x${data.repeatCount} `);
    sendToServer('gift', data, `${data.uniqueId}:${data.giftName}x${data.repeatCount} `);

    if (!isPendingStreak(data) && data.diamondCount > 0) {
        diamondsCount += (data.diamondCount * data.repeatCount);

        userPoints[data.nickname] + data.diamondCount;
        updateRoomStats();
    }

    if (window.settings.showGifts === "0") return;
    addGiftItem(data);
})

// share, follow
let seguidores = new Set();

connection.on('social', (data) => {
    if (window.settings.showFollows === "0") return;
    let color;
    let message;
    let sendDataCheckbox = document.getElementById('sendDataCheckbox');

    if (data.displayType.includes('follow')) {
        color = '#CDA434'; // Cambia esto al color que quieras para los seguidores
        message = `${data.nickname} te sige`;
        if (sendDataCheckbox.checked) {
            if (!seguidores.has(data.nickname)) {
                enviarCommandID( 'follow', data);
 /* */               handleEvent2('follow', data);
                sendToServer('follow', data);
                addOverlayEvent('follow', data);
                console.log(`${data.nickname} es un gato mas`);
                seguidores.add(data.nickname);
                // Establecer un temporizador para eliminar data.uniqueId de seguidores después de 5 minutos
                setTimeout(() => {
                    seguidores.delete(data.nickname);
                }, 60000); // 5 minutos
            }
        }
    } else if (data.displayType.includes('share')) {
        color = '#CDA434'; // Cambia esto al color que quieras para las comparticiones
        message = `${data.nickname} compartió el directo`;
        handleEvent2('share', data);
        addOverlayEvent('share', data);
        if (sendDataCheckbox.checked) {
            enviarCommandID( 'share', data);
   /* */     }
    } else {
        color = '#CDA434'; // Color por defecto
        message = data.label.replace('{0:user}', '');
    }

    addChatItem(color, data, message);
    sendToServer('social', data, null, color, message);
});

connection.on('streamEnd', () => {

    $('#stateText').text('Transmisión terminada.');

    // schedule next try if obs username set
    if (window.settings.username) {
        setTimeout(() => {
            connect(window.settings.username);
        }, 30000);
    }
    message = 'Transmisión terminada.';

    // Send data to server
    sendToServer('streamEnd', message);
})

connection.on('questionNew', data => {
    // Crear modal
    const modal = document.createElement('div');
    modal.classList.add('modal');
    
    // Contenido de la modal
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>${data.nickname} asks:</h2>
            <p>${data.questionText}</p>
        </div>
    `;
    
    // Agregar modal al cuerpo del documento
    document.body.appendChild(modal);
    
    // Cerrar modal cuando se hace clic en la "x"
    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
});
/*
const battleBar = document.getElementById('battle-bar');
const user1 = document.getElementById('user-1');
const user2 = document.getElementById('user-2');
const battleStatus = document.getElementById('battle-status');

connection.on('linkMicBattle', (data) => {
console.log(`New Battle: ${data.battleUsers[0].uniqueId} VS ${data.battleUsers[1].uniqueId}`,data);
/*user1.querySelector('.username').textContent = data.battleUsers[0].uniqueId;
user2.querySelector('.username').textContent = data.battleUsers[1].uniqueId;
battleStatus.textContent = 'Battle in Progress'
});

connection.on('linkMicArmies', (data) => {
console.log('linkMicArmies', data);
user1.querySelector('.points').textContent = data.battleArmies[0].points;
user2.querySelector('.points').textContent = data.battleArmies[1].points;
if (data.battleStatus === 1) {
    battleStatus.textContent = 'Battle in Progress';
} else if (data.battleStatus === 2) {
    battleStatus.textContent = 'Battle Ended';
}
});*/

  
connection.on('liveIntro', (msg) => {
    console.log('User Details:', msg.description);
    console.log('Nickname:', msg.nickname);
    console.log('Unique ID:', msg.uniqueId);
});

connection.on('emote', (data) => {
    console.log(`${data.uniqueId} emote!`);
    console.log('emote received', data);
})
connection.on('envelope', data => {
    console.log('Unique ID:', data.uniqueId);
    console.log('Coins:', data.coins);
    fetchAudio(`${data.uniqueId} envio cofre de ${data.coins} monedas para ${data.canOpen} personas`);
});

connection.on('subscribe', (data) => {
    console.log(`${data.uniqueId} subscribe!`);
})
let comandosConNombres = null;

async function obtenerPaginaDeComandos() {
    if (comandosConNombres) {
        // Si ya tenemos la lista de comandos, simplemente la devolvemos
        return comandosConNombres;
    }

    const listaComandos = [];
    const pageSize = 100;
    let skip = 0;

    try {
        const response = await fetch(`http://localhost:8911/api/commands?skip=${skip}&pageSize=${pageSize}`);
        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error('La respuesta no contiene un array de comandos');
        }

        const comandos = data;
        listaComandos.push(...comandos);

        if (comandos.length === pageSize) {
            skip += pageSize;
            // Recursivamente obtenemos más comandos si es necesario
            return obtenerPaginaDeComandos();
        } else {
            listaComandos.forEach(cmd => {
                if (!cmd || cmd < 1) {
                    console.error('Comando ignorado:', cmd);
                    return;
                }
            });

            const MAX_COMMANDS = 100;
            const comandosLimitados = listaComandos.slice(0, MAX_COMMANDS);
            
            // Crear una lista de objetos con el ID y el nombre de cada comando
            comandosConNombres = comandosLimitados.map(cmd => ({
                commandId: cmd.ID,
                commandName: cmd.Name,
                Type: cmd.Type,
                IsEnabled: cmd.IsEnabled,
                Unlocked: cmd.Unlocked,
                GroupName: cmd.GroupName
            }));

            // Almacenar la lista de comandos obtenida
            return comandosConNombres;
        }
    } catch (error) {
        console.error('Error al obtener la página de comandos:', error);
        throw error;
    }
}

let ultimoEnvio = 0;

async function enviarCommandID(eventType, data) {
    let Command;
    if (eventType === "gift") {
        Command = data.giftName;
    } else if (eventType === "likes" || eventType === "chat") {
        Command = data;
    } else if (eventType === "follow") {
        Command = "FOLLOW";
    } else if (eventType === "share") {
        Command = "share";
    }

    // Obtener la lista de comandos si aún no la tenemos
    comandosConNombres = comandosConNombres || await obtenerPaginaDeComandos();

    console.log('Lista de comandos recibida:', comandosConNombres);

    // Buscar el comando correspondiente al commandName
    const comandoEncontrado = comandosConNombres.find(comando => {
        const commandNameParts = comando.commandName.toLowerCase().split(' ');
        return commandNameParts.includes(Command.toLowerCase());
    });

    // Verificar si se encontró el comando
    if (comandoEncontrado) {
        const tiempoActual = Date.now();
        const tiempoDiferencia = tiempoActual - ultimoEnvio;
        const tiempoRestante = Math.max(0, 5000 - tiempoDiferencia); // 5000 ms = 5 segundos

        setTimeout(() => {
            fetch(`http://localhost:8911/api/commands/${comandoEncontrado.commandId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: comandoEncontrado.commandId,
                    name: comandoEncontrado.commandName,
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                console.log('Comando enviado:', comandoEncontrado.commandName);
                ultimoEnvio = Date.now();
            })
            .catch(error => {
                console.error('Error al enviar el comando:', error, comandoEncontrado.commandId);
            });
        }, tiempoRestante);
    } else {
        console.error('No se encontró un comando con el nombre:', Command);
    }
}



// Ejemplo de uso:
obtenerPaginaDeComandos(comandos => {
    // Aquí puedes hacer lo que quieras con la lista de comandos y nombres
    console.log('Lista de comandos y nombres:', comandos);
});

var audio, chatbox, button, channelInput, audioqueue, isPlaying, add, client, skip;

const TTS_API_ENDPOINT = 'https://api.streamelements.com/kappa/v2/speech?'; // unprotected API - use with caution
const PRONOUN_API_ENDPOINT = 'https://pronouns.alejo.io/api/users/';
const maxMsgInChat = 2 * 10;
const DESCENDING = true; // newest on top
const VOICE_PREFIX = '&';
const pronoun_DB = {}; // username -> pronound_id
const FEM_PRONOUNS = ['sheher', 'shethey'];
var CHANNEL_BLACKLIST = [
    'streamlabs',
    'streamelements',
    'moobot',
    'nightbot',
    'ch4tsworld',
    'streamstickers',
    'laia_bot',
    'soundalerts',
    'ankhbot',
    'phantombot',
    'wizebot',
    'botisimo',
    'coebot',
    'deepbot',
];
var VOICE_LIST = {
    "Penélope (Spanish, American)": "Penelope",
    "Miguel (Spanish, American)": "Miguel",
    "Enrique (Spanish, European)": "Enrique",
    "Conchita (Spanish, European)": "Conchita",
    "Mia (Spanish, Mexican)": "Mia",
    "Rosalinda (Spanish, Castilian)": "Rosalinda Standard",
    "Brian (English, British)": "Brian",
    "Amy (English, British)": "Amy",
    "Emma (English, British)": "Emma",
    "Geraint (English, Welsh)": "Geraint",
    "Russell (English, Australian)": "Russell",
    "Nicole (English, Australian)": "Nicole",
    "Joey (English, American)": "Joey",
    "Justin (English, American)": "Justin",
    "Matthew (English, American)": "Matthew",
    "Ivy (English, American)": "Ivy",
    "Joanna (English, American)": "Joanna",
    "Kendra (English, American)": "Kendra",
    "Kimberly (English, American)": "Kimberly",
    "Salli (English, American)": "Salli",
    "Raveena (English, Indian)": "Raveena",
    "Zhiyu (Chinese, Mandarin)": "Zhiyu",
    "Mads (Danish)": "Mads",
    "Naja (Danish)": "Naja",
    "Ruben (Dutch)": "Ruben",
    "Lotte (Polly) (Dutch)": "Lotte",
    "Mathieu (French)": "Mathieu",
    "Céline (French)": "Celine",
    "Chantal (French, Canadian)": "Chantal",
    "Hans (German)": "Hans",
    "Marlene (German)": "Marlene",
    "Vicki (German)": "Vicki",
    "Aditi (+English) (Hindi)": "Aditi",
    "Karl (Icelandic)": "Karl",
    "Dóra (Icelandic)": "Dora",
    "Carla (Italian)": "Carla",
    "Bianca (Italian)": "Bianca",
    "Giorgio (Italian)": "Giorgio",
    "Takumi (Japanese)": "Takumi",
    "Mizuki (Japanese)": "Mizuki",
    "Seoyeon (Korean)": "Seoyeon",
    "Liv (Norwegian)": "Liv",
    "Ewa (Polish)": "Ewa",
    "Maja (Polish)": "Maja",
    "Jacek (Polish)": "Jacek",
    "Jan (Polish)": "Jan",
    "Ricardo (Portuguese, Brazilian)": "Ricardo",
    "Vitória (Portuguese, Brazilian)": "Vitoria",
    "Cristiano (Portuguese, European)": "Cristiano",
    "Inês (Portuguese, European)": "Ines",
    "Carmen (Romanian)": "Carmen",
    "Maxim (Russian)": "Maxim",
    "Tatyana (Russian)": "Tatyana",
    "Astrid (Swedish)": "Astrid",
    "Filiz (Turkish)": "Filiz",
    "Gwyneth (Welsh)": "Gwyneth",
    "Carter (English, American)": "en-US-Wavenet-A",
    "Paul (English, American)": "en-US-Wavenet-B",
    "Evelyn (English, American)": "en-US-Wavenet-C",
    "Liam (English, American)": "en-US-Wavenet-D",
    "Jasmine (English, American)": "en-US-Wavenet-E",
    "Madison (English, American)": "en-US-Wavenet-F",
    "Mark (English, American)": "en-US-Standard-B",
    "Vanessa (English, American)": "en-US-Standard-C",
    "Zachary (English, American)": "en-US-Standard-D",
    "Audrey (English, American)": "en-US-Standard-E",
    "Layla (English, British)": "en-GB-Standard-A",
    "Ali (English, British)": "en-GB-Standard-B",
    "Scarlett (English, British)": "en-GB-Standard-C",
    "Oliver (English, British)": "en-GB-Standard-D",
    "Bella (English, British)": "en-GB-Wavenet-A",
    "John (English, British)": "en-GB-Wavenet-B",
    "Victoria (English, British)": "en-GB-Wavenet-C",
    "Ron (English, British)": "en-GB-Wavenet-D",
    "Zoe (English, Australian)": "en-AU-Standard-A",
    "Luke (English, Australian)": "en-AU-Standard-B",
    "Samantha (English, Australian)": "en-AU-Wavenet-A",
    "Steve (English, Australian)": "en-AU-Wavenet-B",
    "Courtney (English, Australian)": "en-AU-Wavenet-C",
    "Jayden (English, Australian)": "en-AU-Wavenet-D",
    "Ashleigh (English, Australian)": "en-AU-Standard-C",
    "Daniel (English, Australian)": "en-AU-Standard-D",
    "Anushri (English, Indian)": "en-IN-Wavenet-A",
    "Sundar (English, Indian)": "en-IN-Wavenet-B",
    "Satya (English, Indian)": "en-IN-Wavenet-C",
    "Sonya (Afrikaans)": "af-ZA-Standard-A",
    "Aisha (Arabic)": "ar-XA-Wavenet-A",
    "Ahmad 1 (Arabic)": "ar-XA-Wavenet-B",
    "Ahmad 2 (Arabic)": "ar-XA-Wavenet-C",
    "Nikolina (Bulgarian)": "bg-bg-Standard-A",
    "Li Na (Chinese, Mandarin)": "cmn-CN-Wavenet-A",
    "Wang (Chinese, Mandarin)": "cmn-CN-Wavenet-B",
    "Bai (Chinese, Mandarin)": "cmn-CN-Wavenet-C",
    "Mingli (Chinese, Mandarin)": "cmn-CN-Wavenet-D",
    "Silvia (Czech)": "cs-CZ-Wavenet-A",
    "Marie (Danish)": "da-DK-Wavenet-A",
    "Annemieke (Dutch)": "nl-NL-Standard-A",
    "Eva (Dutch)": "nl-NL-Wavenet-A",
    "Lars (Dutch)": "nl-NL-Wavenet-B",
    "Marc (Dutch)": "nl-NL-Wavenet-C",
    "Verona (Dutch)": "nl-NL-Wavenet-D",
    "Lotte (Wavenet) (Dutch)": "nl-NL-Wavenet-E",
    "Tala (Filipino (Tagalog))": "fil-PH-Wavenet-A",
    "Marianne (Finnish)": "fi-FI-Wavenet-A",
    "Yvonne (French)": "fr-FR-Standard-C",
    "Gaspard (French)": "fr-FR-Standard-D",
    "Emilie (French)": "fr-FR-Wavenet-A",
    "Marcel (French)": "fr-FR-Wavenet-B",
    "Brigitte (French)": "fr-FR-Wavenet-C",
    "Simon (French)": "fr-FR-Wavenet-D",
    "Juliette (French, Canadian)": "fr-CA-Standard-A",
    "Felix (French, Canadian)": "fr-CA-Standard-B",
    "Camille (French, Canadian)": "fr-CA-Standard-C",
    "Jacques (French, Canadian)": "fr-CA-Standard-D",
    "Karolina (German)": "de-DE-Standard-A",
    "Albert (German)": "de-DE-Standard-B",
    "Angelika (German)": "de-DE-Wavenet-A",
    "Oskar (German)": "de-DE-Wavenet-B",
    "Nina (German)": "de-DE-Wavenet-C",
    "Sebastian (German)": "de-DE-Wavenet-D",
    "Thalia (Greek)": "el-GR-Wavenet-A",
    "Sneha (Hindi)": "hi-IN-Wavenet-A",
    "Arnav (Hindi)": "hi-IN-Wavenet-B",
    "Aadhav (Hindi)": "hi-IN-Wavenet-C",
    "Ishtevan (Hungarian)": "hu-HU-Wavenet-A",
    "Helga (Icelandic)": "is-is-Standard-A",
    "Anisa (Indonesian)": "id-ID-Wavenet-A",
    "Budi (Indonesian)": "id-ID-Wavenet-B",
    "Bayu (Indonesian)": "id-ID-Wavenet-C",
    "Gianna (Italian)": "it-IT-Standard-A",
    "Valentina (Italian)": "it-IT-Wavenet-A",
    "Stella (Italian)": "it-IT-Wavenet-B",
    "Alessandro (Italian)": "it-IT-Wavenet-C",
    "Luca (Italian)": "it-IT-Wavenet-D",
    "Koharu (Japanese)": "ja-JP-Standard-A",
    "Miho (Japanese)": "ja-JP-Wavenet-A",
    "Eiko (Japanese)": "ja-JP-Wavenet-B",
    "Haruto (Japanese)": "ja-JP-Wavenet-C",
    "Eichi (Japanese)": "ja-JP-Wavenet-D",
    "Heosu (Korean)": "ko-KR-Standard-A",
    "Grace (Korean)": "ko-KR-Wavenet-A",
    "Juris (Latvian)": "lv-lv-Standard-A",
    "Nora (Norwegian, Bokmål)": "nb-no-Wavenet-E",
    "Malena (Norwegian, Bokmål)": "nb-no-Wavenet-A",
    "Jacob (Norwegian, Bokmål)": "nb-no-Wavenet-B",
    "Thea (Norwegian, Bokmål)": "nb-no-Wavenet-C",
    "Aksel (Norwegian, Bokmål)": "nb-no-Wavenet-D",
    "Amelia (Polish)": "pl-PL-Wavenet-A",
    "Stanislaw (Polish)": "pl-PL-Wavenet-B",
    "Tomasz (Polish)": "pl-PL-Wavenet-C",
    "Klaudia (Polish)": "pl-PL-Wavenet-D",
    "Beatriz (Portuguese, Portugal)": "pt-PT-Wavenet-A",
    "Francisco (Portuguese, Portugal)": "pt-PT-Wavenet-B",
    "Lucas (Portuguese, Portugal)": "pt-PT-Wavenet-C",
    "Carolina (Portuguese, Portugal)": "pt-PT-Wavenet-D",
    "Alice (Portuguese, Brazilian)": "pt-BR-Standard-A",
    "Маша (Masha) (Russian)": "ru-RU-Wavenet-A",
    "Илья (Ilya) (Russian)": "ru-RU-Wavenet-B",
    "Алёна (Alena) (Russian)": "ru-RU-Wavenet-C",
    "Пётр (Petr) (Russian)": "ru-RU-Wavenet-D",
    "Aleksandra (Serbian)": "sr-rs-Standard-A",
    "Eliska (Slovak)": "sk-SK-Wavenet-A",
    "Elsa (Swedish)": "sv-SE-Standard-A",
    "Zehra (Turkish)": "tr-TR-Standard-A",
    "Yagmur (Turkish)": "tr-TR-Wavenet-A",
    "Mehmet (Turkish)": "tr-TR-Wavenet-B",
    "Miray (Turkish)": "tr-TR-Wavenet-C",
    "Elif (Turkish)": "tr-TR-Wavenet-D",
    "Enes (Turkish)": "tr-TR-Wavenet-E",
    "Vladislava (Ukrainian)": "uk-UA-Wavenet-A",
    "Linh (Vietnamese)": "vi-VN-Wavenet-A",
    "Nguyen (Vietnamese)": "vi-VN-Wavenet-B",
    "Phuong (Vietnamese)": "vi-VN-Wavenet-C",
    "Viet (Vietnamese)": "vi-VN-Wavenet-D",
    "Linda (English, Canadian)": "Linda",
    "Heather (English, Canadian)": "Heather",
    "Sean (English, Irish)": "Sean",
    "Hoda (Arabic, Egypt)": "Hoda",
    "Naayf (Arabic, Saudi Arabia)": "Naayf",
    "Ivan (Bulgarian)": "Ivan",
    "Herena (Catalan)": "Herena",
    "Tracy (Chinese, Cantonese, Traditional)": "Tracy",
    "Danny (Chinese, Cantonese, Traditional)": "Danny",
    "Huihui (Chinese, Mandarin, Simplified)": "Huihui",
    "Yaoyao (Chinese, Mandarin, Simplified)": "Yaoyao",
    "Kangkang (Chinese, Mandarin, Simplified)": "Kangkang",
    "HanHan (Chinese, Taiwanese, Traditional)": "HanHan",
    "Zhiwei (Chinese, Taiwanese, Traditional)": "Zhiwei",
    "Matej (Croatian)": "Matej",
    "Jakub (Czech)": "Jakub",
    "Guillaume (French, Switzerland)": "Guillaume",
    "Michael (German, Austria)": "Michael",
    "Karsten (German, Switzerland)": "Karsten",
    "Stefanos (Greek)": "Stefanos",
    "Szabolcs (Hungarian)": "Szabolcs",
    "Andika (Indonesian)": "Andika",
    "Heidi (Finnish)": "Heidi",
    "Kalpana (Hindi)": "Kalpana",
    "Hemant (Hindi)": "Hemant",
    "Rizwan (Malay)": "Rizwan",
    "Filip (Slovak)": "Filip",
    "Lado (Slovenian)": "Lado",
    "Valluvar (Tamil, India)": "Valluvar",
    "Pattara (Thai)": "Pattara",
    "An (Vietnamese)": "An",
};
const VOICE_LIST_ALT = Object.keys(VOICE_LIST).map(k => VOICE_LIST[k]);
var voiceSelect = document.createElement('select');
Object.keys(VOICE_LIST).forEach(function(key) {
    var option = document.createElement('option');
    option.text = key;
    option.value = VOICE_LIST[key];
    voiceSelect.appendChild(option);
});
document.addEventListener('DOMContentLoaded', (event) => {
    var voiceSelectContainer = document.getElementById('voiceSelectContainer');
    voiceSelectContainer.appendChild(voiceSelect);
});

voiceSelect.addEventListener('change', function() {
    fetchAudio(voiceSelect.value);
});
let isReading = false;
let cache = [];
let lastText = "";
let lastComment = '';
let lastCommentTime = 0;


function enviarMensaje(message) {

    // Enviar el mensaje
    fetch("http://localhost:8911/api/v2/chat/message", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ "Message": message, "Platform": "Twitch", "SendAsStreamer": true })
        })
        .then(function(response) {
            if (response.ok) {}
        })
        .catch(function(error) {
            console.error('Error al enviar el mensaje:', error);
        });

    lastComment = message;
    lastCommentTime = Date.now();
}
class Queue {
    constructor() {
        this.items = [];
    }

    enqueue(element) {
        this.items.push(element);
    }

    dequeue() {
        if (this.isEmpty()) {
            return "Underflow";
        }
        return this.items.shift();
    }

    isEmpty() {
        return this.items.length === 0;
    }
}

function leerMensajes(text) {
    if (text && !isReading) {
        fetchAudio(text).then(audioUrl => {
            if (audioUrl) {
                audioqueue.enqueue(audioUrl);
                if (!isPlaying) kickstartPlayer();
            }
        });
    }
}

let audioQueue = [];
let lastReadText = null;
let audioMap = {};
let audioKeys = [];
let lastSelectedVoice = null;

function calculatePercentageOfAlphabets(text) {
    let alphabetCount = 0;
    for (let i = 0; i < text.length; i++) {
        if (/^[a-z]$/i.test(text[i])) {
            alphabetCount++;
        }
    }
    return (alphabetCount / text.length) * 100;
}
let lastTwoSelectedVoices = [null, null];

async function fetchAudio(txt) {
    try {
        // Si el texto es igual al último texto leído, simplemente retornar
        if (txt === lastReadText) {
            return;
        }

        // Actualizar el último texto leído
        lastReadText = txt;

        // Si el audio ya existe en el mapa, usarlo
        if (audioMap[txt]) {
            return audioMap[txt];
        }

        // Si el audio no existe en el mapa, solicitar un nuevo audio
        const resp = await fetch(TTS_API_ENDPOINT + makeParameters({ voice: selectedVoice, text: txt }));
        if (resp.status !== 200) {
            console.error("Mensaje incorrecto");
            return;
        }

        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Agregar el nuevo audio al mapa
        audioMap[txt] = blobUrl;
        audioKeys.push(txt);

        // Si el mapa tiene más de 30 audios, eliminar el audio más antiguo
        if (audioKeys.length > 30) {
            const keyToRemove = audioKeys.shift();
            delete audioMap[keyToRemove];
        }

        return blobUrl;
    } catch (error) {
        console.error("Error fetchaudio:", error);
    }
}

function makeParameters(params) {
    return Object.keys(params)
        .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
        .join('&');
}

function skipAudio() {
    audio.pause();
    audio.currentTime = 0;

    // If the queue is not empty, dequeue the next audio and start playing it
    if (!audioqueue.isEmpty()) {
        audio.src = audioqueue.dequeue();
        audio.load(); // Cargar el audio
        audio.play(); // Reproducir el audio
    } else {
        // Si no hay más elementos en la cola, simplemente restablece el estado de reproducción
        isPlaying = false;
    }
}

function kickstartPlayer() {
    // If the queue is empty, do nothing
    if (audioqueue.isEmpty()) {
        isPlaying = false;
        return;
    }

    // Dequeue the first text from the queue and fetch its audio
    isPlaying = true;
    const audioUrl = audioqueue.dequeue();
    audio.src = audioUrl;
    audio.load();
    audio.play().catch(() => {
        // If there is an error while playing the audio, try to play the next audio in the queue
        kickstartPlayer();
    });

    // When the audio ends, try to play the next audio in the queue
    audio.onended = function() {
        kickstartPlayer();
    };
}
// Crear una base de datos IndexedDB
let openRequest = indexedDB.open("audioDB", 1);

openRequest.onupgradeneeded = function() {
    let db = openRequest.result;
    if (!db.objectStoreNames.contains('audios')) {
        db.createObjectStore('audios');
    }
}

openRequest.onerror = function() {
    console.error("Error", openRequest.error);
};

openRequest.onsuccess = function() {
    let db = openRequest.result;
    db.onversionchange = function() {
        db.close();
        alert("La base de datos está obsoleta, por favor, recargue la página.");
    };
};

// Guardar un audio en la base de datos
function saveAudio(audioName, audioData) {
    let db = openRequest.result;
    let transaction = db.transaction("audios", "readwrite");
    let audios = transaction.objectStore("audios");
    let request = audios.put(audioData, audioName);

    request.onsuccess = function() {
        console.log("Audio guardado con éxito.");
    };

    request.onerror = function() {
        console.log("Error al guardar el audio.", request.error);
    };
}

// Obtener un audio de la base de datos
function getAudio(audioName) {
    let db = openRequest.result;
    let transaction = db.transaction("audios", "readonly");
    let audios = transaction.objectStore("audios");
    let request = audios.get(audioName);

    request.onsuccess = function() {
        if (request.result) {
            console.log("Audio encontrado.");
            playAudio(request.result);
        } else {
            console.log("No se encontró el audio.");
        }
    };

    request.onerror = function() {
        console.log("Error al obtener el audio.", request.error);
    };
}

// Reproducir un audio
function playAudio(audioData) {
    let audio = new Audio(audioData);
    audio.play();
}


function isValidUrl(string) {
    try {
        new URL(string);
    } catch (_) {
        return false;
    }

    return true;
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('soundForm').addEventListener('submit', function(event) {
        event.preventDefault(); // Evita que el formulario se envíe y la página se recargue
        let soundFiles = document.getElementById('soundFiles').files;
        for (let i = 0; i < soundFiles.length; i++) {
            let soundFile = soundFiles[i];
            let reader = new FileReader();
            reader.onload = function(e) {
                let soundData = e.target.result;
                let soundName = soundFile.name;
                localStorage.setItem(soundName, soundData);
                addSoundToList(soundName, document.getElementById('soundList'));
            };
            reader.readAsDataURL(soundFile);
        }
    });
    let soundList = document.getElementById('soundList');

    // Función para cargar los sonidos desde el localStorage y agregarlos al menú desplegable
    function loadSoundsFromLocalStorage() {
        const sounds = [];
        // Load existing sounds from localStorage and add them to the array if they are multimedia files
        for (let i = 0; i < localStorage.length; i++) {
            const itemName = localStorage.key(i);
            const itemData = localStorage.getItem(itemName);
            // Verificar si los datos almacenados corresponden a un archivo de audio (u otro tipo multimedia)
            if (isMultimedia(itemData)) {
                sounds.push(itemName);
            }
        }
    
        // Sort the sounds alphabetically
        sounds.sort();
    
        // Add each sound to the dropdown menu
        sounds.forEach(soundName => {
            addSoundToList(soundName);
        });
    }
    
    function isMultimedia(data) {
        // Verificar si los datos comienzan con el prefijo 'data:audio/' o 'data:video/' o 'data:image/'
        return data.startsWith('data:audio/') || data.startsWith('data:video/') || data.startsWith('data:image/');
    }
    
    
    loadSoundsFromLocalStorage();

    // Función para agregar un sonido a la lista
    function addSoundToList(giftName) {

        const listItem = document.createElement('div');
        listItem.dataset.giftName = giftName; // Almacenar el nombre del sonido como un atributo de datos
    
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.className = 'deleteButton';
        deleteButton.addEventListener('click', handleDelete);
    
        const renameButton = document.createElement('button');
        renameButton.textContent = 'ReAsignar';
        renameButton.className = 'renameButton';
        renameButton.addEventListener('click', handleRename);
    
        const playButton = document.createElement('button'); // Crear el botón de reproducción
        playButton.textContent = '';
        playButton.className = 'playButton';
        playButton.addEventListener('click', () => {
            // Agregar un controlador de eventos al botón
            playSound(giftName);
        });
    
        const soundNameSpan = document.createElement('span');
        soundNameSpan.textContent = giftName;
    
        // Agregar miniatura del sonido si existe
        const thumbnailSrc = localStorage.getItem(giftName + '_thumbnail');
        if (thumbnailSrc) {
            const thumbnailImg = document.createElement('img');
            thumbnailImg.src = thumbnailSrc;
            thumbnailImg.alt = 'Thumbnail';
            listItem.appendChild(thumbnailImg); // Agregar la miniatura del sonido
        }
    
        listItem.appendChild(playButton); // Agregar el botón de reproducción al elemento de la lista
        listItem.appendChild(renameButton);
        listItem.appendChild(deleteButton);
        listItem.appendChild(soundNameSpan); // Agregar el span con el nombre del sonido
        soundList.appendChild(listItem);
    }
    

    // Función para manejar la eliminación de un sonido
    function handleDelete(event) {
        let giftName = event.target.parentElement.dataset.giftName; // Obtener el nombre del sonido del atributo de datos
        if (confirm('¿Estás seguro de que quieres eliminar este sonido?')) {
            localStorage.removeItem(giftName);
            event.target.parentElement.remove();
        }
    }
    function handleRename(event) {
        const listItem = event.target.parentElement;
        const giftName = listItem.dataset.giftName; // Obtener el nombre del regalo del atributo de datos
    
        // Obtener el elemento que llama a la modal (el botón "ReAsignar")
        const triggerElement = event.target;
    
        // Llamar a la función para abrir la modal de renombrar
        openRenameModal(giftName, (newName) => {
            if (newName && newName !== giftName) {
                // Si se proporciona un nuevo nombre y es diferente al nombre actual
                const audioSrc = localStorage.getItem(giftName);
                localStorage.removeItem(giftName);
                localStorage.setItem(newName, audioSrc);
                listItem.dataset.giftName = newName; // Actualizar el nombre del regalo en el atributo de datos
                listItem.querySelector('span').textContent = newName; // Actualizar el texto visible del nombre del regalo
            }
        }, triggerElement); // Pasar el elemento que llama a la modal como tercer argumento
    }
    
    
});    
let isModalOpen = false; // Variable global para controlar si la modal está abierta
let currentModalBackdrop; // Variable global para almacenar la modal actualmente abierta

function openRenameModal(currentName, onSave, triggerElement) {
    if (isModalOpen) {
        closeModal();
    }
    
    const modalInput = document.createElement('input');
    modalInput.type = 'text';
    modalInput.value = currentName;

    const modalDialog = document.createElement('div');
    modalDialog.classList.add('modal-dialog');
    modalDialog.appendChild(modalInput);

    const modalButton = document.createElement('button');
    modalButton.textContent = 'Aceptar';
    modalButton.addEventListener('click', () => {
        const newName = modalInput.value.trim();
        onSave(newName);
        modalInput.value = newName;
        closeModal();
    });
    modalDialog.appendChild(modalButton);

    // Crear un select en lugar de una lista de botones de sugerencia
    const selectInput = document.createElement('select');
    selectInput.classList.add('select2'); // Agregar la clase de Select2 para inicializarlo
    modalDialog.appendChild(selectInput);

    $(selectInput).select2({
        data: globalSimplifiedStates.flatMap(state => state.availableGifts.map(gift => ({
            placeholder: "Select a giftname",
            allowClear: true,
            id: gift.name,
            text: gift.name,
            imageUrl: gift.imageUrl
        }))),
        templateResult: formatGiftOption, // Función para formatear cada opción en el dropdown
        escapeMarkup: function(markup) {
            return markup;
        }
    });
    
    // Manejar el evento de selección de una opción
        $(selectInput).on('select2:select', function(e) {
            
            const selectedGift = e.params.data;
            if (currentName.endsWith('mp3')) {
                modalInput.value = selectedGift.text + ' ' + currentName;
            } else {
                modalInput.value = selectedGift.text;
            }
        });


    // Obtener las coordenadas del elemento que llama a la modal
    const triggerRect = triggerElement.getBoundingClientRect();

    // Establecer las coordenadas de la modal para que se superponga al elemento
    const bottomPosition = window.innerHeight - triggerRect.bottom;

    // Calcular la posición de la modal
    let topPosition;
    if (bottomPosition > window.innerHeight / 2) {
        topPosition = triggerRect.top + window.scrollY + 500;
    } else {
        topPosition = triggerRect.top + window.scrollY;
    }
    
    // Establecer las coordenadas de la modal
    modalDialog.style.position = 'absolute';
    modalDialog.style.top = `${topPosition}px`;
    modalDialog.style.left = `${triggerRect.left + window.scrollX + 10}px`;

    const modalBackdrop = document.createElement('div');
    modalBackdrop.classList.add('modal-backdrop');
    modalBackdrop.appendChild(modalDialog);
    document.body.appendChild(modalBackdrop);

    currentModalBackdrop = modalBackdrop;
    isModalOpen = true;
    modalInput.focus();
}

// Función para formatear cada opción en el dropdown de Select2
function formatGiftOption(gift) {
    if (!gift.id) {
        return gift.text;
    }

    return $('<span><img src="' + gift.imageUrl + '" class="thumbnail-img" /> ' + gift.text + '</span>');
}
function closeModal() {
    if (currentModalBackdrop) {
        document.body.removeChild(currentModalBackdrop); // Eliminar el elemento de la modal del DOM
        currentModalBackdrop = null; // Restablecer la variable global de la modal actual
        isModalOpen = false; // Establecer el estado de la modal como cerrada
    }
}

function playSound(giftName) {
    // Convertir el nombre del regalo a minúsculas
    let lowerCaseGiftName = giftName.toLowerCase();
    let audioSrc = localStorage.getItem(giftName);
    let audio = new Audio(audioSrc);
    // Buscar en el almacenamiento local un sonido que contenga el nombre del regalo en su nombre
    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);

        // Convertir la clave a minúsculas antes de hacer la comparación
        if (key.toLowerCase().includes(lowerCaseGiftName)) {
            let audioSrc = localStorage.getItem(key);

            // Agregar el audio a la cola de audioqueue
            audioqueue.enqueue(audioSrc);

            // Si el audio no está reproduciéndose, iniciar el reproductor
            if (!isPlaying) {
                kickstartPlayer();
            }
        }
    }
}

let lastAudioSrc = null; // Variable para almacenar el último audio añadido a la cola

function playSoundByText(text) {
    // Convertir el texto a minúsculas
    let lowerCaseText = text.toLowerCase();

    // Verificar si el texto tiene una longitud mínima y máxima
    let minLength = 1; // Define tu longitud mínima aquí
    let maxLength = 20; // Define tu longitud máxima aquí
    if (lowerCaseText.length < minLength || lowerCaseText.length > maxLength) {
        return;
    }
    // Buscar en el almacenamiento local un sonido que contenga el texto en su nombre
    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);

        // Convertir la clave a minúsculas antes de hacer la comparación
        if (key.toLowerCase().includes(lowerCaseText)) {
            let audioSrc = localStorage.getItem(key);

            // Si el audio es el mismo que el último añadido a la cola, no lo añade
            if (audioSrc === lastAudioSrc) {
                console.log('El audio es el mismo que el último añadido a la cola');
                return;
            }

            console.log('audio al texto:', text);

            // Agregar el audio a la cola de audioqueue
            audioqueue.enqueue(audioSrc);
            lastAudioSrc = audioSrc; // Actualizar el último audio añadido a la cola

            // Si el audio no está reproduciéndose, iniciar el reproductor
            if (!isPlaying) {
                kickstartPlayer();
            }

            // Salir de la función después de encontrar el primer audio que coincide
            return;
        }
    }
}

function exportSettings() {
    // Convertir las configuraciones y sonidos a una cadena JSON
    let settings = JSON.stringify(localStorage);

    // Crear un elemento 'a' invisible
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(settings));
    element.setAttribute('download', 'settings.json');

    // Simular un click en el elemento 'a' para descargar el archivo
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function importSettings() {
    // Show the loading indicator
    document.getElementById('loadingIndicator').style.display = 'inline';

    // Read the file uploaded by the user
    let file = document.getElementById('importButton').files[0];
    if (file) {
        let reader = new FileReader();
        reader.onload = function(e) {
            // Parse the file content to a JavaScript object
            let settings = JSON.parse(e.target.result);

            // Store the settings and sounds in localStorage
            for (let key in settings) {
                localStorage.setItem(key, settings[key]);
            }

            // Hide the loading indicator
            document.getElementById('loadingIndicator').style.display = 'none';
        };
        reader.readAsText(file);
    } else {
        // Hide the loading indicator
        document.getElementById('loadingIndicator').style.display = 'none';
    }
}
function testHandleEvent() {
    var eventType = document.getElementById('eventType').value;

    if (eventType === 'gift') {
        var dataInput = document.getElementById('data').value;
        let data = { giftName: dataInput };
        handleEvent(eventType, data);
    } else {
        var data = document.getElementById('data').value;
        handleEvent2(eventType, data);
    }
}
const sentData = new Set(); // Conjunto para almacenar los datos enviados

let keywords = {}; // Inicializar como un objeto vacío en lugar de null
let commandList = {};
let lastCommand = null;
let currentPlayerIndex = 0;
const keywordsInput = localStorage.getItem('keywords');
keywords = jsyaml.load(keywordsInput);
let playerName = localStorage.getItem('playerName');


let commandCounter = 0; // Variable de control de contador
const maxRepeatCount = 50; // Valor máximo para repeatCount

function handleEvent(eventType, data, msg, likes) {
    let MinecraftLivetoggle = document.getElementById("MinecraftLive")

    //console.log(MinecraftLivetoggle.checked);
    if (!MinecraftLivetoggle.checked) {
        return;
    }

    // Obtener los datos de los eventos del localStorage
    const commandListInput = localStorage.getItem('events');
    const commandList = JSON.parse(commandListInput);
    const giftName = data.giftName.toLowerCase(); // Normaliza el nombre del regalo

    let foundGift = commandList.gift.default.find(gift => gift.name.toLowerCase() === giftName);
    console.log(data.gifName,giftName);
    if (!foundGift) {
        // Si no se encontró un regalo específico, usar el regalo predeterminado
        foundGift = commandList.gift.default.find(gift => gift.name.toLowerCase() === 'default');
    }

    if (foundGift) {
        const eventCommands = foundGift.commands.split('\n');

        eventCommands.forEach(command => {
            const replacedCommand = replaceVariables(command, data, likes);
            sendReplacedCommand(replacedCommand);
            console.log(replacedCommand);
        });
    } else {
        console.log("No se encontró un regalo correspondiente para:", data.giftName);
    }
}


// Función para reemplazar variables en los comandos

const escapeMinecraftCommand = (command) => {
    // Escape only double quotes, not backslashes (unchanged)
    return command.replace(/"/g, '\\"');
  };
  
  // Función para reemplazar variables en los comandos
  const replaceVariables = (command, data, likes) => {
    console.log(command);
    // Reemplazar variables en el comando (unchanged)
    let replacedCommand = command
      .replace(/uniqueId/g, data.uniqueId || '')
      .replace(/nickname/g, data.nickname || '')
      .replace(/comment/g, data.comment || '')
      .replace(/{milestoneLikes}/g, likes || '')
      .replace(/{likes}/g, likes || '')
      .replace(/message/g, data.comment || '')
      .replace(/giftName/g, data.giftName || '')
      .replace(/repeatCount/g, data.repeatCount || '')
      .replace(/playername/g, playerName || '');
  
    // Convertir el comando a minúsculas
    replacedCommand = replacedCommand.toLowerCase();
  
    // Remove all backslashes (proceed with caution!)
    replacedCommand = replacedCommand.replace(/\\/g, '');
  
    //console.log(replacedCommand);
    return replacedCommand;
  };
  

function handleEvent2(eventType, data, msg, likes) {
    let MinecraftLivetoggle = document.getElementById("MinecraftLive")

    //console.log(MinecraftLivetoggle.checked);
    if (!MinecraftLivetoggle.checked) {
        return;
    }
    // Obtener la lista de comandos del localStorage
    const commandjsonlist = localStorage.getItem('commandjsonlist');
    const commandjson = JSON.parse(commandjsonlist);

    if (eventType === 'gift') {
        return;
    }
    // Verificar si se encontró la lista de comandos
    if (commandjson) {
        // Verificar si el eventType tiene un comando predeterminado
        if (commandjson[eventType] && commandjson[eventType].default) {
            const defaultCommand = commandjson[eventType].default;

            // Ejecutar el comando predeterminado
            defaultCommand.forEach(command => {
                const replacedCommand = replaceVariables(command, data, likes);
                sendReplacedCommand(replacedCommand);
                console.log(replacedCommand);
            });
        } else {
            console.error(`No se encontraron comandos predeterminados para el evento "${eventType}"`);
        }
    } else {
        console.error(`No se encontraron datos válidos en el localStorage`);
    }
}


function getChatCommands() {
    let eventCommands = [];
    let userCommands = localStorage.getItem('userCommands');

    // Obtener comandos personalizados del usuario
    if (userCommands) {
        eventCommands = JSON.parse(userCommands);
    }

    return eventCommands;
}


function sendReplacedCommand(replacedCommand) {
    fetch('/api/receive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ replacedCommand })
    })
    .then(response => response.json())
    .then(data => {
      //console.log(data); // Maneja la respuesta del servidor si es necesario
    })
    .catch(error => {
      console.error('Error:', error);
    });
}

async function sendToServer(eventType, data, color, msg, message) {
    fetch('/api/receive1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ eventType, data, color, msg, message }),
      })
      .then(response => response.json())
      .then(data => {
        //console.log(data); // Maneja la respuesta del servidor si es necesario
      })
      .catch(error => {
        console.error('Error:', error);
      });
}

window.onload = async function() {
    try {
        audio = document.getElementById("audio");
        skip = document.getElementById("skip-button");
        isPlaying = false;
        audioqueue = new Queue();

        if (skip) {
            skip.onclick = skipAudio;
        } else {
            console.error("Error: skip-button is undefined");
        }

        if (audio) {
            audio.addEventListener("ended", kickstartPlayer);
        } else {
            console.error("Error: audio is undefined");
        }

    } catch (error) {
        console.error("Error:", error);
    }
};