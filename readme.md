## **Synchronous Chat - Backend Using Socket.io Bun Engine**

This is a lightweight, high-performance Api built with `Bun` and `Hono`, leveraging `Mongoose` for MongoDB interactions, `argon2` for password hashing, and `Zod` for validation.

### **Packages Installation**

Ensure you have `Bun` installed, then run:

```bash
bun install
```

### **Environment Variables**

Rename, `.env.sample` file to `.env` and define required variables:

```env
IMAGEKIT_PUBLIC_KEY=""
IMAGEKIT_PRIVATE_KEY=""
IMAGEKIT_URL_ENDPOINT=""

VAPID_MAILTO=""
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""

ACCESS_SECRET=""
ACCESS_EXPIRY=""
REFRESH_SECRET=""
REFRESH_EXPIRY=""

SIGNED_SECRET=""
SOCKET_SECRET=""
MONGODB_URI=""

STRICT_MODE=""
BODY_LIMIT=""
CORS_ORIGIN=""
PORT=""
NODE_ENV=""
LOG_LEVEL=""
```

Note: `BODY_LIMIT` is in MB & `NODE_ENV` should be development or production.

### **Running the Project**

#### Development Mode

```bash
bun run dev
```

#### Production Mode

```bash
bun run start
```

### **Project Description**

Migrated the backend stack from Node to Bun, replaced Express with Hono, upgraded password hashing to Argon2, switched media handling from Cloudinary to ImageKit, and moved Socket.IO to the Bun engine for better performance.

---
