# Fastify TypeScript API

API lengkap dengan Fastify, TypeScript, Prisma, MySQL, autentikasi JWT, middleware, CRUD users, dan dokumentasi Swagger.

## 🚀 Fitur
KILL PORT = npx kill-port 3000
- ✅ **Fastify** - Web framework yang cepat dan efisien
- ✅ **TypeScript** - Type safety dan development experience yang lebih baik
- ✅ **Prisma** - ORM modern untuk database
- ✅ **MySQL** - Database relational
- ✅ **JWT Authentication** - Sistem autentikasi yang aman
- ✅ **Middleware** - Auth middleware untuk proteksi routes
- ✅ **CRUD Users** - Operasi Create, Read, Update, Delete untuk users
- ✅ **Data Seeder** - Sample data untuk development
- ✅ **Nodemon** - Auto-reload untuk development
- ✅ **Swagger Documentation** - API documentation yang interaktif
- ✅ **Role-based Access** - Admin dan User roles
- ✅ **Input Validation** - Schema validation untuk requests
- ✅ **Error Handling** - Centralized error handling

## 📋 Prerequisites

- Node.js (v16 atau lebih tinggi)
- MySQL (v8.0 atau lebih tinggi)
- npm atau yarn

## 🛠️ Setup & Installation

### 1. Clone & Install Dependencies

```bash
# Clone repository (jika dari git)
git clone <repository-url>
cd fastify-api-typescript

# Install dependencies
npm install
```

### 2. Database Setup

```bash
# Buat database MySQL
mysql -u root -p
CREATE DATABASE fastify_db;
exit
```

### 3. Environment Configuration

Salin file `.env` dan sesuaikan dengan konfigurasi database Anda:

```bash
# Database
DATABASE_URL="mysql://username:password@localhost:3306/fastify_db"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Server
PORT=3000
HOST=localhost
```

**Penting:** Ganti `username`, `password`, dan `JWT_SECRET` dengan nilai yang sesuai!

### 4. Database Migration & Seeding

```bash
# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Seed database dengan sample data
npm run db:seed
```

### 5. Start Development Server

```bash
# Start development server dengan hot reload
npm run dev
```

Server akan berjalan di: http://localhost:3000

## 📚 API Documentation

Setelah server berjalan, buka Swagger documentation di:
**http://localhost:3000/docs**

## 🔐 Default Users

Setelah seeding database, Anda dapat menggunakan akun berikut:

### Admin Account
- **Email:** admin@example.com
- **Password:** admin123
- **Role:** ADMIN

### User Accounts
- **Email:** john@example.com | **Password:** user123
- **Email:** jane@example.com | **Password:** user123
- **Email:** bob@example.com | **Password:** user123
- **Email:** alice@example.com | **Password:** user123

## 🛣️ API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register user baru

### Users (Protected Routes)
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/profile` - Get current user profile
- `GET /api/users/:id` - Get user by ID (Admin only)
- `POST /api/users` - Create new user (Admin only)
- `PUT /api/users/:id` - Update user (Owner or Admin)
- `DELETE /api/users/:id` - Delete user (Admin only)

### System
- `GET /` - API info
- `GET /health` - Health check

## 🔒 Authentication

API menggunakan JWT (JSON Web Token) untuk autentikasi. Setelah login, Anda akan mendapat token yang harus disertakan di header:

```
Authorization: Bearer <your-jwt-token>
```

## 👥 User Roles

### USER
- Dapat melihat dan mengedit profil sendiri
- Tidak dapat mengakses data user lain
- Tidak dapat melakukan operasi admin

### ADMIN
- Dapat melihat semua users
- Dapat membuat, mengedit, dan menghapus user lain
- Akses penuh ke semua endpoints

## 🏗️ Project Structure

```
src/
├── config/
│   └── database.ts          # Prisma client configuration
├── middleware/
│   └── auth.ts              # Authentication middleware
├── routes/
│   ├── auth.ts              # Authentication routes
│   └── users.ts             # User CRUD routes
├── services/
│   └── userService.ts       # Business logic for users
├── types/
│   └── index.ts             # TypeScript type definitions
├── seed.ts                  # Database seeder
└── index.ts                 # Main application file

prisma/
└── schema.prisma            # Database schema

```

## 🧪 Testing API

### 1. Login untuk mendapatkan token:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}'
```

### 2. Gunakan token untuk mengakses protected routes:

```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <your-jwt-token>"
```

## 📦 Available Scripts

```bash
npm run dev          # Start development server dengan hot reload
npm run build        # Build untuk production
npm run start        # Start production server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema ke database
npm run db:seed      # Seed database dengan sample data
npm run db:studio    # Buka Prisma Studio (database GUI)
```

## 🔧 Development Tips

1. **Prisma Studio** - Gunakan `npm run db:studio` untuk melihat data database secara visual
2. **Hot Reload** - Nodemon akan otomatis restart server ketika ada perubahan file
3. **Type Safety** - TypeScript akan memberikan error jika ada type mismatch
4. **API Testing** - Gunakan Swagger UI di `/docs` untuk testing endpoints
5. **Database Changes** - Setelah mengubah schema Prisma, jalankan `npm run db:push`

## 🚨 Security Notes

- Ganti `JWT_SECRET` dengan value yang aman untuk production
- Jangan commit file `.env` ke repository
- Gunakan HTTPS di production
- Implementasikan rate limiting untuk production
- Validate dan sanitize semua input dari user

## 📈 Performance Tips

- Fastify sudah dioptimasi untuk performance
- Gunakan Prisma's connection pooling
- Implementasikan caching jika diperlukan
- Monitor query performance dengan Prisma

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the ISC License.