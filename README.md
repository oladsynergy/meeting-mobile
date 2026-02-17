# Islamic Cooperative Meeting & Attendance Desktop App

A production-ready Electron desktop application for Windows that enables Islamic cooperatives to host online video meetings, track attendance, and manage members - all stored locally with SQLite.

## Features

- 🎥 **Video Conferencing** - WebRTC peer-to-peer video meetings
- 📊 **Attendance Tracking** - Automatic join/leave logging with duration calculation
- 👥 **Member Management** - Complete user management with role-based access
- 🔒 **Security** - Bcrypt password hashing, contextIsolation, secure IPC
- 📈 **Reports & Export** - Export attendance to CSV/PDF
- 🎨 **Modern UI** - Clean, minimal interface with dark mode support
- 💾 **Local Storage** - All data stored locally in SQLite (no cloud required)

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **Node.js** - JavaScript runtime
- **SQLite (better-sqlite3)** - Local database
- **WebRTC** - Peer-to-peer video communication
- **Socket.io** - Signaling server for WebRTC
- **Bcrypt** - Password hashing

## Project Structure

```
amrimeetingapp/
├── main/                   # Main process (Electron)
│   ├── main.js            # Application entry point
│   ├── database.js        # SQLite database manager
│   ├── ipcHandlers.js     # IPC communication handlers
│   └── preload.js         # Secure preload script
├── renderer/              # Renderer process (UI)
│   ├── index.html         # Login page
│   ├── dashboard.html     # Main dashboard
│   ├── meeting.html       # Meeting room
│   ├── css/               # Stylesheets
│   │   ├── global.css     # Global styles
│   │   └── auth.css       # Authentication styles
│   └── js/                # Frontend JavaScript
│       └── auth.js        # Authentication logic
├── server/                # Signaling server
│   └── signalingServer.js # WebRTC signaling
└── package.json           # Project dependencies
```

## Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Windows OS (primary target)

### Install Dependencies

```bash
cd c:\xamps\htdocs\amrimeetingapp
npm install
```

### Run the Application

```bash
# Development mode with DevTools
npm run dev

# Production mode
npm start
```

### Build for Distribution

```bash
npm run build
```

## Database Schema

### Users Table
- `id` - Primary key
- `full_name` - User's full name
- `email` - Unique email address
- `password_hash` - Bcrypt hashed password
- `role` - admin, host, or member
- `created_at` - Timestamp

### Meetings Table
- `id` - Primary key
- `title` - Meeting title
- `meeting_code` - Unique 8-character code
- `scheduled_time` - Meeting date/time
- `password` - Optional meeting password
- `is_locked` - Meeting lock status
- `created_by` - Foreign key to users
- `created_at` - Timestamp

### Attendance Table
- `id` - Primary key
- `meeting_id` - Foreign key to meetings
- `user_id` - Foreign key to users
- `join_time` - Timestamp when user joined
- `leave_time` - Timestamp when user left
- `duration_minutes` - Calculated duration

## Default Credentials

**Administrator Account:**
- Email: `admin@cooperative.local`
- Password: `admin123`

⚠️ **Important:** Change the default admin password immediately after first login.

## Security Features

- ✅ Password hashing with bcrypt
- ✅ Context isolation enabled
- ✅ Node integration disabled in renderer
- ✅ Secure IPC communication via preload script
- ✅ No remote module access
- ✅ Local data storage only

## Development Phases

This project is built in phases:

1. ✅ **Phase 1** - Project Setup & Database Foundation
2. ⏳ **Phase 2** - Authentication System (Next)
3. ⏳ **Phase 3** - Dashboard & Member Management
4. ⏳ **Phase 4** - Meeting System Core
5. ⏳ **Phase 5** - Video Conference & WebRTC
6. ⏳ **Phase 6** - Host Controls & Permissions
7. ⏳ **Phase 7** - Attendance Tracking System
8. ⏳ **Phase 8** - Attendance Dashboard & Export
9. ⏳ **Phase 9** - UI Polish & Additional Features

## License

MIT License

## Support

For issues and questions, please refer to the project documentation or contact the development team.
