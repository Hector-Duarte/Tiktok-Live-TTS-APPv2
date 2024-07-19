import { objectModal, eventmanager } from '../renderer.js';
import { getfileId } from '../utils/Fileshtml.js';
import { databases, saveDataToIndexedDB, deleteDataFromIndexedDB, updateDataInIndexedDB, loadDataFromIndexedDB, getDataFromIndexedDB, observer } from '../functions/indexedDB.js';

async function createElementWithButtons(dbConfig, data) {
    if (!data || !data.id) {
        console.error('Data is missing or invalid:', data);
        return;
    }

    const table1 = getOrCreateTableContainer('table1', ['NameAccions', 'Imagen', 'Video', 'Sonido', 'Botones']);
    const table2 = getOrCreateTableContainer('table2', ['NameEvents', 'Evento', 'Eventovalor', 'Reasignar', 'Play']);

    const row1 = getOrCreateRow(table1, data);
    const row2 = getOrCreateRow(table2, data);

    const nombreCell = createTextCell(data.accionevento.nombre || 'N/A');
    const eventovalorCell = createTextCell(await geteventovalor(data.event_type,data) || 'default');
    const imagenCell = createTextCell(await getDataText(data["type-imagen"]));
    const videoCell = createTextCell(await getDataText(data["type-video"]));
    const sonidoCell = createTextCell(await getDataText(data["type-audio"]));

    row1.appendChild(nombreCell);
    row1.appendChild(imagenCell);
    row1.appendChild(videoCell);
    row1.appendChild(sonidoCell);

    const buttonCell1 = createButtonCell(data, row1);
    row1.appendChild(buttonCell1);

    const eventNamesCell = createEventNamesCell(data);
    const reassignButtonCell = createReassignButtonCell(data);
    const playButtonCell = createPlayButtonCell(data);

    row2.appendChild(nombreCell.cloneNode(true));
    row2.appendChild(eventNamesCell);
    row2.appendChild(eventovalorCell);

    row2.appendChild(reassignButtonCell);
    row2.appendChild(playButtonCell);
    table1.appendChild(row1);
    table2.appendChild(row2);
}
async function geteventovalor(eventype,data){
    let valor = data[`event-${eventype}`];
    if (valor && valor.select){
        return valor.select;
    } else if (valor && valor.number){
        return valor.number;
    } else {
        return 'default';
    }

}
async function getDataText(data) {
    if (!data || !data.check) {
        return 'N/A';
    }
    let datatextname = await getfileId(data.select);
    if (datatextname) {
        return datatextname.name;
    }
    return data.select ? data.select : 'N/A';
}
function createEventNamesCell(data) {
    const eventNamesCell = document.createElement('td');
    if (data.event_type) {
        const eventTextNode = document.createTextNode(data.event_type + ' ');
        eventNamesCell.appendChild(eventTextNode);
    }
    return eventNamesCell;
}
function getOrCreateTableContainer(id, headers) {
    let table = document.querySelector(`.data-table-${id}`);
    if (!table) {
        table = document.createElement('table');
        table.className = `data-table-${id} table border-4 border-gray-500 rounded-lg`;
        document.getElementById('loadrowactionsevents').appendChild(table);

        const headerRow = document.createElement('tr');
        headers.forEach(headerText => {
            const headerCell = document.createElement('td');
            headerCell.textContent = headerText;
            headerRow.appendChild(headerCell);
        });
        table.appendChild(headerRow);
    }
    return table;
}

function getOrCreateRow(table, data) {
    let row = table.querySelector(`.data-row[data-id="${data.id}"]`);
    if (!row) {
        row = document.createElement('tr');
        row.className = 'data-row';
        row.dataset.id = data.id;
    } else {
        row.innerHTML = '';
    }
    return row;
}

function createTextCell(text) {
    const textCell = document.createElement('td');
    textCell.textContent = text;
    return textCell;
}

function createButtonCell(data, row) {
    const buttonCell = document.createElement('td');
    buttonCell.className = 'button-cell';

    const editButton = document.createElement('button');
    editButton.textContent = 'Editar';
    editButton.className = "custombutton";
    editButton.addEventListener('click', async () => {
        objectModal.onUpdate(data);
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Borrar';
    deleteButton.className = "deleteButton";
    deleteButton.addEventListener('click', () => {
        row.remove();
        deleteDataFromIndexedDB(databases.MyDatabaseActionevent, data.id);
        setTimeout(() => {
            loadDataFromIndexedDB(databases.eventsDB, createElementWithButtons);
            loadDataFromIndexedDB(databases.MyDatabaseActionevent, createElementWithButtons);
        }, 1000);
        console.log('deleteDataFromIndexedDB', data);
    });

    buttonCell.appendChild(editButton);
    buttonCell.appendChild(deleteButton);

    return buttonCell;
}
function createReassignButtonCell(data) {
    const reassignButtonCell = document.createElement('td');
    const reassignButton = document.createElement('button');
    reassignButton.textContent = 'Reasignar';
    reassignButton.className = "custombutton";
    reassignButton.addEventListener('click', async () => {
        objectModal.onEvent(data);
    });
    reassignButtonCell.appendChild(reassignButton);
    return reassignButtonCell;
}
function createPlayButtonCell(data) {
    let playername = "test";
    let datagiftid = Number(data['event-gift'].select);
    let test = {
        giftName: datagiftid,
        repeatCount: 1,
        giftId: datagiftid, /// rose id 5655
        repeatEnd: false,
        diamondCount: 0,
        nickname: playername,
        uniqueId: playername,
        likeCount: 5
    }
    const playButtonCell = document.createElement('td');
    const playButton = document.createElement('button');
    playButton.textContent = 'Play';
    playButton.className = "custombutton";
    playButton.addEventListener('click', async () => {
        console.log('playButton', data.event_type, data,test);
        eventmanager(data.event_type, test);
    });
    playButtonCell.appendChild(playButton);
    return playButtonCell;
}
export { createElementWithButtons };
