import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

// Don't throw error immediately, handle it gracefully
if (!MONGODB_URI) {
  console.warn('⚠️ MONGODB_URI is not defined in environment variables');
}

// Initialize global mongoose cache properly
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  // If no URI is defined, return null (will be handled by caller)
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    return null;
  }

  // Return existing connection if available
  if (cached.conn) {
    console.log('✅ Using existing MongoDB connection');
    return cached.conn;
  }

  // Create new connection if not in progress
  if (!cached.promise) {
    console.log('🔄 Connecting to MongoDB...');
    console.log(`📍 Connection string: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials
    
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      // Add these for better reliability
      retryWrites: true,
      retryReads: true,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('✅ MongoDB connected successfully!');
        console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
        return mongoose;
      })
      .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message);
        // Clear the promise so we can retry
        cached.promise = null;
        // Don't throw here, let the caller handle it
        return null;
      });
  }

  try {
    const result = await cached.promise;
    if (result) {
      cached.conn = result;
      return cached.conn;
    } else {
      // Connection failed, clear promise for retry
      cached.promise = null;
      return null;
    }
  } catch (e) {
    cached.promise = null;
    console.error('❌ MongoDB connection failed:', e.message);
    return null;
  }
}

// Check if MongoDB is connected
export function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

// Get connection status
export function getDbStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[mongoose.connection.readyState] || 'unknown';
}

// Get connection details
export function getDbInfo() {
  if (isDbConnected()) {
    return {
      connected: true,
      status: getDbStatus(),
      database: mongoose.connection.db?.databaseName || 'unknown',
      host: mongoose.connection.host || 'unknown',
      port: mongoose.connection.port || 'unknown'
    };
  }
  return {
    connected: false,
    status: getDbStatus(),
    database: null,
    host: null,
    port: null
  };
}

// Force reconnect
export async function reconnectDb() {
  try {
    if (cached.conn) {
      await mongoose.disconnect();
      cached.conn = null;
      cached.promise = null;
    }
    return await dbConnect();
  } catch (error) {
    console.error('❌ Reconnection failed:', error.message);
    return null;
  }
}

export default dbConnect;