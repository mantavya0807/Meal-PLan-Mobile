# Penn State Meal Plan Backend API

A robust TypeScript backend API for the Penn State Meal Plan mobile application. Built with Express.js, Supabase, and modern authentication practices.

## 🏗️ Architecture

- **Framework**: Express.js with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT tokens with bcrypt password hashing
- **Security**: Helmet, CORS, rate limiting, input validation
- **Development**: Hot reload with tsx, comprehensive logging

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- A Supabase project (free tier available)

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Setup

Copy the environment template:

```bash
cp .env.example .env
```

Configure your `.env` file:

```env
# Server Configuration
NODE_ENV=development
PORT=3001
API_VERSION=v1

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here
JWT_REFRESH_EXPIRES_IN=30d

# Bcrypt Configuration
BCRYPT_SALT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=http://localhost:8081

# Logging
LOG_LEVEL=info

# Email Configuration (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=noreply@pennstatemealplan.com
FROM_NAME=Penn State Meal Plan
```

### 3. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Get your project URL and keys from Settings > API
3. Create the users table in your Supabase SQL editor:

```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  reset_password_token VARCHAR(255) NULL,
  reset_password_expires TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_reset_token ON users(reset_password_token);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
CREATE POLICY "Service role can manage users" ON users
  FOR ALL USING (true);
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start on http://localhost:3001

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/register` | Register new user | No |
| POST | `/api/v1/auth/login` | User login | No |
| POST | `/api/v1/auth/forgot-password` | Request password reset | No |
| POST | `/api/v1/auth/reset-password` | Reset password with token | No |
| POST | `/api/v1/auth/refresh-token` | Refresh access token | No |
| GET | `/api/v1/auth/me` | Get current user | Yes |
| POST | `/api/v1/auth/logout` | Logout user | Yes |

### Health & Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/detailed` | Detailed system health |
| GET | `/api/v1` | API information |

## 🔒 Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. **Register/Login** - Get access and refresh tokens
2. **Access Token** - Include in Authorization header: `Bearer <token>`
3. **Token Refresh** - Use refresh token to get new access token
4. **Token Expiry** - Access tokens expire in 7 days, refresh tokens in 30 days

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## 🛡️ Security Features

- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Supabase client provides protection
- **CORS**: Configurable cross-origin resource sharing
- **Helmet**: Security headers protection
- **Password Hashing**: bcrypt with configurable salt rounds

## 📊 Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|---------|
| General API | 100 requests | 15 minutes |
| Authentication | 10 requests | 15 minutes |
| Password Reset | 5 requests | 1 hour |
| Token Refresh | 20 requests | 15 minutes |

## 🔧 Development Scripts

```bash
# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Run tests
npm test

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Clean build directory
npm run clean
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/     # Request handlers
│   │   └── authController.ts
│   ├── services/        # Business logic
│   │   └── authService.ts
│   ├── models/          # Database models
│   │   └── User.ts
│   ├── routes/          # API routes
│   │   └── authRoutes.ts
│   ├── middleware/      # Custom middleware
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   └── rateLimiter.ts
│   ├── config/          # Configuration
│   │   ├── database.ts
│   │   └── environment.ts
│   ├── types/           # TypeScript types
│   │   └── index.ts
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── dist/                # Compiled JavaScript
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🚀 Deployment

### Production Environment Variables

Ensure these are set in production:

```bash
NODE_ENV=production
JWT_SECRET=<strong-secret-key>
JWT_REFRESH_SECRET=<different-strong-secret-key>
SUPABASE_URL=<your-production-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
CORS_ORIGIN=<your-frontend-domain>
```

### Build and Start

```bash
# Install dependencies
npm ci

# Build TypeScript
npm run build

# Start production server
npm start
```

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

**Supabase Connection Issues**
- Verify your Supabase URL and keys
- Check if your IP is allowed in Supabase settings
- Ensure the users table exists

**JWT Secret Warnings**
- Use strong, unique secrets for JWT_SECRET and JWT_REFRESH_SECRET
- Secrets should be at least 32 characters in production

## 📝 API Documentation

In development mode, visit:
- API Info: http://localhost:3001/api/v1
- Documentation: http://localhost:3001/api/v1/docs
- Environment Info: http://localhost:3001/api/v1/env

## 🤝 Contributing

1. Follow TypeScript and ESLint configurations
2. Add comprehensive JSDoc comments
3. Write tests for new features
4. Use conventional commit messages
5. Update documentation as needed

## 📄 License

This project is for educational purposes. Not affiliated with Penn State University.