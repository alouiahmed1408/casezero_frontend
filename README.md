# CASE//ZERO frontend (Sprint 1)

Angular 21, standalone components and signals. The CSS and the SVG sprite are taken as-is from Maquette3.html.

## Run

    npm install
    npm start

Open http://localhost:4200. The backend must run on http://localhost:8080 (change it in src/app/core/config.ts).

## Screens

| Route | Screen |
|---|---|
| / | Case archives: folders, search, opening animation |
| /investigation/:id | The book: evidence by section, thread linking, hourglass |
| /investigation/:id/accuse | Statement of accusation and verdict |
| /admin | File a case and the registry |

## Notes

- No login in Sprint 1: a guest player is created on first visit and its id is kept in localStorage.
- The admin identity is ADMIN_ID in src/app/core/config.ts (the default admin created by the backend, id 1).
- Cases solved by the guest are remembered in localStorage to show the CLOSED stamp on the folder.
