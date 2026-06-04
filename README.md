# Inakkam Backend

A robust, production-ready backend for the Inakkam dating app.

## Features
- **Authentication**: JWT-based auth with access/refresh tokens.
- **Profiles**: Full user profiles with Cloudinary photo uploads.
- **Matching**: Real-time discovery feed and match calculation.
- **Messaging**: Real-time chat powered by Socket.io.
- **Stories**: 24-hour expiring stories.
- **Scalability**: MongoDB with optimized indexing.
- **Security**: Rate limiting, data sanitization, and helmet integration.

## 🛠️ Setup Instructions

### 1. Configure Environment
Create a `.env` file in the root directory (copy from `.env.example` if available) and fill in:
- `MONGO_URI`: Your MongoDB Atlas connection string.
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: Secure random strings.
- `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET`: From your Cloudinary dashboard.

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Server
**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

## 🔌 API Endpoints
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Authenticate
- `GET /api/discover` - Get potential matches
- `POST /api/swipe` - Record a swipe
- `GET /api/conversations` - List chats
- `GET /api/messages` - Get chat history

## 🏗️ Tech Stack
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Real-time**: Socket.io
- **Uploads**: Cloudinary + Multer
- **Auth**: JWT + Bcrypt
