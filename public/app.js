const roomForm = document.getElementById('room-form');
const roomIdInput = document.getElementById('room-id');
const roomList = document.getElementById('room-list');
const guestForm = document.getElementById('guest-form');
const guestIdInput = document.getElementById('guest-id');
const guestList = document.getElementById('guest-list');
const guestRoomSelect = document.getElementById('guest-room');
const loginForm = document.getElementById('login-form');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginMessage = document.getElementById('login-message');
const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const logoutButton = document.getElementById('logout-btn');
const moduleSearchInput = document.getElementById('module-search-input');
const moduleButtons = document.querySelectorAll('[data-module]');
const overviewModule = document.getElementById('overview-module');
const roomsModule = document.getElementById('rooms-module');
const guestsModule = document.getElementById('guests-module');
const guestStatsModule = document.getElementById('guest-stats-module');
const cardManagementModule = document.getElementById('card-management-module');
const statsModule = document.getElementById('stats-module');
const accessModule = document.getElementById('access-module');
const availableRoomsEl = document.getElementById('summary-available');
const activeGuestsEl = document.getElementById('summary-active');
const totalRoomsEl = document.getElementById('summary-total');
const occupiedRoomsEl = document.getElementById('summary-occupied');
const monthlyIncomeEl = document.getElementById('monthly-income');
const potentialIncomeEl = document.getElementById('potential-income');
const incomeBreakdownEl = document.getElementById('income-breakdown');
const userNameEl = document.getElementById('user-name');
const userRoleEl = document.getElementById('user-role');

const roleForm = document.getElementById('role-form');
const roleIdInput = document.getElementById('role-id');
const roleNameInput = document.getElementById('role-name');
const roleList = document.getElementById('role-list');
const roleModuleInputs = Array.from(document.querySelectorAll('[data-role-module]'));
const userForm = document.getElementById('user-form');
const userIdInput = document.getElementById('user-id');
const userNameInput = document.getElementById('user-name-input');
const userPasswordInput = document.getElementById('user-password');
const userSelect = document.getElementById('user-role-select');
const guestCheckinInput = document.getElementById('guest-checkin');
const guestCheckoutInput = document.getElementById('guest-checkout');
const guestSearchInput = document.getElementById('guest-search-input');
const guestFormModal = document.getElementById('guest-modal');
const openGuestModalButton = document.getElementById('open-guest-modal');
const closeGuestModalButton = document.getElementById('close-guest-modal');
const cardForm = document.getElementById('card-form');
const cardGuestSelect = document.getElementById('card-guest-select');
const cardRoomSelect = document.getElementById('card-room-select');
const cardNumberInput = document.getElementById('card-number');
const cardList = document.getElementById('card-list');
const cardCancelButton = document.getElementById('card-cancel');
const guestTotalEl = document.getElementById('guest-total');
const guestActiveEl = document.getElementById('guest-active');
const guestCurrentEl = document.getElementById('guest-current');
const guestCheckedOutEl = document.getElementById('guest-checked-out');
const guestAverageStayEl = document.getElementById('guest-average-stay');
const guestLongestStayEl = document.getElementById('guest-longest-stay');
const guestShortestStayEl = document.getElementById('guest-shortest-stay');
const guestStatsList = document.getElementById('guest-stats-list');
const userStatusSelect = document.getElementById('user-status');
const userList = document.getElementById('user-list');

const state = {
  token: localStorage.getItem('kost_admin_token') || '',
  user: null
};
let guestCache = [];

async function fetchJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token) {
    headers.set('x-admin-token', state.token);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  appShell.classList.add('hidden');
}

function showDashboard() {
  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
}

function setToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem('kost_admin_token', token);
  } else {
    localStorage.removeItem('kost_admin_token');
  }
}

function setLoginMessage(message, isError = false) {
  loginMessage.textContent = message;
  loginMessage.classList.toggle('error', isError);
}

function setFormMessage(message) {
  document.querySelectorAll('.form-hint').forEach((element) => {
    element.textContent = message;
  });
}

function createCrudModule({
  entityName,
  apiPath,
  listBody,
  form,
  modal,
  searchInput,
  newButton,
  rowRenderer,
  fillForm,
  getPayload,
  afterSave
}) {
  let items = [];

  function renderList(data) {
    listBody.innerHTML = data.map(rowRenderer).join('');
  }

  function filterList() {
    if (!searchInput) return;
    const query = searchInput?.value.trim().toLowerCase() || '';
    listBody.querySelectorAll('tr').forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.classList.toggle('hidden', query && !text.includes(query));
    });
  }

  function openModal(record = null) {
    form.reset();
    if (record && record.id) {
      fillForm(record);
    } else {
      form.querySelector('[type="hidden"]').value = '';
    }
    modal?.classList.remove('hidden');
    modal?.querySelector('input, select, textarea')?.focus();
  }

  function closeModal() {
    form.reset();
    modal?.classList.add('hidden');
  }

  async function saveItem(event) {
    event.preventDefault();
    const payload = getPayload();
    const id = form.querySelector('[type="hidden"]').value;
    if (id) {
      await fetchJson(`${apiPath}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    await load();
    closeModal();
    setFormMessage(`${entityName[0].toUpperCase() + entityName.slice(1)} saved successfully.`);
    if (afterSave) await afterSave();
  }

  async function load() {
    items = await fetchJson(apiPath);
    renderList(items);
    filterList();
    return items;
  }

  function handleAction(event) {
    const editButton = event.target.closest(`[data-edit-${entityName}]`);
    if (editButton) {
      const record = items.find((item) => item.id === Number(editButton.dataset[`edit${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`]));
      if (record) openModal(record);
      return;
    }

    const deleteButton = event.target.closest(`[data-delete-${entityName}]`);
    if (deleteButton) {
      fetchJson(`${apiPath}/${deleteButton.dataset[`delete${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`]}`, { method: 'DELETE' })
        .then(() => load())
        .catch(console.error);
      return;
    }
  }

  if (searchInput) searchInput.addEventListener('input', filterList);
  if (newButton) newButton.addEventListener('click', () => openModal());
  const statusInput = form.querySelector('select#guest-status, select[name="status"]');
  const checkoutDateInput = form.querySelector('input[type="date"]#guest-checkout, input[type="date"][name="checkoutAt"]');

  if (statusInput && checkoutDateInput) {
    statusInput.addEventListener('change', () => {
      if (statusInput.value === 'inactive' && !checkoutDateInput.value) {
        checkoutDateInput.value = new Date().toISOString().split('T')[0];
      }
    });
  }

  listBody.addEventListener('click', handleAction);
  form.addEventListener('submit', saveItem);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  return { load, openModal, closeModal, filterList };
}

function switchModule(moduleName) {
  const modules = {
    overview: overviewModule,
    rooms: roomsModule,
    guests: guestsModule,
    guestStats: guestStatsModule,
    cardManagement: cardManagementModule,
    stats: statsModule,
    access: accessModule
  };

  Object.entries(modules).forEach(([key, element]) => {
    if (element) {
      element.classList.toggle('hidden', key !== moduleName);
    }
  });

  moduleButtons.forEach((button) => {
    const allowed = state.user?.modules?.includes(button.dataset.module) || button.dataset.module === 'overview';
    button.classList.toggle('active', button.dataset.module === moduleName);
    button.dataset.allowed = allowed ? 'true' : 'false';
  });
  if (moduleName === 'guestStats') {
    loadGuestStats();
  }
  if (moduleName === 'cardManagement') {
    loadCardManagementData();
  }
  refreshModuleButtons();
}

function refreshModuleButtons() {
  const query = moduleSearchInput?.value.trim().toLowerCase() || '';
  moduleButtons.forEach((button) => {
    const label = button.querySelector('.module-label')?.textContent.toLowerCase() || '';
    const allowed = button.dataset.allowed !== 'false';
    const matches = !query || label.includes(query);
    button.classList.toggle('hidden', !allowed || !matches);
  });
}

function setUserBadge(user) {
  if (userNameEl) userNameEl.textContent = user?.username || 'Admin';
  if (userRoleEl) userRoleEl.textContent = user?.roleName ? `Role • ${user.roleName}` : 'Role • Admin';
}

async function loadRoles() {
  const roles = await fetchJson('/api/roles');
  roleList.innerHTML = roles.map((role) => `
    <tr>
      <td>${role.name}</td>
      <td>${role.modules.join(', ')}</td>
      <td class="actions">
        <button type="button" data-edit-role="${role.id}">Edit</button>
        <button type="button" class="danger" data-delete-role="${role.id}">Delete</button>
      </td>
    </tr>`).join('');
  return roles;
}

async function loadUsers() {
  const users = await fetchJson('/api/users');
  userList.innerHTML = users.map((user) => `
    <tr>
      <td>${user.username}</td>
      <td>${user.roleName || '—'}</td>
      <td>${user.status}</td>
      <td class="actions">
        <button type="button" data-edit-user="${user.id}">Edit</button>
        <button type="button" class="danger" data-delete-user="${user.id}">Delete</button>
      </td>
    </tr>`).join('');
  return users;
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
  return rooms;
}

const guestCrud = createCrudModule({
  entityName: 'guest',
  apiPath: '/api/guests',
  listBody: guestList,
  form: guestForm,
  modal: guestFormModal,
  searchInput: guestSearchInput,
  newButton: openGuestModalButton,
  rowRenderer: (guest) => `
    <tr>
      <td>${guest.fullName}</td>
      <td>${guest.phone || '—'}</td>
      <td>${guest.roomName || '—'}</td>
      <td>${guest.checkinAt ? new Date(guest.checkinAt).toLocaleDateString('id-ID') : '—'}</td>
      <td>${guest.checkoutAt ? new Date(guest.checkoutAt).toLocaleDateString('id-ID') : '—'}</td>
      <td>${guest.cardNumber || '—'}</td>
      <td>${guest.ktpPath ? `<img class="ktp-preview" src="${guest.ktpPath}" alt="KTP ${guest.fullName}" />` : '—'}</td>
      <td><span class="badge">${guest.status}</span></td>
      <td class="actions">
        <button type="button" data-edit-guest="${guest.id}">Edit</button>
        <button type="button" class="danger" data-delete-guest="${guest.id}">Delete</button>
        <label class="upload-chip">
          <input type="file" data-upload-ktp="${guest.id}" />
          <span>Upload KTP</span>
        </label>
      </td>
    </tr>`,
  fillForm: (guest) => {
    document.getElementById('guest-id').value = guest.id;
    document.getElementById('guest-name').value = guest.fullName;
    document.getElementById('guest-phone').value = guest.phone || '';
    document.getElementById('guest-room').value = guest.roomId || '';
    document.getElementById('guest-card').value = guest.cardNumber || '';
    document.getElementById('guest-notes').value = guest.notes || '';
    document.getElementById('guest-checkin').value = guest.checkinAt ? guest.checkinAt.split('T')[0] : '';
    document.getElementById('guest-checkout').value = guest.checkoutAt ? guest.checkoutAt.split('T')[0] : '';
    document.getElementById('guest-status').value = guest.status || 'active';
  },
  getPayload: () => {
    const status = document.getElementById('guest-status').value;
    let checkoutValue = document.getElementById('guest-checkout').value || null;
    if (status === 'inactive' && !checkoutValue) {
      checkoutValue = new Date().toISOString().split('T')[0];
      document.getElementById('guest-checkout').value = checkoutValue;
    }

    return {
      fullName: document.getElementById('guest-name').value,
      phone: document.getElementById('guest-phone').value,
      roomId: document.getElementById('guest-room').value || null,
      cardNumber: document.getElementById('guest-card').value,
      notes: document.getElementById('guest-notes').value,
      checkinAt: document.getElementById('guest-checkin').value || null,
      checkoutAt: checkoutValue,
      status
    };
  }
});

async function loadGuests() {
  return guestCrud.load();
}

function updateSummary(stats) {
  totalRoomsEl.textContent = stats.totalRooms ?? 0;
  availableRoomsEl.textContent = stats.availableRooms ?? 0;
  occupiedRoomsEl.textContent = stats.occupiedRooms ?? 0;
  activeGuestsEl.textContent = stats.activeGuests ?? 0;
  monthlyIncomeEl.textContent = formatCurrency(stats.monthlyIncome ?? 0);
  potentialIncomeEl.textContent = formatCurrency(stats.potentialMonthlyIncome ?? 0);

  if (incomeBreakdownEl) {
    const occupiedRooms = stats.occupiedRoomsList || [];
    incomeBreakdownEl.innerHTML = occupiedRooms.length
      ? occupiedRooms.map((room) => `<li><span>${room.name}</span><strong>${formatCurrency(Number(room.price || 0))}</strong></li>`).join('')
      : '<li class="empty-state">No occupied rooms yet.</li>';
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

async function refreshDashboard() {
  const [rooms, guests, stats] = await Promise.all([loadRooms(), loadGuests(), fetchJson('/api/stats')]);
  updateSummary(stats);
  return { rooms, guests, stats };
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return date.toLocaleDateString('id-ID');
}

async function loadGuestStats() {
  try {
    const stats = await fetchJson('/api/guest-stats');
    if (guestTotalEl) guestTotalEl.textContent = stats.totalGuests ?? 0;
    if (guestActiveEl) guestActiveEl.textContent = stats.activeGuests ?? 0;
    if (guestCurrentEl) guestCurrentEl.textContent = stats.currentGuests ?? 0;
    if (guestCheckedOutEl) guestCheckedOutEl.textContent = stats.checkedOutGuests ?? 0;
    if (guestAverageStayEl) guestAverageStayEl.textContent = stats.averageStayDays ?? 0;
    if (guestLongestStayEl) guestLongestStayEl.textContent = stats.longestStayDays ?? 0;
    if (guestShortestStayEl) guestShortestStayEl.textContent = stats.shortestStayDays ?? 0;
    if (guestStatsList) {
      guestStatsList.innerHTML = stats.guestStatsList.map((guest) => `
        <tr>
          <td>${guest.fullName}</td>
          <td>${guest.roomName || '—'}</td>
          <td>${formatDate(guest.checkinAt)}</td>
          <td>${formatDate(guest.checkoutAt)}</td>
          <td>${guest.stayDays !== null ? guest.stayDays : '—'}</td>
          <td><span class="badge">${guest.status}</span></td>
        </tr>`).join('');
    }
  } catch (error) {
    console.error('Failed to load guest stats', error);
  }
}

async function loadCardManagementData() {
  const [rooms, guests] = await Promise.all([fetchJson('/api/rooms'), fetchJson('/api/guests')]);
  cardRoomSelect.innerHTML = `<option value="">Select room</option>${rooms.map((room) => `<option value="${room.id}">${room.name} (${room.type})</option>`).join('')}`;
  cardGuestSelect.innerHTML = `<option value="">Select guest</option>${guests.map((guest) => `<option value="${guest.id}">${guest.fullName}</option>`).join('')}`;
  cardList.innerHTML = guests.map((guest) => `
    <tr>
      <td>${guest.fullName}</td>
      <td>${guest.roomName || '—'}</td>
      <td>${guest.cardNumber || '—'}</td>
      <td><span class="badge">${guest.status}</span></td>
      <td class="actions">
        <button type="button" data-edit-card="${guest.id}">Edit</button>
        <button type="button" class="danger" data-clear-card="${guest.id}">Clear</button>
      </td>
    </tr>`).join('');
}

function populateCardForm(guest) {
  cardGuestSelect.value = guest.id;
  cardRoomSelect.value = guest.roomId || '';
  cardNumberInput.value = guest.cardNumber || '';
}

async function saveCardAssignment(guestId, roomId, cardNumber) {
  await fetchJson(`/api/guests/${guestId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: roomId || null, cardNumber })
  });
  await Promise.all([refreshDashboard(), loadCardManagementData()]);
}

async function clearCardAssignment(guestId) {
  await fetchJson(`/api/guests/${guestId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardNumber: '' })
  });
  await Promise.all([refreshDashboard(), loadCardManagementData()]);
}

async function loadAccessData() {
  await Promise.all([loadRoles(), loadUsers()]);
  const roleOptions = await fetchJson('/api/roles');
  userSelect.innerHTML = roleOptions.map((role) => `<option value="${role.id}">${role.name}</option>`).join('');
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
  setFormMessage('Room saved successfully.');
  await refreshDashboard();
});

roleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: roleNameInput.value,
    modules: roleModuleInputs.filter((input) => input.checked).map((input) => input.value)
  };

  if (roleIdInput.value) {
    await fetchJson(`/api/roles/${roleIdInput.value}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } else {
    await fetchJson('/api/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }
  roleForm.reset();
  roleIdInput.value = '';
  setFormMessage('Role saved successfully.');
  await loadAccessData();
});

userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    username: userNameInput.value,
    password: userPasswordInput.value,
    roleId: userSelect.value || null,
    status: userStatusSelect.value
  };

  if (userIdInput.value) {
    await fetchJson(`/api/users/${userIdInput.value}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } else {
    await fetchJson('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }
  userForm.reset();
  userIdInput.value = '';
  setFormMessage('User saved successfully.');
  await loadAccessData();
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
    setFormMessage('Editing room details.');
    return;
  }

  const roomDeleteButton = event.target.closest('[data-delete-room]');
  if (roomDeleteButton) {
    await fetchJson(`/api/rooms/${roomDeleteButton.dataset.deleteRoom}`, { method: 'DELETE' });
    await refreshDashboard();
    return;
  }

  const roleEditButton = event.target.closest('[data-edit-role]');
  if (roleEditButton) {
    const roles = await fetchJson('/api/roles');
    const role = roles.find((item) => item.id === Number(roleEditButton.dataset.editRole));
    roleIdInput.value = role.id;
    roleNameInput.value = role.name;
    roleModuleInputs.forEach((input) => {
      input.checked = role.modules.includes(input.value);
    });
    setFormMessage('Editing role permissions.');
    return;
  }

  const roleDeleteButton = event.target.closest('[data-delete-role]');
  if (roleDeleteButton) {
    await fetchJson(`/api/roles/${roleDeleteButton.dataset.deleteRole}`, { method: 'DELETE' });
    await loadAccessData();
    return;
  }

  const userEditButton = event.target.closest('[data-edit-user]');
  if (userEditButton) {
    const users = await fetchJson('/api/users');
    const user = users.find((item) => item.id === Number(userEditButton.dataset.editUser));
    userIdInput.value = user.id;
    userNameInput.value = user.username;
    userPasswordInput.value = '';
    userSelect.value = user.roleId || '';
    userStatusSelect.value = user.status || 'active';
    setFormMessage('Editing user access.');
    return;
  }

  const userDeleteButton = event.target.closest('[data-delete-user]');
  if (userDeleteButton) {
    await fetchJson(`/api/users/${userDeleteButton.dataset.deleteUser}`, { method: 'DELETE' });
    await loadAccessData();
    return;
  }

  const cardEditButton = event.target.closest('[data-edit-card]');
  if (cardEditButton) {
    const guests = await fetchJson('/api/guests');
    const guest = guests.find((item) => item.id === Number(cardEditButton.dataset.editCard));
    populateCardForm(guest);
    return;
  }

  const cardClearButton = event.target.closest('[data-clear-card]');
  if (cardClearButton) {
    await clearCardAssignment(cardClearButton.dataset.clearCard);
    return;
  }
});

document.addEventListener('change', async (event) => {
  const uploadInput = event.target.closest('[data-upload-ktp]');
  if (!uploadInput) return;
  const formData = new FormData();
  formData.append('ktp', event.target.files[0]);
  await fetchJson(`/api/guests/${uploadInput.dataset.uploadKtp}/ktp`, { method: 'POST', body: formData });
  await refreshDashboard();
});


cardForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!cardGuestSelect?.value) {
    setFormMessage('Select a guest first.');
    return;
  }
  await saveCardAssignment(cardGuestSelect.value, cardRoomSelect.value, cardNumberInput.value);
  setFormMessage('Card linked successfully.');
});

cardCancelButton?.addEventListener('click', (event) => {
  event.preventDefault();
  cardForm.reset();
});

document.getElementById('room-cancel').addEventListener('click', () => {
  roomForm.reset();
  roomIdInput.value = '';
  setFormMessage('Room form cleared.');
});

document.getElementById('guest-cancel').addEventListener('click', () => {
  guestCrud.closeModal();
  setFormMessage('Guest form cleared.');
});

document.getElementById('close-guest-modal')?.addEventListener('click', () => {
  guestCrud.closeModal();
});

document.getElementById('role-cancel').addEventListener('click', () => {
  roleForm.reset();
  roleIdInput.value = '';
  setFormMessage('Role form cleared.');
});

document.getElementById('user-cancel').addEventListener('click', () => {
  userForm.reset();
  userIdInput.value = '';
  setFormMessage('User form cleared.');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;
  setLoginMessage('Checking credentials...');

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    setToken(data.token);
    state.user = data.user;
    setUserBadge(state.user);
    showDashboard();
    loginUsernameInput.value = '';
    loginPasswordInput.value = '';
    setLoginMessage('Welcome back!');
    switchModule('overview');
    await Promise.all([refreshDashboard(), loadAccessData()]);
  } catch (error) {
    setLoginMessage(error.message, true);
  }
});

logoutButton.addEventListener('click', async () => {
  try {
    await fetchJson('/api/logout', { method: 'POST' });
  } catch (error) {
    console.error(error);
  }

  setToken('');
  state.user = null;
  setUserBadge(null);
  showLogin();
  setLoginMessage('Please sign in to continue.');
});

moduleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (state.user?.modules?.includes(button.dataset.module) || button.dataset.module === 'overview') {
      switchModule(button.dataset.module);
    }
  });
});

moduleSearchInput?.addEventListener('input', refreshModuleButtons);

(async () => {
  if (state.token) {
    try {
      const me = await fetchJson('/api/me');
      state.user = me.user;
      setUserBadge(state.user);
      showDashboard();
      await Promise.all([refreshDashboard(), loadAccessData()]);
      switchModule('overview');
    } catch (error) {
      setToken('');
      state.user = null;
      setUserBadge(null);
      showLogin();
      setLoginMessage('Your session expired. Please log in again.', true);
    }
  } else {
    showLogin();
    setLoginMessage('Please sign in to continue.');
  }
})();
