const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');

let firebaseApp = null;
let firebaseAuth = null;

try {
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        if (getApps().length === 0) {
            firebaseApp = initializeApp({
                credential: cert(serviceAccount),
            });
        } else {
            firebaseApp = getApps()[0];
        }
        firebaseAuth = getAuth(firebaseApp);
        console.log('✅ Firebase Admin SDK initialized successfully');
    } else {
        console.warn('⚠️ [Firebase Admin] config/serviceAccountKey.json not found. Firebase token verification disabled.');
    }
} catch (error) {
    console.error('❌ [Firebase Admin] Initialization error:', error.message);
}

/**
 * Verify a Firebase ID token sent from the client
 * @param {string} idToken
 * @returns {Promise<{ uid: string, phone_number?: string, email?: string }>}
 */
const verifyFirebaseIdToken = async (idToken) => {
    if (!firebaseAuth) {
        throw new Error('Firebase Admin SDK is not initialized on the server.');
    }
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    return decodedToken;
};

module.exports = {
    firebaseApp,
    firebaseAuth,
    getAuth: () => firebaseAuth,
    verifyFirebaseIdToken,
};
