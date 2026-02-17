# Meeting Mobile App

React Native mobile application for meeting management with feature parity to the desktop Electron app.

## Features

- **Authentication**: Login/Register with JWT token support
- **Dashboard**: View upcoming meetings and quick stats
- **Meetings**: Create, join, and manage meetings
- **Members**: View all registered members
- **Attendance**: Track attendance with admin reports
- **Settings**: Configure backend API and signaling server URLs
- **Offline Support**: Local caching of meetings and attendance data
- **Cross-Platform**: Works on Android and iOS

## Tech Stack

- **Framework**: React Native (Expo)
- **Navigation**: React Navigation with bottom tabs
- **State Management**: React Hooks
- **HTTP Client**: Axios
- **Storage**: AsyncStorage
- **Real-time**: Socket.io (for WebRTC signaling)
- **WebRTC**: react-native-webrtc (coming soon)

## Prerequisites

- Node.js >= 16.x
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- Android emulator or iOS simulator (or physical device)

## Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd meeting-mobile
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Update the URLs in `.env` if using custom backend:
```
REACT_APP_BACKEND_URL=https://your-backend-url.com
REACT_APP_SIGNALING_SERVER_URL=https://your-signaling-url.com
```

## Running the App

### With Expo Go (Recommended for Development)

```bash
npm start
```

This will start the Metro bundler. Use your phone camera to scan the QR code to open Expo Go.

### Android Emulator

```bash
npm run android
```

### iOS Simulator (Mac Only)

```bash
npm run ios
```

### Web (Development Only)

```bash
npm run web
```

## Project Structure

```
src/
├── screens/           # Screen components
│   ├── LoginScreen.js
│   ├── RegisterScreen.js
│   ├── DashboardScreen.js
│   ├── MeetingsScreen.js
│   ├── MeetingDetailScreen.js
│   ├── MembersScreen.js
│   ├── AttendanceScreen.js
│   └── SettingsScreen.js
├── services/          # API integration
│   └── api.js
├── utils/             # Utility functions
│   └── storage.js     # AsyncStorage helpers
└── navigation/        # Navigation setup
```

## API Integration

The app connects to the backend API at:
- Default: `https://meeting-backend-production-ba47.up.railway.app`
- Configurable via Settings screen

### Available Endpoints

- **Auth**: `/auth/login`, `/auth/register`
- **Users**: `/users`, `/users/:id`
- **Meetings**: `/meetings`, `/meetings/:id`, `/meetings/code/:code`
- **Attendance**: `/attendance/join`, `/attendance/leave`, `/attendance/by-meeting/:id`
- **Health**: `/health`

## Authentication

The app uses JWT tokens for authentication:
1. Tokens are stored in AsyncStorage
2. Automatically injected in request headers
3. Expired tokens are cleared automatically

## Building for Production

### Android APK

```bash
eas build --platform android --profile production
```

### iOS

```bash
eas build --platform ios --profile production
```

Requires:
- Apple Developer Account
- Signing certificates

## Future Features

- Video/Audio calling with WebRTC
- Real-time messaging
- Meeting recordings
- Admin management dashboard
- Push notifications
- Dark mode support

## Troubleshooting

### Connection Issues

1. Verify backend URL in Settings
2. Check internet connection
3. Test backend health endpoint: Click "Test Connection" in Settings

### Token Issues

1. Sign out and sign back in
2. Clear app cache
3. Check backend JWT_SECRET configuration

### App Won't Start

1. Clear cache: `expo start -c`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Restart bundler

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

ISC

## Support

For issues and questions, contact the development team.
