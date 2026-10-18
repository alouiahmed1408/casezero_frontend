# CASE//ZERO frontend

The website of our detective game, made with Angular 21. The player opens a case,
reads the evidence, links the clues that go together and then accuses a suspect.

## How to run

You need Node.js and npm. The backend has to be running first.

    npm install
    npm start

Then open http://localhost:4200

The backend address is in `src/app/core/config.ts`. It is `http://localhost:8085/api`
right now, so change it there if your backend uses another port.

## Pages

| Address | What it is |
|---|---|
| `/` | List of cases, with a search box |
| `/investigation/:id` | The book: evidence cards on the left, the selected evidence on the right, countdown |
| `/investigation/:id/board` | All the evidence in one page, click two cards to link them |
| `/investigation/:id/accuse` | The accusation form and the verdict |
| `/admin` | Form to add a new case |

## Folders

- `src/app/pages/`: one folder per page (library, book, board, accuse, admin)
- `src/app/core/`: code shared by the pages
  - `api.service.ts`: all the calls to the backend
  - `game.service.ts`: keeps the data of the current investigation
  - `timer.service.ts`: the countdown
  - `guest.service.ts`: the guest player saved in the browser
  - `items.ts`: converts the evidence from the backend to what the book page shows
  - `models.ts`: the types of the data sent by the backend

## Things to know

- There is no login yet. The first time you open the site, a guest player is created
  and its id is saved in localStorage.
- The admin is the account with id 1 (created by the backend at the first start).
- The cases you solved are saved in localStorage too, to show the CLOSED stamp.
- The look (colors, folders, book) comes from `src/styles.css`.
"# casezero_frontend" 
"# casezero_frontend" 
"# casezero_frontend" 
