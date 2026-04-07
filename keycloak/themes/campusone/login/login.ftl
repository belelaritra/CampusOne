<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In — CampusOne</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${url.resourcesPath}/css/login.css">
</head>
<body>

<div class="kc-card">

  <!-- Brand -->
  <div class="kc-brand">
    <div class="kc-brand-icon">🎓</div>
    <h1>CampusOne</h1>
    <p>IIT Bombay Campus Portal</p>
  </div>

  <div class="kc-title">Welcome back</div>

  <!-- Alert -->
  <#if message?has_content>
    <div class="kc-alert kc-alert--${message.type}">
      <span class="kc-alert-icon"><#if message.type == 'error'>⚠️<#elseif message.type == 'success'>✅<#elseif message.type == 'warning'>⚡<#else>ℹ️</#if></span>
      <span>${message.summary}</span>
    </div>
  </#if>

  <!-- Form -->
  <form id="kc-form-login" class="kc-form" action="${url.loginAction}" method="post">

    <!-- Username / Email -->
    <div class="kc-field">
      <label class="kc-label" for="username">
        <#if realm.loginWithEmailAllowed && !realm.registrationEmailAsUsername>Username or Email
        <#elseif realm.loginWithEmailAllowed>Email address
        <#else>Username</#if>
      </label>
      <div class="kc-input-wrap">
        <span class="kc-input-icon">👤</span>
        <input
          class="kc-input<#if messagesPerField.existsError('username','password')> kc-input--error</#if>"
          type="text"
          id="username"
          name="username"
          value="${(login.username!'')}"
          autocomplete="username"
          autofocus
          placeholder="<#if realm.loginWithEmailAllowed>you@iitb.ac.in<#else>your username</#if>"
        >
      </div>
      <#if messagesPerField.existsError('username')>
        <span class="kc-field-error">${messagesPerField.get('username')}</span>
      </#if>
    </div>

    <!-- Password -->
    <div class="kc-field">
      <label class="kc-label" for="password">Password</label>
      <div class="kc-input-wrap">
        <span class="kc-input-icon">🔒</span>
        <input
          class="kc-input<#if messagesPerField.existsError('username','password')> kc-input--error</#if>"
          type="password"
          id="password"
          name="password"
          autocomplete="current-password"
          placeholder="your password"
        >
        <button type="button" class="kc-eye-btn" onclick="togglePw('password',this)" title="Show/hide">👁</button>
      </div>
      <#if messagesPerField.existsError('password')>
        <span class="kc-field-error">${messagesPerField.get('password')}</span>
      </#if>
    </div>

    <!-- Remember me + Forgot password -->
    <div class="kc-row">
      <#if realm.rememberMe>
        <label class="kc-checkbox-label">
          <input type="checkbox" name="rememberMe" <#if login.rememberMe??>checked</#if>> Remember me
        </label>
      </#if>
      <#if realm.resetPasswordAllowed>
        <a class="kc-link" href="${url.loginResetCredentialsUrl}">Forgot password?</a>
      </#if>
    </div>

    <input type="hidden" name="credentialId" value="${(auth.selectedCredential!'')}">

    <button class="kc-btn" type="submit">Sign In →</button>

  </form>

  <#if realm.registrationAllowed>
    <div class="kc-footer">
      Don't have an account?&nbsp;<a class="kc-link" href="${url.registrationUrl}">Create account</a>
    </div>
  </#if>

</div>

<script>
  function togglePw(id, btn) {
    var i = document.getElementById(id);
    if (i.type === 'password') { i.type = 'text'; btn.textContent = '🙈'; }
    else { i.type = 'password'; btn.textContent = '👁'; }
  }
</script>

</body>
</html>
