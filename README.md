# PESO-Link MisOr

PESO-Link MisOr is an Android-focused Expo React Native capstone application with a Node.js Express backend and MySQL database.

## Submitted System Scope

- Official frontend target: Android.
- Official backend: `backend/server.js` using Node.js, Express, and MySQL.
- Official database: MySQL schema in `backend/schema.sql`.
- iOS preview may be used only for developer testing through Expo Go because of device availability. It is not part of the submitted deployment scope.
- Web preview is not part of the submitted deployment scope.

## Backend Note

`backend/server.py` and `backend/requirements.txt` are unused legacy scaffold files. They are not part of the implemented PESO-Link MisOr system and should be excluded from submitted architecture diagrams and defense claims. The working backend remains the Node.js Express/MySQL implementation.

## Run Commands

Frontend Android:

```bash
cd frontend
npm run android
```

iOS developer preview only:

```bash
cd frontend
npm run ios:preview
```

Backend:

```bash
cd backend
npm run migrate:application-status
npm start
```
