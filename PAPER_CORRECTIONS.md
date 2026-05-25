# PESO-Link MisOr Paper And Diagram Corrections

Use these corrections when updating the capstone paper, diagrams, and defense slides.

## Backend Architecture

The implemented system uses:

- React Native Expo frontend, submitted as Android-focused.
- Node.js Express REST API backend.
- MySQL database.

Do not describe `backend/server.py`, FastAPI, MongoDB, Firebase Firestore, or Firebase Storage as implemented components. If mentioned, label them as unused scaffold or non-implemented alternatives.

## Platform Scope

Use this wording:

> The system is designed and submitted as an Android-focused Expo React Native application. iOS preview was used only for developer testing due to device availability.

Do not present iOS or web as supported deployment targets.

## Two Status Tracks

Keep employer application tracking separate from PESO referral/profile tracking.

Employer application statuses are manually encoded by the employer for in-app applicants only:

- `submitted`
- `pending`
- `for_review`
- `for_interview`
- `hired`
- `rejected`
- `closed`

`hired` is valid only as an employer-entered application outcome. It must not be presented as automated screening, applicant ranking, hiring recommendation, or PESO/system-generated decision.

PESO referral/profile tracking must not use `hired`. It should use profile/referral preparation labels such as pending, referred, rejected, draft, submitted, needs revision, or referral-ready, depending on the diagram context.

## NSRP Profile Review States

Keep NSRP profile preparation separate from application status. Use this wording:

> NSRP profile review states such as draft, submitted, needs revision, and referral-ready are profile preparation states, not employer application outcome statuses.

## Job Post Removal

Describe job post removal as status-based soft closing. Closed job posts remain stored for PESO monitoring and audit visibility.
