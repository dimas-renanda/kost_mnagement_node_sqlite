# DataTables integration and CRUD conventions

This file documents how DataTables is used across the project and gives examples for each CRUD module (Rooms, Guests, Cards, Roles, Users). It shows how to use the existing `showConfirmModal` modal for delete confirmation and gives style / accessibility notes to keep UIs consistent.

## Summary

- We use a single helper `createGridTable(container, { columns, data, perPage })` in `public/app.js` to render DataTables instances.
- Data is provided as arrays of cell values. For more complex cells (buttons, images), use the `formatter` callback in the `columns` definition and return safe HTML (use `escapeHtml()` for text values).
- Deletions should always use the existing confirmation modal `showConfirmModal({ title, message, confirmText, onConfirm })`.
- Keep table container markup: wrap tables in an element with class `gridjs-wrapper` (existing code uses this class). The wrapper now supports horizontal scrolling.

## Install / Assets

We include DataTables and jQuery locally via `node_modules` and serve them from `/node_modules`:

 - `/node_modules/jquery/dist/jquery.min.js`
 - `/node_modules/datatables.net/js/dataTables.min.js`
 - `/node_modules/datatables.net-dt/css/jquery.dataTables.min.css`

If you need to update the version, run:

```bash
npm install datatables.net-dt jquery --save
```

## `createGridTable` usage (pattern)

The project uses a single rendering helper in `public/app.js`. Example usage for a module:

```js
createGridTable(roomList, {
  columns: [
    { name: 'Name', formatter: cell => escapeHtml(cell) },
    { name: 'Type', formatter: cell => escapeHtml(cell) },
    { name: 'Price', formatter: cell => escapeHtml(cell) },
    { name: 'Status', formatter: cell => escapeHtml(cell) },
    {
      name: 'Actions',
      sort: false,
      formatter: (_cell, row) => `
        <div class="actions">
          <button type="button" data-edit-room="${row.cells[4].data}">Edit</button>
          <button type="button" class="danger" data-delete-room="${row.cells[4].data}">Delete</button>
        </div>`
    }
  ],
  data: rooms.map(room => [room.name, room.type, room.price, room.status, room.id]),
  perPage: 8
});
```

Notes:
- `formatter` receives `(cellValue, row, cellIndex)`; you can return an HTML string. Ensure text is escaped via `escapeHtml` when appropriate.
- The helper attaches the DataTables instance to the container as `_dataTableInstance`. Use it for programmatic searches or redraws.

## Delete flow (use existing modal)

Always use `showConfirmModal` before performing destructive actions:

```js
function handleDelete(recordId, apiPath, reloadFn) {
  showConfirmModal({
    title: 'Delete item',
    message: `Delete <strong>${escapeHtml(recordId)}</strong>? This action cannot be undone.`,
    confirmText: 'Delete',
    destructive: true,
    onConfirm: async () => {
      await fetchJson(`${apiPath}/${recordId}`, { method: 'DELETE' });
      if (typeof reloadFn === 'function') await reloadFn();
    }
  });
}

// Example binding inside the module's action handler
const deleteButton = event.target.closest('[data-delete-room]');
if (deleteButton) {
  const id = deleteButton.dataset.deleteRoom;
  handleDelete(id, '/api/rooms', loadRooms);
}
```

This keeps confirmation and deletion logic consistent across modules.

## Search / Filter / Pagination

- DataTables' built-in search is used (configured in `createGridTable`). The toolbar search control is constrained by CSS to avoid overflowing the layout. If you need table-specific filters (per-column), add UI controls above the table and call `_dataTableInstance.column(index).search(value).draw()`.

Example: per-column filter input

```js
// set filter for column 2
container._dataTableInstance.column(2).search('AC').draw();
```

## Accessibility

- Buttons in pagination and table actions include `aria-*` attributes provided by DataTables by default. Keep custom action buttons accessible by using `aria-label` when needed.
- Use the existing modal `role="dialog"` and `aria-modal="true"` for confirmations (already implemented).

## Styling and Consistency

- Use the existing `actions` class for action containers inside cells. Keep button text and sizes consistent with other UI buttons (CSS already added in `public/styles.css`).
- Avoid very long, unbroken strings in table cells; if you must show long content, render a short preview and provide a detail modal.

## Troubleshooting

- If search/pagination controls are missing, ensure `jquery` and `datatables` scripts are loaded before `app.js` and that `createGridTable` is called after the container exists.
- If table content overflows, wrap the table in `.gridjs-wrapper` (already used) which allows horizontal scroll.

## Example checklist for adding a new CRUD table

1. Add container in the HTML: `<div id="my-entity-list" class="gridjs-wrapper"></div>`
2. Add `gridColumns` and `buildGridData` in the module config.
3. Use `createGridTable(container, { columns: gridColumns, data: buildGridData(items) })` to render.
4. For delete actions, call `showConfirmModal` and reload the module after success.
5. Verify search, sorting, and pagination appear and behave as expected.

---

If you want, I can also add a small example file `public/examples/rooms-init.js` to show a minimal, copy-paste-ready table initialization. Would you like that?
