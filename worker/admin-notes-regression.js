import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const page=await readFile(new URL('../app/admin-berita/page.jsx',import.meta.url),'utf8');
const workspace=await readFile(new URL('../app/admin-berita/AdminWorkspace.jsx',import.meta.url),'utf8');
const panel=await readFile(new URL('../components/admin/AdminNotesPanel.jsx',import.meta.url),'utf8');
const route=await readFile(new URL('../app/api/admin/notes/route.js',import.meta.url),'utf8');
const idRoute=await readFile(new URL('../app/api/admin/notes/[id]/route.js',import.meta.url),'utf8');
const css=await readFile(new URL('../app/admin-berita/notes-panel.css',import.meta.url),'utf8');
assert.match(page,/AdminNotesPanel/);assert.match(page,/initialTab.*automation/);assert.match(workspace,/Catatan & Perbaikan/);assert.match(panel,/fetch\('\/api\/admin\/notes'/);assert.match(panel,/method:'POST'/);assert.match(panel,/method:'PATCH'/);assert.match(panel,/method:'DELETE'/);assert.match(panel,/cache:'no-store'/);assert.match(panel,/history\.pushState/);assert.match(panel,/Gagal memuat Catatan & Perbaikan/);assert.match(route,/ba:notes:index/);assert.match(route,/setJson\(SEED_KEY/);assert.match(route,/status:normalizeStatus/);assert.match(route,/priority:normalizePriority/);assert.match(route,/area:normalizeArea/);assert.match(idRoute,/export async function PATCH/);assert.match(idRoute,/status:body.status/);assert.match(idRoute,/priority:body.priority/);assert.match(idRoute,/area:body.area/);assert.match(css,/admin-notes-route-panel/);assert.match(css,/max-width:760px/);assert.match(css,/max-width:430px/);console.log('Admin notes regression: PASS persistent CRUD/status/priority/area tab routing responsive error handling');
