# x3

Du an `x3` duoc tach tu `n33.html` thanh cau truc module:

- `index.html`: khung giao dien chinh
- `assets/css/app.css`: toan bo CSS tach rieng
- `assets/js/auto-retry.js`: khoi auto-fix tai nguyen
- `assets/js/app.js`: entry ES module
- `assets/js/modules/database-service.js`: database + shared utilities
- `assets/js/modules/main-app.js`: khoi tao Vue app va business logic
- `assets/js/modules/domain/`: cac module nghiep vu theo nhom
- `config/app.config.js`: cau hinh dung chung (sheet/header)
- `docs/ARCHITECTURE.md`: tai lieu cau truc module

## Chay local

Chay runtime browser bang Node static server (khong can cai them package):

```powershell
cd D:\ENGER_Codex\x3
npm start
```

Sau do truy cap: `http://localhost:8080`

Mo browser tu dong va chay server:

```powershell
cd D:\ENGER_Codex\x3
npm run dev:open
```

## Kiem tra chat luong

Chay toan bo quality gate:

```powershell
cd D:\ENGER_Codex\x3
npm run check
```

Trong do:
- `npm run check:arch`: dam bao `main-app.js` khong truy cap DB truc tiep (`databaseService.db.*`).
- `npm run check:syntax`: chay `node --check` tren toan bo JS trong `assets/js/modules`.

## SSO va Phan quyen

Ung dung da duoc bo sung:
- Dang nhap SSO bang Google (Google Identity Services) theo cau hinh.
- Co san duong lui OIDC voi Microsoft Entra ID neu can chuyen provider.
- RBAC theo role -> permission.
- Guard chan cac thao tac nhay cam (import, quan tri du lieu, master data).

Can cau hinh:
- `x3/config/app.config.js`:
  - `auth.provider = "google"`
  - `auth.google.clientId`
  - `auth.google.hostedDomain` (neu chi cho phep tai khoan Workspace theo domain)
  - `auth.google.roleByEmail`, `auth.google.roleByDomain`
  - `auth.requiredRoles`, `auth.rolePermissions`
- Tao OAuth Client trong Google Cloud Console va them Authorized JavaScript origins trung voi origin runtime (vd `http://localhost:8080`).

Luu y:
- `x3/assets/js/modules/package.json` da khai bao `"type": "module"` de tranh warning module khi chay test.

## Supabase Realtime Sync

Ung dung da ho tro dong bo realtime voi Supabase (snapshot ban dau + realtime change feed):

1. Chay script SQL khoi tao trong Supabase:
   - `x3/docs/supabase.realtime.sql`
2. Cap nhat `x3/config/app.config.js`:
   - `supabase.enabled = true`
   - `supabase.url`
   - `supabase.anonKey`
   - `supabase.storageMode = "envelope"` (giu mac dinh)
3. Bat Realtime cho cac bang nay trong Supabase Dashboard (neu chua co).
4. Neu dung production, thay cac policy `anon` bang policy theo user thuc te.

Luu y:
- O envelope mode, moi bang luu du lieu theo dang:
  - `row_key` (text, primary key)
  - `payload` (jsonb, chua toan bo row local)
  - `updated_at` (timestamp)
- Client van dung IndexedDB (Dexie) de chay offline; Supabase la lop dong bo realtime.
