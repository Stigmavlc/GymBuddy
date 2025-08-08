/**
 * User Identifier Utility
 * 
 * This utility helps identify whether a user is Ivan, Youssef, or unknown
 * based on their Telegram profile information (name, username, email).
 * 
 * Usage:
 *   const userType = identifyUser(telegramUser);
 *   // Returns: 'ivan', 'youssef', or 'unknown'
 */

class UserIdentifier {
  constructor() {
    // Define known patterns for each user
    this.userPatterns = {
      ivan: {
        names: ['ivan', 'iván', 'ivan aguilar', 'iván aguilar', 'ivanaguilar'],
        usernames: ['ivanaguilar', 'ivan_aguilar', 'ivan.aguilar', 'object_oriented_guy'],
        emails: ['ivanaguilar@', 'ivan.aguilar@', 'ivan@']
      },
      youssef: {
        names: ['youssef', 'youssef el', 'youssfel'],
        usernames: ['youssef', 'youssfel', 'youssef_el'],
        emails: ['youssef@', 'youssfel@']
      }
    };
  }

  /**
   * Normalize text by removing accents and converting to lowercase
   * @param {string} text - Text to normalize
   * @returns {string} - Normalized text
   */
  normalizeText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .trim();
  }

  /**
   * Main identification function
   * @param {Object} telegramUser - Telegram user object with first_name, last_name, username
   * @param {string} email - Optional email address
   * @returns {string} - 'ivan', 'youssef', or 'unknown'
   */
  identifyUser(telegramUser, email = null) {
    if (!telegramUser) {
      console.warn('UserIdentifier: No telegram user provided');
      return 'unknown';
    }

    // FALLBACK 1: Check known Telegram IDs first (most reliable)
    if (telegramUser.id === 1195143765) {
      console.log('UserIdentifier: Identified Ivan by Telegram ID (1195143765)');
      return 'ivan';
    }
    
    // Add space for future Youssef ID when we get it
    // if (telegramUser.id === YOUSSEF_TELEGRAM_ID) {
    //   console.log('UserIdentifier: Identified Youssef by Telegram ID');
    //   return 'youssef';
    // }

    // FALLBACK 2: Pattern matching with character normalization
    // Build normalized data from Telegram
    const firstName = this.normalizeText(telegramUser.first_name);
    const lastName = this.normalizeText(telegramUser.last_name);
    const fullName = `${firstName} ${lastName}`.trim();
    const username = this.normalizeText(telegramUser.username);
    const emailLower = this.normalizeText(email);

    // Also keep original versions for comparison
    const firstNameOrig = (telegramUser.first_name || '').toLowerCase().trim();
    const usernameOrig = (telegramUser.username || '').toLowerCase().trim();

    console.log('UserIdentifier: Analyzing user (enhanced):', {
      telegramId: telegramUser.id,
      firstName: `"${firstName}" (orig: "${firstNameOrig}")`,
      lastName,
      fullName,
      username: `"${username}" (orig: "${usernameOrig}")`,
      email: emailLower ? emailLower.substring(0, 10) + '...' : 'none'
    });

    // Check each user type with enhanced matching
    for (const [userType, patterns] of Object.entries(this.userPatterns)) {
      console.log(`UserIdentifier: Testing patterns for ${userType}...`);
      
      if (this.matchesPatterns(firstName, lastName, fullName, username, emailLower, patterns, userType)) {
        console.log(`UserIdentifier: ✅ Identified as ${userType} via pattern matching`);
        return userType;
      }
      
      // Also try with original (non-normalized) text as fallback
      if (this.matchesPatterns(firstNameOrig, lastName, `${firstNameOrig} ${lastName}`.trim(), usernameOrig, emailLower, patterns, userType + '-original')) {
        console.log(`UserIdentifier: ✅ Identified as ${userType} via original text matching`);
        return userType;
      }
    }

    console.log('UserIdentifier: Could not identify user, returning unknown');
    return 'unknown';
  }

  /**
   * Check if user data matches patterns for a specific user type
   * @param {string} firstName 
   * @param {string} lastName 
   * @param {string} fullName 
   * @param {string} username 
   * @param {string} email 
   * @param {Object} patterns 
   * @param {string} debugContext - Context for debugging logs
   * @returns {boolean}
   */
  matchesPatterns(firstName, lastName, fullName, username, email, patterns, debugContext = '') {
    const debug = debugContext ? `[${debugContext}] ` : '';
    
    // Check first name matches
    if (firstName && patterns.names.some(name => {
      const normalized = this.normalizeText(name);
      const matches = firstName.includes(normalized) || normalized.includes(firstName);
      if (matches) console.log(`${debug}UserIdentifier: ✅ First name match: "${firstName}" matches pattern "${normalized}"`);
      return matches;
    })) {
      return true;
    }

    // Check full name matches
    if (fullName && patterns.names.some(name => {
      const normalized = this.normalizeText(name);
      const matches = fullName.includes(normalized) || normalized.includes(fullName);
      if (matches) console.log(`${debug}UserIdentifier: ✅ Full name match: "${fullName}" matches pattern "${normalized}"`);
      return matches;
    })) {
      return true;
    }

    // Check username matches (try both exact and contains)
    if (username && patterns.usernames.some(pattern => {
      const normalized = this.normalizeText(pattern);
      const exactMatch = username === normalized;
      const containsMatch = username.includes(normalized) || normalized.includes(username);
      const matches = exactMatch || containsMatch;
      if (matches) {
        console.log(`${debug}UserIdentifier: ✅ Username match: "${username}" ${exactMatch ? 'exactly matches' : 'contains'} pattern "${normalized}"`);
      }
      return matches;
    })) {
      return true;
    }

    // Check email matches
    if (email && patterns.emails.some(pattern => {
      const normalized = this.normalizeText(pattern);
      const matches = email.includes(normalized);
      if (matches) console.log(`${debug}UserIdentifier: ✅ Email match: "${email}" contains pattern "${normalized}"`);
      return matches;
    })) {
      return true;
    }

    console.log(`${debug}UserIdentifier: ❌ No pattern matched for: firstName="${firstName}", username="${username}"`);
    return false;
  }

  /**
   * Get user display name based on identification
   * @param {string} userType - Result from identifyUser()
   * @param {Object} telegramUser - Original telegram user object
   * @returns {string} - Proper display name
   */
  getDisplayName(userType, telegramUser) {
    if (userType === 'ivan') {
      return 'Ivan';
    } else if (userType === 'youssef') {
      return 'Youssef';
    }

    // Fallback to Telegram name
    if (telegramUser?.first_name) {
      return telegramUser.first_name;
    }

    return 'Unknown User';
  }

  /**
   * Quick test method to verify identification logic
   * @returns {Object} - Test results
   */
  runTests() {
    const testCases = [
      {
        name: 'Ivan test 1',
        user: { first_name: 'Ivan', last_name: 'Aguilar', username: 'ivanaguilar' },
        expected: 'ivan'
      },
      {
        name: 'Ivan test 2',
        user: { first_name: 'Ivan', username: 'ivan_aguilar' },
        expected: 'ivan'
      },
      {
        name: 'Ivan test 3 (accented)',
        user: { first_name: 'Iván', username: 'object_oriented_guy' },
        expected: 'ivan'
      },
      {
        name: 'Ivan test 4 (Telegram ID)',
        user: { id: 1195143765, first_name: 'TestName', username: 'testuser' },
        expected: 'ivan'
      },
      {
        name: 'Youssef test 1',
        user: { first_name: 'Youssef', last_name: 'El', username: 'youssef' },
        expected: 'youssef'
      },
      {
        name: 'Unknown test',
        user: { first_name: 'John', last_name: 'Doe', username: 'johndoe' },
        expected: 'unknown'
      }
    ];

    const results = testCases.map(testCase => {
      const result = this.identifyUser(testCase.user);
      const passed = result === testCase.expected;
      
      return {
        name: testCase.name,
        expected: testCase.expected,
        actual: result,
        passed
      };
    });

    console.log('UserIdentifier Tests:', results);
    return results;
  }
}

// Export both class and convenience function
const userIdentifier = new UserIdentifier();

/**
 * Convenience function for quick user identification
 * @param {Object} telegramUser - Telegram user object
 * @param {string} email - Optional email
 * @returns {string} - 'ivan', 'youssef', or 'unknown'
 */
function identifyUser(telegramUser, email = null) {
  return userIdentifier.identifyUser(telegramUser, email);
}

/**
 * Get display name for identified user
 * @param {string} userType - Result from identifyUser()
 * @param {Object} telegramUser - Original telegram user object
 * @returns {string} - Display name
 */
function getDisplayName(userType, telegramUser) {
  return userIdentifier.getDisplayName(userType, telegramUser);
}

module.exports = {
  UserIdentifier,
  identifyUser,
  getDisplayName,
  runTests: () => userIdentifier.runTests()
};