// Authentication utilities
export const AUTH_TOKEN_KEY = 'linkedinify_auth_token';

// Save token to localStorage
export function saveToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

// Get token from localStorage
export function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Check if user is authenticated
export function isAuthenticated() {
  return !!getToken();
}

// Remove token from localStorage
export function removeToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

// Login function
export async function login(email, password) {
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

    const data = await response.json();
    saveToken(data.token);
    return data.token;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Register function
export async function register(email, password) {
  try {
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Registration failed');
    }

    const data = await response.json();
    saveToken(data.token);
    return data.token;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

// Initialize the auth UI
export function initAuthUI() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const authError = document.getElementById('auth-error');
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const loginPanel = document.getElementById('login-panel');
  const registerPanel = document.getElementById('register-panel');

  // Show login panel by default
  loginPanel.classList.remove('hidden');
  registerPanel.classList.add('hidden');
  loginTab.classList.add('bg-white', 'border-b-2', 'border-blue-500');
  registerTab.classList.remove('bg-white', 'border-b-2', 'border-blue-500');

  // Tab switching
  loginTab.addEventListener('click', () => {
    loginPanel.classList.remove('hidden');
    registerPanel.classList.add('hidden');
    loginTab.classList.add('bg-white', 'border-b-2', 'border-blue-500');
    registerTab.classList.remove('bg-white', 'border-b-2', 'border-blue-500');
    authError.textContent = '';
  });

  registerTab.addEventListener('click', () => {
    registerPanel.classList.remove('hidden');
    loginPanel.classList.add('hidden');
    registerTab.classList.add('bg-white', 'border-b-2', 'border-blue-500');
    loginTab.classList.remove('bg-white', 'border-b-2', 'border-blue-500');
    authError.textContent = '';
  });

  // Login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      await login(email, password);
      window.location.href = '/'; // Redirect to main page after login
    } catch (error) {
      authError.textContent = 'Invalid email or password';
    }
  });

  // Register form submission
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';

    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
      authError.textContent = 'Passwords do not match';
      return;
    }

    try {
      await register(email, password);
      window.location.href = '/'; // Redirect to main page after registration
    } catch (error) {
      authError.textContent = 'Registration failed. Email may already be in use.';
    }
  });
}
