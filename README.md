# StoryTelling

StoryTelling is a mobile storytelling platform built using **React Native**, **Expo**, and **Firebase**. The application allows users to create, publish, discover, like, edit, delete, and comment on stories while providing user profiles, story search, and persistent theme preferences.

This project was developed to explore mobile app development concepts such as Firebase authentication, Firestore database operations, secure backend rules, transactional updates, user profiles, comments, search, and theme management.

---

## Features

* Create and publish stories
* Browse and discover stories
* Search for stories
* Edit and delete your own stories
* Like and unlike stories
* Add and delete comments
* User profile and story management
* Light, Dark, and System theme modes
* Persistent theme preferences
* Firebase Authentication
* Firestore database integration
* Server-side Firestore security rules
* Automated Firestore security rule testing

---

## Technologies Used

* React Native
* Expo
* TypeScript
* Expo Router
* Firebase Authentication
* Cloud Firestore
* Firebase Security Rules
* AsyncStorage
* Jest
* Firebase Emulator

---

## Getting Started

### Clone the Repository

    git clone https://github.com/dslord/StoryTelling.git
    cd StoryTelling

### Install Dependencies

    npm install

### Configure Firebase

Add your Firebase configuration locally. Sensitive Firebase configuration files are intentionally excluded from the repository.

### Run the Project

    npx expo start

For Android:

    npx expo run:android

---

## Project Structure

    ├── src/
    │   ├── app/
    │   ├── components/
    │   ├── config/
    │   ├── constants/
    │   ├── context/
    │   ├── hooks/
    │   ├── services/
    │   └── types/
    │
    ├── assets/
    ├── android/
    ├── scripts/
    │   └── firestore.rules.test.js
    │
    ├── app.json
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── expo-env.d.ts
    ├── firebase.json
    ├── firestore.rules
    ├── .gitignore
    ├── LICENSE
    └── README.md

---

## Firebase Security

Firestore Security Rules protect:

* User profiles
* Story ownership
* Story creation and editing
* Story deletion
* Like transactions
* Comments
* Field validation
* Character limits

Like and unlike operations use Firestore transactions to keep story like counts synchronized with individual like documents.

---

## Testing

Run TypeScript checks:

    npx tsc --noEmit

Run Firestore Security Rules tests:

    npx firebase-tools emulators:exec "npx jest scripts/firestore.rules.test.js"

---

## Future Improvements

* Display comment counts in the story feed
* Improved full-text search
* Advanced story discovery
* Story reporting
* Production deployment improvements

---

## Contributing

Contributions are welcome. Feel free to fork the repository, create a feature branch, and submit a pull request.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---

Developed by **dslord**.