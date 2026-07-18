const roomForm = document.getElementById('room-form');
const roomIdInput = document.getElementById('room-id');
const roomList = document.getElementById('room-list');
const guestForm = document.getElementById('guest-form');
const guestIdInput = document.getElementById('guest-id');
const guestList = document.getElementById('guest-list');
const guestRoomSelect = document.getElementById('guest-room');

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function loadRooms() {
  const rooms = await fetchJson('/api/rooms');
  const options = rooms.map((room) => `<option value="${room.id}">${room.name} (${room.type})</option>`).join('');
  guestRoomSelect.innerHTML = `<option value="">No room assigned</option>${options}`;
  roomList.innerHTML = rooms.map((room) => `
    <tr>
      <td>${room.name}</td>
      <td>${room.type}</td>
      <td>${Number(room.price).toLocaleString('id-ID')}</td>
      <td><span class="badge">${room.status}</span></td>
      <td class="actions">
        <button type="button" data-edit-room="${room.id}">Edit</button>
        <button type="button" class="danger" data-delete-room="${room.id}">Delete</button>
      </td>
    </tr>`).join('');
}

async function loadGuests() {
  const guests = await fetchJson('/api/guests');
  guestList.innerHTML = guests.map((guest) => `
    <tr>
      <td>${guest.fullName}</td>
      <td>${guest.phone || '—'}</td>
      <td>${guest.roomName || '—'}</td>
      <td>${guest.cardNumber || '—'}</td>
      <td>${guest.ktpPath ? `<img class="ktp-preview" src="${guest.ktpPath}" alt="KTP ${guest.fullName}" />` : '—'}</td>
      <td><span class="badge">${guest.status}</span></td>
      <td class="actions">
        <button type="button" data-edit-guest="${guest.id}">Edit</button>
        <button type="button" class="danger" data-delete-guest="${guest.id}">Delete</button>
        <label>
          <input type="file" data-upload-ktp="${guest.id}" style="display:none" />
          <span class="badge">Upload KTP</span>
        </label>
      </td>
    </tr>`).join('');
}

roomForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById('room-name').value,
    type: document.getElementById('room-type').value,
    price: document.getElementById('room-price').value,
    status: document.getElementById('room-status').value
  };

  if (roomIdInput.value) {
    await fetchJson(`/api/rooms/${roomIdInput.value}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } else {
    await fetchJson('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }
  roomForm.reset();
  roomIdInput.value = '';
  await loadRooms();
});

guestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    fullName: document.getElementById('guest-name').value,
    phone: document.getElementById('guest-phone').value,
    roomId: document.getElementById('guest-room').value || null,
    cardNumber: document.getElementById('guest-card').value,
    notes: document.getElementById('guest-notes').value,
    status: document.getElementById('guest-status').value
  };

  if (guestIdInput.value) {
    await fetchJson(`/api/guests/${guestIdInput.value}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } else {
    await fetchJson('/api/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }
  guestForm.reset();
  guestIdInput.value = '';
  await loadGuests();
});

document.addEventListener('click', async (event) => {
  const roomEditButton = event.target.closest('[data-edit-room]');
  if (roomEditButton) {
    const room = (await fetchJson('/api/rooms')).find((item) => item.id === Number(roomEditButton.dataset.editRoom));
    document.getElementById('room-id').value = room.id;
    document.getElementById('room-name').value = room.name;
    document.getElementById('room-type').value = room.type;
    document.getElementById('room-price').value = room.price;
    document.getElementById('room-status').value = room.status;
    return;
  }

  const roomDeleteButton = event.target.closest('[data-delete-room]');
  if (roomDeleteButton) {
    await fetchJson(`/api/rooms/${roomDeleteButton.dataset.deleteRoom}`, { method: 'DELETE' });
    await loadRooms();
    return;
  }

  const guestEditButton = event.target.closest('[data-edit-guest]');
  if (guestEditButton) {
    const guest = (await fetchJson('/api/guests')).find((item) => item.id === Number(guestEditButton.dataset.editGuest));
    document.getElementById('guest-id').value = guest.id;
    document.getElementById('guest-name').value = guest.fullName;
    document.getElementById('guest-phone').value = guest.phone || '';
    document.getElementById('guest-room').value = guest.roomId || '';
    document.getElementById('guest-card').value = guest.cardNumber || '';
    document.getElementById('guest-notes').value = guest.notes || '';
    document.getElementById('guest-status').value = guest.status || 'active';
    return;
  }

  const guestDeleteButton = event.target.closest('[data-delete-guest]');
  if (guestDeleteButton) {
    await fetchJson(`/api/guests/${guestDeleteButton.dataset.deleteGuest}`, { method: 'DELETE' });
    await loadGuests();
    return;
  }
});

document.addEventListener('change', async (event) => {
  const uploadInput = event.target.closest('[data-upload-ktp]');
  if (!uploadInput) return;
  const formData = new FormData();
  formData.append('ktp', event.target.files[0]);
  await fetchJson(`/api/guests/${uploadInput.dataset.uploadKtp}/ktp`, { method: 'POST', body: formData });
  await loadGuests();
});

document.getElementById('room-cancel').addEventListener('click', () => {
  roomForm.reset();
  roomIdInput.value = '';
});

document.getElementById('guest-cancel').addEventListener('click', () => {
  guestForm.reset();
  guestIdInput.value = '';
});

(async () => {
  await loadRooms();
  await loadGuests();
})();
