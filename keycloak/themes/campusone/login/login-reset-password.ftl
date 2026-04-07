<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password — CampusOne</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${url.resourcesPath}/css/login.css">
</head>
<body>

<div class="kc-card">

  <div class="kc-brand">
    <div class="kc-brand-icon">🔑</div>
    <h1>CampusOne</h1>
    <p>IIT Bombay Campus Portal</p>
  </div>

  <div class="kc-title">Forgot your password?</div>

  <div class="kc-info">
    Enter your username or email and we'll send you a reset link. Check your inbox after submitting.
  </div>

  <#if message?has_content>
    <div class="kc-alert kc-alert--${message.type}">
      <span class="kc-alert-icon"><#if message.type == 'error'>⚠️<#elseif message.type == 'success'>✅<#else>ℹ️</#if></span>
      <span>${message.summary}</span>
    </div>
  </#if>

  <form class="kc-form" action="${url.loginAction}" method="post">

    <div class="kc-field">
      <label class="kc-label" for="username">
        <#if realm.loginWithEmailAllowed && !realm.registrationEmailAsUsername>Username or Email
        <#elseif realm.loginWithEmailAllowed>Email address
        <#else>Username</#if>
      </label>
      <div class="kc-input-wrap">
        <span class="kc-input-icon"><#if realm.loginWithEmailAllowed>✉️<#else>👤</#if></span>
        <input class="kc-input<#if messagesPerField.existsError('username')> kc-input--error</#if>"
          type="text" id="username" name="username"
          value="${(auth.attemptedUsername!'')}"
          autocomplete="username" autofocus
          placeholder="<#if realm.loginWithEmailAllowed>you@iitb.ac.in<#else>your username</#if>">
      </div>
      <#if messagesPerField.existsError('username')>
        <span class="kc-field-error">${messagesPerField.get('username')}</span>
      </#if>
    </div>

    <button class="kc-btn" type="submit">Send Reset Link →</button>

  </form>

  <div class="kc-footer">
    <a class="kc-link" href="${url.loginUrl}">← Back to sign in</a>
  </div>

</div>

</body>
</html>
