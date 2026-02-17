/**
 * Authentication JavaScript
 * Handles login and registration functionality
 */

document.addEventListener('DOMContentLoaded', () => {
  // Verify preload script loaded correctly
  if (!window.api) {
    console.error('CRITICAL: window.api is undefined - preload script did not load!');
    document.body.innerHTML = '<div style="color: red; padding: 20px; font-size: 18px;"><h2>Critical Error</h2><p>Preload script failed to load. The application cannot start.</p><p>This is a system error. Please restart the application.</p></div>';
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const alertContainer = document.getElementById('alert-container');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');

  function setActiveForm(isLogin) {
    if (isLogin) {
      loginForm.classList.add('active');
      registerForm.classList.remove('active');
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
    } else {
      loginForm.classList.remove('active');
      registerForm.classList.add('active');
      tabLogin.classList.remove('active');
      tabRegister.classList.add('active');
    }
    alertContainer.innerHTML = '';
  }

  tabLogin.addEventListener('click', () => setActiveForm(true));
  tabRegister.addEventListener('click', () => setActiveForm(false));

  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Clear previous alerts
    alertContainer.innerHTML = '';

    // Disable submit button
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      // Call the login API
      const result = await window.api.user.login({ email, password });

      console.log('Login result:', result);

      if (!result) {
        showAlert('No response from login. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
        return;
      }

      if (result.success === true && result.user) {
        // Store user session
        const sessionResult = await window.api.session.set(result.user);
        if (!sessionResult || !sessionResult.success) {
          showAlert('Failed to save session. Please try again.', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
          return;
        }
        
        // Log activity
        try {
          await window.api.activity.log({
            user_id: result.user.id,
            action: 'LOGIN',
            details: 'User logged in successfully'
          });
        } catch (logError) {
          console.error('Activity log error (non-blocking):', logError);
        }

        // Show success message
        showAlert('Login successful! Redirecting...', 'success');

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          window.api.navigate('dashboard');
        }, 1000);
      } else {
        const errorMsg = result && result.error ? result.error : 'Login failed. Please try again.';
        showAlert(errorMsg, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    } catch (error) {
      console.error('Login error:', error);
      console.error('Login error message:', error.message);
      showAlert('An unexpected error occurred. Please try again: ' + error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  // Handle registration form submission
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const full_name = document.getElementById('full_name').value;
    const email = document.getElementById('register_email').value;
    const password = document.getElementById('register_password').value;

    alertContainer.innerHTML = '';

    const submitBtn = registerForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      // Always register as 'member'. Only admins can create hosts/admins from Members page
      const result = await window.api.user.register({ full_name, email, password, role: 'member' });

      if (result.success) {
        showAlert('Account created successfully. Please sign in.', 'success');
        registerForm.reset();
        setActiveForm(true);
      } else {
        showAlert(result.error || 'Registration failed. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      showAlert('An unexpected error occurred. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });

  /**
   * Display alert message
   */
  function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertDiv);
  }
});
